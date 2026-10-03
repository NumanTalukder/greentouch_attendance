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
export const paidLeaveDaysFor = (absentDays, earnedTaken, sickTaken, monthlyTaken = 0) =>
  Math.min(
    absentDays,
    (Number(earnedTaken) || 0) + (Number(sickTaken) || 0) + (Number(monthlyTaken) || 0),
  )

// Everyone (office AND field) gets the yearly earned + sick leave.
// Field staff ALSO get a monthly bucket (default 3) that resets every month;
// unused monthly days are paid out at a day's salary (see payroll).
export const buildLeave = (summary, adjustments, monthKey, settings) => {
  const range = leaveYearFor(monthKey, settings.leaveYearStartMonth)
  const entE = Number(settings.earnedLeavePerYear) || 0
  const entS = Number(settings.sickLeavePerYear) || 0
  const fieldMonthly = Number(settings.fieldLeavePerMonth) || 0
  const current = adjustments[monthKey] || {}

  const rows = summary
    .filter((s) => s.active || s.presentDays > 0)
    .map((s) => {
      const isField = s.category === "field"
      const earnedMonth = Number(current.leaveEarned?.[s.id]) || 0
      const sickMonth = Number(current.leaveSick?.[s.id]) || 0
      const monthUsed = isField ? Number(current.leaveMonthly?.[s.id]) || 0 : 0
      const earnedYTD = sumAcrossYear(adjustments, range, "leaveEarned", s.id)
      const sickYTD = sumAcrossYear(adjustments, range, "leaveSick", s.id)
      const paidLeave = paidLeaveDaysFor(s.absentDays, earnedMonth, sickMonth, monthUsed)
      const monthLeft = isField ? Math.max(0, fieldMonthly - monthUsed) : 0

      return {
        id: s.id,
        name: s.name,
        department: s.department,
        designation: s.designation,
        category: s.category,
        absentDays: s.absentDays,
        earnedMonth,
        sickMonth,
        earnedYTD,
        sickYTD,
        entE,
        entS,
        earnedUsed: earnedYTD,
        earnedLeft: entE - earnedYTD,
        sickLeft: entS - sickYTD,
        // field-only monthly bucket
        monthEnt: isField ? fieldMonthly : 0,
        monthUsed,
        monthLeft,
        unusedLeave: monthLeft,
        paidLeave,
        unpaidAbsent: Math.max(0, s.absentDays - paidLeave),
      }
    })

  return { rows, range, entE, entS, fieldMonthly }
}
