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

export const buildPayroll = (summary, settings, period) => {
  const divisor = perDayDivisor(settings, period)
  const lateRate = Number(settings.lateDeductionPerDay) || 0
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
      const otPay = s.otHours * otRate
      const absentDeduction = settings.deductAbsent ? s.absentDays * perDay : 0
      const halfDayDeduction = s.halfDays * perDay * halfDeductFactor
      const lateDeduction = s.lateDays * lateRate
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
        otHours: s.otHours,
        otPay,
        absentDeduction,
        halfDayDeduction,
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
      t.otHours += r.otHours
      return t
    },
    { salary: 0, otPay: 0, totalDeductions: 0, netPayable: 0, otHours: 0 },
  )

  return { rows, totals, divisor, excludedCount }
}
