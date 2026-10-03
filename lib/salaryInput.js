// Bridge: app data (employees, monthly adjustments, advances ledger,
// attendance records) → the input lib/salaryCalc.js + lib/salarySheet.js expect.
//
// Principle: data is captured where it happens and flows in automatically —
//   advance  ← advances ledger (instalment due this month)
//   absent / late / half-day ← attendance (machine staff), same rules as Payroll
//   penalty, bonus ← the same monthly inputs the Payroll page uses
//   overtime ← APPROVED hours only (same field the Payroll tab approves);
//              machine staff's worked hours are shown and cap the approval
//   leave    ← approved leave from the Leave tab (offsets absences)
// A value typed for the month always overrides the automatic one.
import { monthInfo } from "./salaryCalc.js"
import { lateDeductionDaysFor, perDayDivisor } from "./payroll.js"

const pad = (n) => String(n).padStart(2, "0")
const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key)

// Map raw machine punch IDs onto employee records via their `machineId`.
// An explicit machineId always wins; otherwise the punch keeps its raw ID
// (legacy behaviour, where the record key itself was the machine ID).
export const attributePunches = (punches, employees) => {
  const idx = {}
  for (const [key, e] of Object.entries(employees || {})) {
    const m = e && String(e.machineId ?? "").trim()
    if (m) idx[m] = key
  }
  if (!Object.keys(idx).length) return punches
  return punches.map((p) => {
    const k = idx[String(p.id)]
    return k != null ? { ...p, id: Number(k) } : p
  })
}

// Date range the pasted machine data covers ("" if none). (The salary sheet
// uses the Payroll period instead — see AppShell.)
export const machineCoverage = (punches) => {
  let from = ""
  let to = ""
  for (const p of punches || []) {
    if (p.source && p.source !== "machine") continue
    if (!from || p.date < from) from = p.date
    if (!to || p.date > to) to = p.date
  }
  return { from, to }
}

// ---- advances ledger -------------------------------------------------
// entry: { id, key, date, amount, months, startMonth: "YYYY-MM", note }
const addMonths = (month, k) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// [{ month, amount }] — equal instalments, the last one absorbs rounding.
export const advanceSchedule = (a) => {
  const amount = Math.max(0, Number(a.amount) || 0)
  const months = Math.max(1, Math.round(Number(a.months) || 1))
  const each = Math.round(amount / months)
  return Array.from({ length: months }, (_, i) => ({
    month: addMonths(a.startMonth, i),
    amount: i === months - 1 ? amount - each * (months - 1) : each,
  }))
}

export const advanceDue = (advances, key, month) =>
  (advances || [])
    .filter((a) => String(a.key) === String(key) && a.startMonth)
    .reduce(
      (sum, a) =>
        sum + advanceSchedule(a).filter((s) => s.month === month).reduce((x, s) => x + s.amount, 0),
      0,
    )

// Recovered through (and including) `month`, and what's left after it.
export const advanceProgress = (a, month) => {
  const sched = advanceSchedule(a)
  const recovered = sched.filter((s) => s.month <= month).reduce((x, s) => x + s.amount, 0)
  return {
    recovered,
    remaining: Math.max(0, (Number(a.amount) || 0) - recovered),
    lastMonth: sched[sched.length - 1]?.month,
  }
}

// ---- attendance-derived facts for one month --------------------------
// { [employeeKey]: { present:Set(iso), lates, halfs, otMinutes } }
const monthFacts = (records, month) => {
  const out = {}
  for (const r of records) {
    if (!r.date || !r.date.startsWith(month)) continue
    const f = (out[r.id] ||= { present: new Set(), lates: 0, halfs: 0, otMinutes: 0, sources: new Set() })
    f.present.add(r.date)
    for (const src of r.sources || ["machine"]) f.sources.add(src)
    if (r.status === "Late") f.lates++
    if (r.status === "Half Day") f.halfs++
    f.otMinutes += Number(r.otMinutes) || 0
  }
  return out
}

