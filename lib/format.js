// Pure formatting & small time helpers. No React, no state.

export const pad2 = (n) => String(n).padStart(2, "0")

// "HH:MM:SS" | "HH:MM" -> minutes since midnight (seconds dropped/floored).
export const timeToMinutes = (t) => {
  if (!t) return 0
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

// minutes since midnight -> "HH:MM"
export const minutesToClock = (min) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${pad2(m)}`
}

// minutes -> "8h 45m" (compact, for durations)
export const minutesToHM = (min) => {
  if (min == null || isNaN(min)) return "—"
  const sign = min < 0 ? "-" : ""
  const v = Math.abs(Math.round(min))
  const h = Math.floor(v / 60)
  const m = v % 60
  if (h === 0) return `${sign}${m}m`
  return `${sign}${h}h ${pad2(m)}m`
}

// "09:05:00" -> "9:05 AM"
export const formatTime12 = (t) => {
  if (!t) return "—"
  const [h = 0, m = 0] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hr = h % 12 || 12
  return `${hr}:${pad2(m)} ${ampm}`
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// Parse "YYYY-MM-DD" as a LOCAL date (avoids the UTC off-by-one of new Date(str)).
export const parseISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// Date -> "YYYY-MM-DD" using local fields (no timezone shift).
export const toISODate = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const weekdayName = (iso) => WEEKDAYS[parseISODate(iso).getDay()]

// "2026-06-01" -> "Mon, 01 Jun"
export const formatDate = (iso) => {
  if (!iso) return "—"
  const d = parseISODate(iso)
  return `${WEEKDAYS[d.getDay()]}, ${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`
}

// "2026-06-01" -> "01 Jun 2026"
export const formatDateLong = (iso) => {
  if (!iso) return "—"
  const d = parseISODate(iso)
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export const formatMoney = (n, currency = "৳") => {
  const v = Math.round(Number(n) || 0)
  return `${currency}${v.toLocaleString("en-US")}`
}

export const formatHours = (minutes) => {
  const h = (minutes || 0) / 60
  return `${h.toFixed(1)}h`
}

export const formatPercent = (v) => `${Math.round((v || 0) * 100)}%`
