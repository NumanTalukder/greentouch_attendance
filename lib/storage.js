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
// `autoPut: false` → setValue only updates locally; the caller sends its own
// fine-grained PATCHes (used where several people edit the same data).
const useSyncedState = (localKey, endpoint, initial, reviver, { autoPut = true } = {}) => {
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
          if (hasData(json.data) || json.exists) {
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
      if (!autoPut) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => put(resolved), 700)
    },
    [setLocal, put, autoPut],
  )

  // Adopt the latest server copy (e.g. when the tab regains focus).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      const json = await res.json()
      if (json && json.ok && (hasData(json.data) || json.exists)) {
        const next = reviver ? reviver(json.data) : json.data
        valueRef.current = next
        setLocal(next)
        setStatus("synced")
      }
    } catch {
      /* stay on the local copy */
    }
  }, [endpoint, reviver, setLocal])

  return [value, setValue, status, refresh, setStatus]
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

// Employees: only changed fields of changed people are sent; deletions are
// explicit. A stale browser can't undo others' edits or drop new employees.
export const useEmployees = () => {
  const [employees, setLocal, status, refresh, setStatus] = useSyncedState(
    STORAGE_KEYS.employees,
    "/api/employees",
    DEFAULT_EMPLOYEES,
    migrateEmployees,
    { autoPut: false },
  )
  const { enqueue, drop } = usePatchQueue("/api/employees", setStatus, refresh)
  const setEmployees = useCallback(
    (next) =>
      setLocal((prev) => {
        const before = prev || {}
        const after = (typeof next === "function" ? next(before) : next) || {}
        for (const [id, e] of Object.entries(after)) {
          const was = before[id]
          if (!was) {
            drop(`e|${id}|`)
            enqueue(`e|${id}|*`, { op: "upsert", id, fields: e })
            continue
          }
          for (const f of new Set([...Object.keys(was), ...Object.keys(e || {})]))
            if (JSON.stringify(was[f]) !== JSON.stringify(e?.[f]))
              enqueue(`e|${id}|${f}`, { op: "upsert", id, fields: { [f]: e?.[f] ?? null } })
        }
        for (const id of Object.keys(before))
          if (!(id in after)) {
            drop(`e|${id}|`)
            enqueue(`e|${id}|*`, { op: "remove", id })
          }
        return after
      }),
    [setLocal, enqueue, drop],
  )
  return { employees, setEmployees, status }
}

// Settings: only the rules that changed are sent.
export const useSettings = () => {
  const [settings, setLocal, status, refresh, setStatus] = useSyncedState(
    STORAGE_KEYS.settings,
    "/api/settings",
    DEFAULT_SETTINGS,
    mergeSettings,
    { autoPut: false },
  )
  const { enqueue } = usePatchQueue("/api/settings", setStatus, refresh)
  const setSettings = useCallback(
    (next) =>
      setLocal((prev) => {
        const before = prev || {}
        const after = (typeof next === "function" ? next(before) : next) || {}
        for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
          if (JSON.stringify(before[k]) !== JSON.stringify(after[k]))
            enqueue(`s|${k}`, { key: k, value: after[k] ?? null })
        return after
      }),
    [setLocal, enqueue],
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
  leaveMonthly: {}, // field staff: days of the monthly (3/mo) leave taken
  // salary sheet (accounts' workbook)
  ait: {}, // {id: amount}
  otDays: {}, // {id: extra days worked}
  otAdjust: {}, // {id: +/- amount}
  days: {}, // {id: {dayOfMonth: 0|1|0.5}} manual attendance overrides
  corrections: {}, // {id: {dayOfMonth: {onTime, excuseEarly, present, note}}} machine-fault fixes
  holidayWork: {}, // {id: {dayOfMonth: 1}} manual staff who worked a weekend/holiday
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

// Sends queued fine-grained changes; keeps them queued (and retries) if the
// network is down, and pulls the server copy back in when the tab regains focus.
const usePatchQueue = (endpoint, setStatus, refresh) => {
  const queue = useRef(new Map())
  const timer = useRef(null)
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const ops = [...queue.current.values()]
    if (!ops.length) return
    queue.current = new Map()
    setStatus("saving")
    fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ops),
    })
      .then((r) => {
        if (r.status === 401) window.location.href = "/login"
        return r.json()
      })
      .then((j) => {
        if (!j || !j.ok) throw new Error("rejected")
        setStatus("synced")
      })
      .catch(() => {
        // put them back (newer queued values for the same slot win) and retry
        for (const [k, o] of ops.map((o) => [o.__k, o])) if (!queue.current.has(k)) queue.current.set(k, o)
        setStatus("offline")
        timer.current = setTimeout(flush, 5000)
      })
  }, [endpoint, setStatus])
  const enqueue = useCallback(
    (k, op) => {
      queue.current.set(k, { ...op, __k: k })
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    },
    [flush],
  )
  // forget queued changes for one record (e.g. it was deleted before saving)
  const drop = useCallback((prefix) => {
    for (const k of [...queue.current.keys()]) if (k.startsWith(prefix)) queue.current.delete(k)
  }, [])
  useEffect(() => {
    const onFocus = () => {
      if (!queue.current.size) refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])
  return { enqueue, drop }
}

