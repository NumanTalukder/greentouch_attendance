// Distance + timezone helpers for geofenced check-in. Server-side.

// Great-circle distance between two lat/lng points, in metres.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// GreenTouch runs on Asia/Dhaka (UTC+6, no DST).
const DHAKA_OFFSET_MIN = 6 * 60

// A server timestamp as Dhaka wall-clock { date: "YYYY-MM-DD", time: "HH:MM:SS" }.
// Used to turn app check-in/out into punches the attendance engine understands.
export function dhakaDateTime(date) {
  const s = new Date(date.getTime() + DHAKA_OFFSET_MIN * 60 * 1000)
  const p = (n) => String(n).padStart(2, "0")
  return {
    date: `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())}`,
    time: `${p(s.getUTCHours())}:${p(s.getUTCMinutes())}:${p(s.getUTCSeconds())}`,
  }
}

// The work day a server timestamp belongs to, in Dhaka time, honouring a
// pre-dawn boundary (a 2 AM punch still counts for the previous work day).
export function workDateDhaka(date, boundaryHour = 5) {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MIN * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  const base = new Date(Date.UTC(y, m, d))
  if (shifted.getUTCHours() < boundaryHour) base.setUTCDate(base.getUTCDate() - 1)
  return base.toISOString().slice(0, 10)
}