const byOrder = (a, b) =>
  (Number(a.e.sheetOrder) || 9999) - (Number(b.e.sheetOrder) || 9999) ||
  String(a.e.name).localeCompare(String(b.e.name))

// Returns { input, staffMeta, notOnSheet, ... }. staffMeta[i] tells the UI
// where each value came from so it can label auto vs edited numbers.
export function buildSalaryInput({
  month,
  employees = {},
  settings = {},
  adjustments = {},
  advances = [],
  records = [],
  coverage = { from: "", to: "" },
  today = new Date().toISOString().slice(0, 10),
}) {
  const mi = monthInfo(month)
  const adj = adjustments[month] || {}
  const num = (field, id) => Number((adj[field] || {})[id]) || 0
  const weekend = new Set(settings.weekendDays || [5])
  const holidays = new Set(settings.holidays || [])
  const facts = monthFacts(records, month)
  // Overtime rate rule — identical to the Payroll tab (Settings → Payroll).
  let workingDays = 0
  for (let d = 1; d <= mi.days; d++) {
    const iso = `${mi.y}-${pad(mi.m)}-${pad(d)}`
    const dow = new Date(Date.UTC(mi.y, mi.m - 1, d)).getUTCDay()
    if (!weekend.has(dow) && !holidays.has(iso)) workingDays++
  }
  const divisor = perDayDivisor(settings, { workingDays, from: `${month}-01` })
  const dayRule = {
    divisor,
    basis: settings.perDayBasis || "fixed30",
    deductAbsent: settings.deductAbsent !== false,
    halfDeduct: 1 - (Number(settings.halfDayPayFactor ?? 0.5) || 0),
  }
  const otRule = {
    method: settings.otMethod === "flat" ? "flat" : "salary",
    divisor,
    hoursPerDay: Number(settings.standardHoursPerDay) || 8,
    flatRate: Number(settings.otHourlyRate) || 0,
    approvalRequired: settings.otApprovalRequired !== false,
  }
  const factsFor = (key) => facts[Number(key)] || facts[key]

  const list = Object.entries(employees)
    .map(([key, e]) => ({ key, e }))
    .filter(({ e }) => e && e.active !== false)

  // advance: typed value for the month wins, else the ledger instalment
  const advanceOf = (key) => {
    if (has(adj.advance, key)) return { value: num("advance", key), src: "manual" }
    const due = advanceDue(advances, key, month)
    return { value: due, src: due ? "ledger" : "none" }
  }

  const staffMeta = []
  const staff = list
    .filter(({ e }) => e.payGroup === "staff")
    .sort(byOrder)
    .map(({ key, e }) => {
      const overrides = (adj.days || {})[key] || {}
      const f = factsFor(key)
      const isField = e.category === "field" // field staff have no weekend (as in Payroll)
      const hasData = !!f && f.present.size > 0
      // The admin's choice in Employees ("On machine") decides whose pay is
      // judged from attendance data; unticked staff stay manual (default P).
      const useData = !!e.onMachine && hasData
      const sources = []
      const natural = []
      let tracked = false
      const days = Array.from({ length: mi.days }, (_, i) => {
        const d = i + 1
        const iso = `${mi.y}-${pad(mi.m)}-${pad(d)}`
        const dow = new Date(Date.UTC(mi.y, mi.m - 1, d)).getUTCDay()
        const off = (!isField && weekend.has(dow)) || holidays.has(iso)
        const covered =
          useData && coverage.from && iso >= coverage.from && iso <= coverage.to && iso <= today
        if (covered) tracked = true
        let src = "default"
        let val = 1 // weekends/holidays are paid; manual staff default present
        if (covered && !off) {
          src = "data"
          val = f?.present.has(iso) ? 1 : 0
        }
        natural.push(val)
        if (overrides[d] != null) {
          sources.push("override")
          return Number(overrides[d])
        }
        sources.push(src)
        return val
      })

      // attendance-based deductions need punches → machine staff only
      const lates = tracked ? f?.lates || 0 : 0
      const halfs = tracked ? f?.halfs || 0 : 0
      const lateCutDays = lateDeductionDaysFor(lates, settings)

      // overtime: only approved hours are paid; for machine staff the
      // approval is capped at the hours they actually worked (as in Payroll)
      const workedOt = tracked ? (f?.otMinutes || 0) / 60 : 0
      const approvedOt = num("ot", key)
      const paidOt = otRule.approvalRequired
        ? tracked
          ? Math.min(approvedOt, workedOt)
          : approvedOt
        : tracked
          ? workedOt
          : approvedOt

      const advance = advanceOf(key)
      // everyone: yearly earned + sick; field staff also the monthly bucket,
      // whose UNUSED days are paid out at a day's pay (exactly like Payroll)
      const monthly = isField ? num("leaveMonthly", key) : 0
      const leave = num("leaveEarned", key) + num("leaveSick", key) + monthly
      const leaveEncashDays = isField
        ? Math.max(0, (Number(settings.fieldLeavePerMonth) || 0) - monthly)
        : 0

      staffMeta.push({
        key,
        sources,
        natural,
        onMachine: !!e.onMachine,
        isField,
        tracked,
        dataSources: f ? [...f.sources] : [],
        dataNotTicked: hasData && !e.onMachine,
        src: { advance: advance.src },
        workedOt,
        approvedOt,
        otCapped: otRule.approvalRequired && tracked && approvedOt > workedOt,
        ledgerAdvance: advanceDue(advances, key, month),
      })
      return {
        key,
        name: e.name,
        designation: e.designation || "",
        doj: e.joinDate || "",
        incRate: Number(e.incRate) || 0,
        incCount: Number(e.incCount) || 0,
        specialInc: Number(e.specialInc) || 0,
        salary: Number(e.salary) || 0,
        currentSalary: Number(e.salary) || 0,
        days,
        leave,
        leaveEncashDays,
        noWeekend: isField,
        lateDays: lates,
        lateCutDays,
        halfDays: halfs,
        workedOt,
        otHours: paidOt,
        otAdjust: num("otAdjust", key),
        bonus: num("bonus", key),
        penalty: num("penalty", key),
        advance: advance.value,
        ait: num("ait", key),
      }
    })

  const dirMeta = []
  const directors = list
    .filter(({ e }) => e.payGroup === "director")
    .sort(byOrder)
    .map(({ key, e }) => {
      const advance = advanceOf(key)
      dirMeta.push({ key, src: { advance: advance.src }, ledgerAdvance: advanceDue(advances, key, month) })
      return {
        key,
        name: e.name,
        designation: e.designation || "",
        incCount: Number(e.incCount) || 0,
        remuneration: Number(e.salary) || 0,
        ait: num("ait", key),
        advance: advance.value,
      }
    })

  const notOnSheet = list
    .filter(({ e }) => e.payGroup !== "staff" && e.payGroup !== "director")
    .map(({ key, e }) => ({ key, name: e.name, designation: e.designation || "", salary: Number(e.salary) || 0 }))

  return {
    input: {
      month,
      company: settings.company,
      split: settings.salarySplit,
      weekendDays: settings.weekendDays || [5],
      holidays: settings.holidays || [],
      preparedDate: today,
      otRule,
      dayRule,
      staff,
      directors,
    },
    staffMeta,
    dirMeta,
    notOnSheet,
    machineStaffWithoutData: staffMeta.filter((m) => m.onMachine && !m.tracked).length,
    // staff with attendance data this month who aren't ticked "On machine"
    dataNotTicked: staffMeta.filter((m) => m.dataNotTicked).map((m) => m.key),
  }
}
