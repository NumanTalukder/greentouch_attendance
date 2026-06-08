// Turns the attendance summary into payable amounts.
// Every assumption (per-day basis, OT rate, deduction policy) comes from
// settings and is surfaced in the UI so the accountant can audit the math.

export const perDayDivisor = (settings, period) => {
  switch (settings.perDayBasis) {
    case "fixed30":
      return 30
    case "fixed26":
      return 26
    case "working":
    default:
      return period.workingDays > 0 ? period.workingDays : 26
  }
}

// Overtime hourly rate for one employee.
//  - "salary"  → company rule: salary ÷ (days-per-month × hours-per-day).
//               i.e. the employee's own normal hourly wage.
//  - "flat"    → a fixed rate that's the same for everyone.
export const otHourlyRateFor = (salary, settings, divisor) => {
  if (settings.otMethod === "flat") return Number(settings.otHourlyRate) || 0
  const hoursPerDay = Number(settings.standardHoursPerDay) || 8
  return salary > 0 ? salary / (divisor * hoursPerDay) : 0
}

// Late-arrival deduction: every `lateGroupSize` late days costs one day's pay,
// so the first (lateGroupSize - 1) lates are graced. e.g. with 4: 0–3 lates = 0,
// 4–7 = 1 day, 8–11 = 2 days …
export const lateDeductionDaysFor = (lateDays, settings) => {
  const n = Number(settings.lateGroupSize) || 0
  return n > 0 ? Math.floor(lateDays / n) : 0
}

export const buildPayroll = (summary, settings, period, approvedOt = {}) => {
  const divisor = perDayDivisor(settings, period)
  const halfDeductFactor = 1 - (Number(settings.halfDayPayFactor) || 0)

  // Only pay employees who actually have attendance this period. Active staff
  // with zero punches are excluded (and counted) rather than paid a full,
  // un-deducted salary on no data.
  const excludedCount = summary.filter(
    (s) => s.active && s.presentDays === 0,
  ).length

  const rows = summary
    .filter((s) => s.presentDays > 0)
    .map((s) => {
      const perDay = s.salary > 0 ? s.salary / divisor : 0
      const otRate = otHourlyRateFor(s.salary, settings, divisor)

      // Worked OT comes from the punches; only approved OT is paid (unless
      // approval is switched off, in which case all worked OT is paid).
      const workedOtHours = s.otHours
      const approvedOtHours = settings.otApprovalRequired
        ? Math.min(Number(approvedOt[s.id]) || 0, workedOtHours)
        : workedOtHours
      const otPay = approvedOtHours * otRate

      const absentDeduction = settings.deductAbsent ? s.absentDays * perDay : 0
      const halfDayDeduction = s.halfDays * perDay * halfDeductFactor
      const lateDeductionDays = lateDeductionDaysFor(s.lateDays, settings)
      const lateDeduction = lateDeductionDays * perDay
      const totalDeductions = absentDeduction + halfDayDeduction + lateDeduction
      const netPayable = s.salary + otPay - totalDeductions

      return {
        id: s.id,
        name: s.name,
        department: s.department,
        designation: s.designation,
        salary: s.salary,
        perDay,
        otRate,
        presentDays: s.presentDays,
        absentDays: s.absentDays,
        lateDays: s.lateDays,
        halfDays: s.halfDays,
        workedOtHours,
        approvedOtHours,
        otPay,
        absentDeduction,
        halfDayDeduction,
        lateDeductionDays,
        lateDeduction,
        totalDeductions,
        netPayable,
      }
    })

  const totals = rows.reduce(
    (t, r) => {
      t.salary += r.salary
      t.otPay += r.otPay
      t.totalDeductions += r.totalDeductions
      t.netPayable += r.netPayable
      t.workedOtHours += r.workedOtHours
      t.approvedOtHours += r.approvedOtHours
      return t
    },
    {
      salary: 0,
      otPay: 0,
      totalDeductions: 0,
      netPayable: 0,
      workedOtHours: 0,
      approvedOtHours: 0,
    },
  )

  const pendingOtHours = totals.workedOtHours - totals.approvedOtHours

  return { rows, totals, divisor, excludedCount, pendingOtHours }
}
