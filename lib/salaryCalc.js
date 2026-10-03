// Pure salary maths for the accounts' month-end sheet (no Excel dependency,
// so the in-app preview stays light; lib/salarySheet.js adds the .xlsx layer).
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
export const WD = ["S", "M", "T", "W", "T", "F", "S"]

export const monthInfo = (month) => {
  const [y, m] = month.split("-").map(Number)
  const days = new Date(y, m, 0).getDate()
  return {
    y, m, days,
    label: `${MONTHS[m - 1]}-${y}`,
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m - 1, days)),
  }
}
// Mirrors the Payroll page exactly (lib/payroll.js):
//   net = gross + OT pay + bonus + leave encashment − (absent + late + half-day)
//         − penalty − advance − AIT
// per-day rate = gross ÷ dayRule.divisor  (Settings → per-day basis)
// OT pay       = approved hours × hourly rate (Settings → OT method)
export function computeSalary(input) {
  const { days } = monthInfo(input.month)
  const sp = input.split
  const rule = input.otRule || { method: "salary", divisor: 30, hoursPerDay: 8 }
  // no dayRule = legacy accounts sheet (calendar days, absences deducted)
  const dr = input.dayRule || { divisor: days, deductAbsent: true, halfDeduct: 0.5 }
  const div = Number(dr.divisor) || days
  const halfDeduct = dr.halfDeduct ?? 0.5
  const staff = (input.staff || []).map((s) => {
    const grid = Array.from({ length: days }, (_, i) =>
      s.days && s.days[i] != null ? Number(s.days[i]) : 1,
    )
    const present = grid.reduce((a, b) => a + b, 0)
    const absentDays = Math.max(0, days - present)
    // approved paid leave (Leave tab) covers absences; only the rest is unpaid
    const leaveDays = Math.min(Math.max(0, Number(s.leave) || 0), absentDays)
    const lwpDays = absentDays - leaveDays
    const salary = Number(s.salary) || 0
    const basic = salary * sp.basic
    const house = salary * sp.house
    const medical = salary * sp.medical
    const conveyance = salary * sp.conveyance
    const gross = basic + house + medical + conveyance
    const rate = gross / div // one day's pay
    const lwp = dr.deductAbsent ? lwpDays * rate : 0
    const lateCutDays = Number(s.lateCutDays) || 0 // e.g. every 4 lates = 1 day
    const late = lateCutDays * rate
    const halfDays = Number(s.halfDays) || 0
    const half = halfDays * halfDeduct * rate
    const ait = Number(s.ait) || 0
    const advance = Number(s.advance) || 0
    const penalty = Number(s.penalty) || 0
    const bonus = Number(s.bonus) || 0
    const encashDays = Number(s.leaveEncashDays) || 0 // field: unused monthly leave
    const encash = encashDays * rate
    const attendanceDed = lwp + late + half
    const totalDed = attendanceDed + penalty + advance + ait
    const cuInc = (Number(s.incCount) || 0) * 1.5
    const basicInc = (Number(s.incRate) || 0) * cuInc
    // overtime = approved hours × hourly rate (+ rare manual adjustment)
    const otHours = Number(s.otHours) || 0
    const otRate =
      rule.method === "flat"
        ? Number(rule.flatRate) || 0
        : salary / ((Number(rule.divisor) || 30) * (Number(rule.hoursPerDay) || 8))
    const ot = otRate * otHours
    const otAdjust = Number(s.otAdjust) || 0
    const otPay = ot + otAdjust
    return {
      ...s, grid, present, absentDays, leaveDays, lwpDays,
      basic, house, medical, conveyance, gross, rate,
      lwp, lateCutDays, late, halfDays, half, attendanceDed,
      ait, advance, penalty, bonus, encashDays, encash, totalDed,
      cuInc, basicInc, totalInc: basicInc + (Number(s.specialInc) || 0),
      otHours, otRate, ot, otAdjust, otPay, otNet: otPay,
      net: gross + otPay + bonus + encash - totalDed,
    }
  })
  const directors = (input.directors || []).map((d) => {
    const rem = Number(d.remuneration) || 0
    const basic = rem * sp.basic
    const house = rem * sp.house
    const medical = rem * sp.medical
    const conveyance = rem * sp.conveyance
    const gross = basic + house + medical + conveyance
    const ait = Number(d.ait) || 0
    const advance = Number(d.advance) || 0
    const incRate = basic / 30
    const cuInc = (Number(d.incCount) || 0) * 1.5
    return {
      ...d, basic, house, medical, conveyance, gross, ait, advance,
      totalDed: ait + advance, net: gross - ait - advance,
      incRate, cuInc, totalInc: incRate * cuInc,
    }
  })
  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0)
  const otRows = staff.filter((s) => s.otHours || s.otAdjust)
  return {
    days,
    staff,
    directors,
    otRows,
    totals: {
      staffGross: sum(staff, "gross"),
      staffDed: sum(staff, "totalDed"),
      staffNet: sum(staff, "net"),
      otPay: sum(staff, "otPay"),
      ot: sum(staff, "ot"),
      otAdjust: sum(staff, "otAdjust"),
      otNet: sum(staff, "otPay"),
      bonus: sum(staff, "bonus"),
      encash: sum(staff, "encash"),
      lwp: sum(staff, "lwp"),
      late: sum(staff, "late"),
      half: sum(staff, "half"),
      penalty: sum(staff, "penalty"),
      advance: sum(staff, "advance") + sum(directors, "advance"),
      ait: sum(staff, "ait") + sum(directors, "ait"),
      dirGross: sum(directors, "gross"),
      dirDed: sum(directors, "totalDed"),
      dirNet: sum(directors, "net"),
    },
  }
}

export const salaryFileName = (month) =>
  `Salary+Remuneration. ${monthInfo(month).label}.xlsx`
