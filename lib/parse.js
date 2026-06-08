// Robust parser for raw machine (ZKTeco) punch logs.
//
// Each meaningful line carries an employee ID, a date, and a time. Real exports
// vary: extra columns, tabs, different date orders, AM/PM. We detect tokens by
// shape rather than fixed positions, so "2  2026-06-01  09:02:11" and messier
// variants both work. One line = one punch (check-in or check-out event).

import { pad2 } from "./format"

const DATE_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/ // YYYY-MM-DD
const DATE_RE_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/ // DD-MM-YYYY
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

const normalizeDate = (tok) => {
  let m = tok.match(DATE_RE)
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`
  m = tok.match(DATE_RE_DMY)
  if (m) return `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}` // assume DD-MM-YYYY
  return null
}

const normalizeTime = (tok, ampm) => {
  const m = tok.match(TIME_RE)
  if (!m) return null
  let h = +m[1]
  const min = +m[2]
  const sec = m[3] ? +m[3] : 0
  if (h > 23 || min > 59 || sec > 59) return null
  if (ampm) {
    if (/pm/i.test(ampm) && h < 12) h += 12
    if (/am/i.test(ampm) && h === 12) h = 0
  }
  return `${pad2(h)}:${pad2(min)}:${pad2(sec)}`
}

export const parseInputData = (input) => {
  if (!input || typeof input !== "string") return []
  const out = []

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    // Split on whitespace, commas, tabs, or semicolons.
    const tokens = line.split(/[\s,;\t]+/).filter(Boolean)
    if (tokens.length < 3) continue

    let date = null
    let time = null
    let ampm = null
    const leftover = []

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      if (!date) {
        const d = normalizeDate(tok)
        if (d) {
          date = d
          continue
        }
      }
      if (!time && TIME_RE.test(tok)) {
        // peek for a trailing AM/PM marker
        const next = tokens[i + 1]
        if (next && /^(am|pm)$/i.test(next)) ampm = next
        const t = normalizeTime(tok, ampm)
        if (t) {
          time = t
          continue
        }
      }
      leftover.push(tok)
    }

    // ID = first purely-numeric leftover token (the machine user id).
    const idTok = leftover.find((t) => /^\d+$/.test(t))
    if (!idTok || !date || !time) continue

    out.push({ id: parseInt(idTok, 10), date, time })
  }

  return out
}

// Quick stats for the paste panel without running the whole engine.
export const inputStats = (punches) => {
  if (!punches.length) return { rows: 0, employees: 0, from: null, to: null }
  let from = punches[0].date
  let to = punches[0].date
  const ids = new Set()
  for (const p of punches) {
    ids.add(p.id)
    if (p.date < from) from = p.date
    if (p.date > to) to = p.date
  }
  return { rows: punches.length, employees: ids.size, from, to }
}
