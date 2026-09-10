// Paid-leave entitlement & balances. Leave is admin-allocated per month (how
// many earned / sick days each employee actually took, from leave applications),
// then summed across the leave year (default July→June) to show remaining balance.
// Paid leave reduces the *unpaid* absence that payroll deducts.

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const pad = (n) => String(n).padStart(2, "0")

// The leave year that a given "YYYY-MM" falls in.
export const leaveYearFor = (monthKey, startMonth = 7) => {
  if (!monthKey) return null
  const [y, m] = monthKey.split("-").map(Number)
  const startYear = m >= startMonth ? y : y - 1
  const endMonth = startMonth === 1 ? 12 : startMonth - 1
  const endYear = startMonth === 1 ? startYear : startYear + 1
  return {
    start: `${startYear}-${pad(startMonth)}`,
    end: `${endYear}-${pad(endMonth)}`,
    label: `${MONTHS[startMonth - 1]} ${startYear} – ${MONTHS[endMonth - 1]} ${endYear}`,
  }
}

// Sum a leave field ("leaveEarned" | "leaveSick") for one employee across all
// stored months within [start, end] (string compare works for YYYY-MM).
const sumAcrossYear = (adjustments, range, field, id) => {
  if (!range) return 0
  let total = 0
  for (const [month, data] of Object.entries(adjustments || {})) {
    if (month >= range.start && month <= range.end) {
      total += Number(data?.[field]?.[id]) || 0
    }
  }
  return total
}

// Paid-leave days actually usable against this month's absences.
export const paidLeaveDaysFor = (absentDays, earnedTaken, sickTaken) =>
  Math.min(absentDays, (Number(earnedTaken) || 0) + (Number(sickTaken) || 0))

export const buildLeave = (summary, adjustments, monthKey, settings) => {
  const range = leaveYearFor(monthKey, settings.leaveYearStartMonth)
  const entE = Number(settings.earnedLeavePerYear) || 0
  const entS = Number(settings.sickLeavePerYear) || 0
  const current = adjustments[monthKey] || {}

  const rows = summary
    .filter((s) => s.active || s.presentDays > 0)
    .map((s) => {
      const earnedMonth = Number(current.leaveEarned?.[s.id]) || 0
      const sickMonth = Number(current.leaveSick?.[s.id]) || 0
      const earnedYTD = sumAcrossYear(adjustments, range, "leaveEarned", s.id)
      const sickYTD = sumAcrossYear(adjustments, range, "leaveSick", s.id)
      const paidLeave = paidLeaveDaysFor(s.absentDays, earnedMonth, sickMonth)
      return {
        id: s.id,
        name: s.name,
        department: s.department,
        designation: s.designation,
        absentDays: s.absentDays,
        earnedMonth,
        sickMonth,
        earnedYTD,
        sickYTD,
        earnedLeft: entE - earnedYTD,
        sickLeft: entS - sickYTD,
        paidLeave,
        unpaidAbsent: Math.max(0, s.absentDays - paidLeave),
      }
    })

  return { rows, range, entE, entS }
}
