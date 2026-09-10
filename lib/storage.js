"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DEFAULT_EMPLOYEES,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  blankEmployee,
} from "./constants"

// Generic localStorage-backed state with SSR-safe lazy init.
const useLocalState = (key, initial, reviver) => {
  const [value, setValue] = useState(initial)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) {
        const parsed = JSON.parse(raw)
        setValue(reviver ? reviver(parsed) : parsed)
      } else if (reviver) {
        setValue(reviver(undefined))
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* quota / private mode */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update, hydrated]
}

const hasData = (d) =>
  d && typeof d === "object" && Object.keys(d).length > 0

// localStorage-backed state that also syncs with a server endpoint (MongoDB).
// Offline-first: localStorage is the instant cache; the server is the shared
// source of truth when reachable. On mount we GET the server (adopting its data,
// or seeding it from local if empty); on change we write local immediately and
// debounce a PUT. If the server is unreachable everything still works locally.
const useSyncedState = (localKey, endpoint, initial, reviver) => {
  const [value, setLocal, hydrated] = useLocalState(localKey, initial, reviver)
  const [status, setStatus] = useState("loading") // loading|synced|saving|offline
  const valueRef = useRef(value)
  const loaded = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const put = useCallback(
    (data) => {
      setStatus("saving")
      return fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((r) => {
          if (r.status === 401) {
            window.location.href = "/login"
            return null
          }
          return r.json()
        })
        .then((j) => setStatus(j && j.ok ? "synced" : "offline"))
        .catch(() => setStatus("offline"))
    },
    [endpoint],
  )

  // Load once, after localStorage has hydrated.
  useEffect(() => {
    if (!hydrated || loaded.current) return
    loaded.current = true
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(endpoint)
        if (res.status === 401) {
          window.location.href = "/login"
          return
        }
        const json = await res.json()
        if (cancelled) return
        if (json && json.ok) {
          if (hasData(json.data)) {
            const next = reviver ? reviver(json.data) : json.data
            valueRef.current = next
            setLocal(next)
            setStatus("synced")
          } else {
            await put(valueRef.current) // server empty → seed from local
          }
        } else {
          setStatus("offline")
        }
      } catch {
        if (!cancelled) setStatus("offline")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, endpoint, reviver, setLocal, put])

  const setValue = useCallback(
    (next) => {
      const resolved = typeof next === "function" ? next(valueRef.current) : next
      valueRef.current = resolved
      setLocal(resolved)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => put(resolved), 700)
    },
    [setLocal, put],
  )

  return [value, setValue, status]
}

// Upgrade the original id->"Name" map to the richer employee object.
const migrateEmployees = (stored) => {
  if (stored && typeof stored === "object") {
    const sample = Object.values(stored)[0]
    if (typeof sample === "object") return stored // already v2
    if (typeof sample === "string") {
      return Object.fromEntries(
        Object.entries(stored).map(([id, name]) => [id, blankEmployee(name)]),
      )
    }
  }
  // No v2 data — try the legacy key, else seed defaults.
  try {
    const legacy = localStorage.getItem(STORAGE_KEYS.legacyEmployees)
    if (legacy) {
      const map = JSON.parse(legacy)
      return Object.fromEntries(
        Object.entries(map).map(([id, name]) => [id, blankEmployee(name)]),
      )
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_EMPLOYEES
}

// Merge stored settings over defaults so new keys appear after upgrades.
const mergeSettings = (stored) => ({ ...DEFAULT_SETTINGS, ...(stored || {}) })

export const useEmployees = () => {
  const [employees, setEmployees, status] = useSyncedState(
    STORAGE_KEYS.employees,
    "/api/employees",
    DEFAULT_EMPLOYEES,
    migrateEmployees,
  )
  return { employees, setEmployees, status }
}

export const useSettings = () => {
  const [settings, setSettings, status] = useSyncedState(
    STORAGE_KEYS.settings,
    "/api/settings",
    DEFAULT_SETTINGS,
    mergeSettings,
  )
  return { settings, setSettings, status }
}

export const useInput = () => {
  const [input, setInput] = useLocalState(STORAGE_KEYS.input, "")
  return { input, setInput }
}

// Per-month manual adjustments, so each pay period is independent:
// { "2026-06": { ot: {id:hrs}, penalty: {id:amt}, bonus: {id:amt} } }
//  - ot:      authority-approved overtime hours (only these get paid)
//  - penalty: admin-entered amount subtracted from net pay
//  - bonus:   admin-entered amount added to net pay
const emptyMonth = () => ({
  ot: {},
  penalty: {},
  bonus: {},
  advance: {},
  leaveEarned: {},
  leaveSick: {},
})
const hasNewShape = (m) =>
  m && typeof m === "object" && ("ot" in m || "penalty" in m || "bonus" in m)

const migrateAdjustments = (stored) => {
  const wrap = (obj) =>
    Object.fromEntries(
      Object.entries(obj || {}).map(([month, v]) =>
        hasNewShape(v)
          ? [month, { ...emptyMonth(), ...v }]
          : [month, { ...emptyMonth(), ot: v || {} }],
      ),
    )
  if (stored && typeof stored === "object" && Object.keys(stored).length)
    return wrap(stored)
  // Fall back to the old approved-OT-only key, wrapping it into the new shape.
  try {
    const old = localStorage.getItem(STORAGE_KEYS.approvedOt)
    if (old) return wrap(JSON.parse(old))
  } catch {
    /* ignore */
  }
  return {}
}

export const useAdjustments = () => {
  const [adjustments, setAdjustments, status] = useSyncedState(
    STORAGE_KEYS.adjustments,
    "/api/adjustments",
    {},
    migrateAdjustments,
  )

  // Patch one field ("ot" | "penalty" | "bonus") of one month:
  // updater receives the previous {id: value} map and returns the new one.
  const updateMonth = useCallback(
    (monthKey, field, updater) => {
      if (!monthKey) return
      setAdjustments((prev) => {
        const month = prev[monthKey] || emptyMonth()
        return {
          ...prev,
          [monthKey]: { ...month, [field]: updater(month[field] || {}) },
        }
      })
    },
    [setAdjustments],
  )

  return { adjustments, updateMonth, status }
}