export const useAdjustments = () => {
  const [adjustments, setAdjustments, status, refresh, setStatus] = useSyncedState(
    STORAGE_KEYS.adjustments,
    "/api/adjustments",
    {},
    migrateAdjustments,
    { autoPut: false },
  )
  const { enqueue } = usePatchQueue("/api/adjustments", setStatus, refresh)

  // Patch one field of one month: updater receives the previous {id: value}
  // map and returns the new one. Only the ids whose value changed are sent.
  const updateMonth = useCallback(
    (monthKey, field, updater) => {
      if (!monthKey) return
      setAdjustments((prev) => {
        const month = prev[monthKey] || emptyMonth()
        const before = month[field] || {}
        const after = updater(before)
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
          const had = Object.prototype.hasOwnProperty.call(after, key)
          if (!had) enqueue(`${monthKey}|${field}|${key}`, { month: monthKey, field, key, value: null })
          else if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
            enqueue(`${monthKey}|${field}|${key}`, { month: monthKey, field, key, value: after[key] })
        }
        return { ...prev, [monthKey]: { ...month, [field]: after } }
      })
    },
    [setAdjustments, enqueue],
  )

  return { adjustments, updateMonth, status }
}

// Advances ledger — each advance is recorded once when given; its monthly
// instalments then flow into the salary sheet automatically.
const asList = (stored) => (Array.isArray(stored) ? stored : [])

export const useAdvances = () => {
  const [advances, setLocalAdvances, status, refresh, setStatus] = useSyncedState(
    STORAGE_KEYS.advances,
    "/api/advances",
    [],
    asList,
    { autoPut: false },
  )
  const { enqueue } = usePatchQueue("/api/advances", setStatus, refresh)
  // Same API as before (value or updater), but only added / changed / removed
  // advances are sent — by id.
  const setAdvances = useCallback(
    (next) =>
      setLocalAdvances((prev) => {
        const before = prev || []
        const after = (typeof next === "function" ? next(before) : next) || []
        const was = new Map(before.map((a) => [a.id, a]))
        const now = new Map(after.map((a) => [a.id, a]))
        for (const [id, a] of now)
          if (JSON.stringify(was.get(id)) !== JSON.stringify(a)) enqueue(`u|${id}`, { op: "upsert", item: a })
        for (const id of was.keys()) if (!now.has(id)) enqueue(`u|${id}`, { op: "remove", id })
        return after
      }),
    [setLocalAdvances, enqueue],
  )
  return { advances, setAdvances, status }
}
