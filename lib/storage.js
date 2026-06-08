"use client"

import { useCallback, useEffect, useState } from "react"
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

export const useEmployees = () => {
  const [employees, setEmployees, hydrated] = useLocalState(
    STORAGE_KEYS.employees,
    DEFAULT_EMPLOYEES,
    migrateEmployees,
  )
  return { employees, setEmployees, hydrated }
}

export const useSettings = () => {
  // Merge stored settings over defaults so new keys appear after upgrades.
  const [settings, setSettings, hydrated] = useLocalState(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
    (stored) => ({ ...DEFAULT_SETTINGS, ...(stored || {}) }),
  )
  return { settings, setSettings, hydrated }
}

export const useInput = () => {
  const [input, setInput] = useLocalState(STORAGE_KEYS.input, "")
  return { input, setInput }
}

// Authority-approved overtime hours, kept per month so each pay period is
// independent: { "2026-06": { "2": 1.5, "5": 2 } }.
export const useApprovedOt = () => {
  const [approved, setApproved] = useLocalState(STORAGE_KEYS.approvedOt, {})

  // Update one month's map with a patch function: prevMonthMap => newMonthMap.
  const updateMonth = useCallback(
    (monthKey, updater) => {
      if (!monthKey) return
      setApproved((prev) => ({
        ...prev,
        [monthKey]: updater(prev[monthKey] || {}),
      }))
    },
    [setApproved],
  )

  return { approved, updateMonth }
}
