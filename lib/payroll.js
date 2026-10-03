// Turns the attendance summary into payable amounts.
// Every assumption (per-day basis, OT rate, deduction policy) comes from
// settings and is surfaced in the UI so the accountant can audit the math.

export const perDayDivisor = (settings, period) => {
  switch (settings.perDayBasis) {
    case "fixed30":
      return 30
    case "calendar": {
      // days in the period's month (28–31), like the old accounts sheet
      const [y, m] = String(period.from || "").split("-").map(Number)
      return y && m ? new Date(y, m, 0).getDate() : 30
    }
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

export const buildPayroll = (
  summary,
  settings,
  period,
  adjustments = { ot: {}, penalty: {}, bonus: {} },
) => {
  const divisor = perDayDivisor(settings, period)
  const halfDeductFactor = 1 - (Number(settings.halfDayPayFactor) || 0)
  const otMap = adjustments.ot || {}
  const penaltyMap = adjustments.penalty || {}
  const bonusMap = adjustments.bonus || {}
  const advanceMap = adjustments.advance || {}
  const leaveEarnedMap = adjustments.leaveEarned || {}
  const leaveSickMap = adjustments.leaveSick || {}
  const leaveMonthlyMap = adjustments.leaveMonthly || {}

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
        ? Math.min(Number(otMap[s.id]) || 0, workedOtHours)
        : workedOtHours
      const otPay = approvedOtHours * otRate

      const isField = s.category === "field"

      // Paid leave (admin-allocated) covers absences, so only UNPAID absence
      // is deducted. Everyone has yearly earned + sick leave; field staff also
      // have a monthly bucket.
      const earnedTaken = Math.max(0, Number(leaveEarnedMap[s.id]) || 0)
      const sickTaken = Math.max(0, Number(leaveSickMap[s.id]) || 0)
      const monthlyTaken = isField ? Math.max(0, Number(leaveMonthlyMap[s.id]) || 0) : 0
      const paidLeaveDays = Math.min(s.absentDays, earnedTaken + sickTaken + monthlyTaken)
      const unpaidAbsentDays = Math.max(0, s.absentDays - paidLeaveDays)

      const absentDeduction = settings.deductAbsent
        ? unpaidAbsentDays * perDay
        : 0
      // half days = late-arrival half days + early leaves (office staff)
      const earlyHalfDays = s.earlyHalfDays || 0
      const halfDayDeduction = (s.halfDays + earlyHalfDays) * perDay * halfDeductFactor
      const lateDeductionDays = lateDeductionDaysFor(s.lateDays, settings)
      const lateDeduction = lateDeductionDays * perDay
      const totalDeductions = absentDeduction + halfDayDeduction + lateDeduction

      // Manual admin adjustments for this month.
      const penalty = Math.max(0, Number(penaltyMap[s.id]) || 0)
      const bonus = Math.max(0, Number(bonusMap[s.id]) || 0)
      const advance = Math.max(0, Number(advanceMap[s.id]) || 0)

      // Field workers: unused MONTHLY leave is paid out at one day's salary each.
      const unusedLeave = isField
        ? Math.max(0, (Number(settings.fieldLeavePerMonth) || 0) - monthlyTaken)
        : 0
      const leaveEncashment = unusedLeave * perDay
      // working a weekend / holiday pays one extra full day
      const holidayWorkedDays = settings.holidayWorkPay === false ? 0 : s.holidayWorkedDays || 0
      const holidayPay = holidayWorkedDays * perDay

      const netPayable =
        s.salary +
        otPay +
        holidayPay +
        bonus +
        leaveEncashment -
        totalDeductions -
        penalty -
        advance

      return {
        id: s.id,
        name: s.name,
        department: s.department,
        designation: s.designation,
        category: s.category,
        salary: s.salary,
        perDay,
        otRate,
        presentDays: s.presentDays,
        absentDays: s.absentDays,
        paidLeaveDays,
        unpaidAbsentDays,
        earnedTaken,
        sickTaken,
        monthlyTaken,
        unusedLeave,
        leaveEncashment,
        lateDays: s.lateDays,
        halfDays: s.halfDays,
        earlyHalfDays,
        holidayWorkedDays,
        holidayPay,
        workedOtHours,
        approvedOtHours,
        otPay,
        absentDeduction,
        halfDayDeduction,
        lateDeductionDays,
        lateDeduction,
        totalDeductions,
        penalty,
        bonus,
        advance,
        netPayable,
      }
    })

  const totals = rows.reduce(
    (t, r) => {
      t.salary += r.salary
      t.otPay += r.otPay
      t.totalDeductions += r.totalDeductions
      t.penalty += r.penalty
      t.bonus += r.bonus
      t.advance += r.advance
      t.leaveEncashment += r.leaveEncashment
      t.holidayPay += r.holidayPay
      t.netPayable += r.netPayable
      t.workedOtHours += r.workedOtHours
      t.approvedOtHours += r.approvedOtHours
      return t
    },
    {
      salary: 0,
      otPay: 0,
      totalDeductions: 0,
      penalty: 0,
      bonus: 0,
      advance: 0,
      leaveEncashment: 0,
      holidayPay: 0,
      netPayable: 0,
      workedOtHours: 0,
      approvedOtHours: 0,
    },
  )

  const pendingOtHours = totals.workedOtHours - totals.approvedOtHours

  return { rows, totals, divisor, excludedCount, pendingOtHours }
}
