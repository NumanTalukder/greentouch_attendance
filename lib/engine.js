// The attendance engine: raw punches -> daily records -> per-employee summary.
// Pure functions, driven entirely by `settings` so rules are never hard-coded.

import {
  timeToMinutes,
  parseISODate,
  toISODate,
  weekdayName,
} from "./format"

export const STATUS = {
  PRESENT: "Present",
  LATE: "Late",
  HALF: "Half Day",
  INCOMPLETE: "Incomplete",
  ABSENT: "Absent",
}

const employeeName = (employees, id) =>
  employees[id]?.name || `Unknown #${id}`

// Punches before the day boundary (e.g. 5 AM) belong to the previous work day,
// so a 1 AM checkout is credited to the shift that started the evening before.
const resolveWorkDate = (date, time, boundaryMin) => {
  if (timeToMinutes(time) >= boundaryMin) return date
  const d = parseISODate(date)
  d.setDate(d.getDate() - 1)
  return toISODate(d)
}

const isWeekend = (iso, weekendDays) =>
  weekendDays.includes(parseISODate(iso).getDay())

const isHoliday = (iso, holidays) => holidays.includes(iso)

// Count scheduled working days in [startIso, endIso] inclusive.
export const workingDaysBetween = (startIso, endIso, settings) => {
  if (!startIso || !endIso || startIso > endIso) return 0
  let count = 0
  const cur = parseISODate(startIso)
  const end = parseISODate(endIso)
  while (cur <= end) {
    const iso = toISODate(cur)
    if (
      !isWeekend(iso, settings.weekendDays) &&
      !isHoliday(iso, settings.holidays)
    )
      count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// Group punches by employee + work day and classify each day.
export const buildDailyRecords = (punches, settings, employees) => {
  const start = timeToMinutes(settings.officeStart)
  const end = timeToMinutes(settings.officeEnd)
  const grace = Number(settings.graceMinutes) || 0
  const lateAfter = start + grace
  const halfAfter = timeToMinutes(settings.halfDayStart)
  const otStart = timeToMinutes(settings.otStart)
  const otThreshold = timeToMinutes(settings.otThreshold)
  const boundary = timeToMinutes(settings.dayBoundary)
  const standardMinutes = Math.max(0, end - start)

  const groups = {}
  for (const p of punches) {
    const date = resolveWorkDate(p.date, p.time, boundary)
    const key = `${p.id}|${date}`
    if (!groups[key]) groups[key] = { id: p.id, date, times: [] }
    groups[key].times.push(p.time)
  }

  return Object.values(groups).map((g) => {
    const times = g.times.slice().sort() // "HH:MM:SS" sorts lexically == chronologically
    const first = times[0]
    const last = times[times.length - 1]
    const firstMin = timeToMinutes(first)
    const lastMin = timeToMinutes(last)
    const punchCount = times.length
    const incomplete = punchCount < 2
    const workMinutes = incomplete ? 0 : Math.max(0, lastMin - firstMin)

    let status
    if (incomplete) status = STATUS.INCOMPLETE
    else if (firstMin > halfAfter) status = STATUS.HALF
    else if (firstMin > lateAfter) status = STATUS.LATE
    else status = STATUS.PRESENT

    const isLate = status === STATUS.LATE
    const isHalf = status === STATUS.HALF
    const lateMinutes = isLate || isHalf ? Math.max(0, firstMin - lateAfter) : 0
    const leftEarly = !incomplete && lastMin < end
    const earlyMinutes = leftEarly ? end - lastMin : 0
    const otMinutes = !incomplete && lastMin > otStart ? lastMin - otStart : 0
    const stayedLate = !incomplete && lastMin > otThreshold
    const undertime =
      incomplete || status === STATUS.HALF
        ? 0
        : Math.max(0, standardMinutes - workMinutes)

    const emp = employees[g.id]
    return {
      id: g.id,
      name: employeeName(employees, g.id),
      department: emp?.department || "—",
      designation: emp?.designation || "—",
      known: !!emp,
      date: g.date,
      weekday: weekdayName(g.date),
      first,
      last,
      firstMin,
      lastMin,
      punchCount,
      incomplete,
      status,
      isLate,
      isHalf,
      lateMinutes,
      leftEarly,
      earlyMinutes,
      otMinutes,
      stayedLate,
      workMinutes,
      undertime,
    }
  })
}

// The pasted data's date span — drives "absent" math and report headers.
export const getPeriod = (records, settings) => {
  if (!records.length) return { from: null, to: null, workingDays: 0 }
  let from = records[0].date
  let to = records[0].date
  for (const r of records) {
    if (r.date < from) from = r.date
    if (r.date > to) to = r.date
  }
  return { from, to, workingDays: workingDaysBetween(from, to, settings) }
}

// Per-employee monthly summary. Includes active employees with NO punches
// (fully absent) so the owner can see who never showed up.
export const buildSummary = (records, settings, employees, period) => {
  const map = {}

  const ensure = (id) => {
    if (!map[id]) {
      const emp = employees[id]
      map[id] = {
        id: Number(id),
        name: employeeName(employees, id),
        department: emp?.department || "—",
        designation: emp?.designation || "—",
        salary: emp?.salary || 0,
        joinDate: emp?.joinDate || "",
        active: emp ? emp.active !== false : true,
        known: !!emp,
        presentDays: 0,
        onTimeDays: 0,
        lateDays: 0,
        halfDays: 0,
        incompleteDays: 0,
        leftEarlyDays: 0,
        stayedLateDays: 0,
        workMinutes: 0,
        otMinutes: 0,
        lateMinutes: 0,
        dates: new Set(),
      }
    }
    return map[id]
  }

  for (const r of records) {
    const s = ensure(r.id)
    s.dates.add(r.date)
    s.presentDays++
    s.workMinutes += r.workMinutes
    s.otMinutes += r.otMinutes
    s.lateMinutes += r.lateMinutes
    if (r.status === STATUS.PRESENT) s.onTimeDays++
    if (r.isLate) s.lateDays++
    if (r.isHalf) s.halfDays++
    if (r.incomplete) s.incompleteDays++
    if (r.leftEarly) s.leftEarlyDays++
    if (r.stayedLate) s.stayedLateDays++
  }

  // Add active employees who never punched in during the period.
  for (const id of Object.keys(employees)) {
    if (employees[id].active !== false) ensure(id)
  }

  const rows = Object.values(map).map((s) => {
    // Expected working days, respecting a mid-period join date.
    const effFrom =
      s.joinDate && s.joinDate > period.from ? s.joinDate : period.from
    const expected =
      effFrom && effFrom <= period.to
        ? workingDaysBetween(effFrom, period.to, settings)
        : 0

    // Only compute absence for employees who actually appear in the data.
    // Punch logs can't tell "absent all month" from "not employed / on leave",
    // so a zero-punch active employee is flagged (noData), never auto-penalised.
    const noData = s.presentDays === 0
    const absentDays = noData ? 0 : Math.max(0, expected - s.presentDays)
    const scheduledDays = Math.max(s.presentDays, absentDays + s.presentDays)
    const attendanceRate = noData
      ? null
      : scheduledDays > 0
        ? s.presentDays / scheduledDays
        : 0
    const avgWorkMinutes =
      s.presentDays > 0 ? Math.round(s.workMinutes / s.presentDays) : 0

    return {
      ...s,
      dates: undefined,
      noData,
      expectedDays: expected,
      absentDays,
      attendanceRate,
      avgWorkMinutes,
      otHours: s.otMinutes / 60,
    }
  })

  return rows.sort((a, b) => a.id - b.id)
}

// Company-wide roll-up for the dashboard.
export const buildDashboard = (records, summary, period) => {
  const totals = {
    employees: summary.filter((s) => s.presentDays > 0 || s.active).length,
    activeWithData: summary.filter((s) => s.presentDays > 0).length,
    workingDays: period.workingDays,
    presentDays: 0,
    onTimeDays: 0,
    lateDays: 0,
    halfDays: 0,
    incompleteDays: 0,
    absentDays: 0,
    otMinutes: 0,
    workMinutes: 0,
  }

  for (const s of summary) {
    totals.presentDays += s.presentDays
    totals.onTimeDays += s.onTimeDays
    totals.lateDays += s.lateDays
    totals.halfDays += s.halfDays
    totals.incompleteDays += s.incompleteDays
    totals.absentDays += s.absentDays
    totals.otMinutes += s.otMinutes
    totals.workMinutes += s.workMinutes
  }

  totals.onTimeRate =
    totals.presentDays > 0 ? totals.onTimeDays / totals.presentDays : 0
  totals.attendanceRate =
    totals.presentDays + totals.absentDays > 0
      ? totals.presentDays / (totals.presentDays + totals.absentDays)
      : 0
  totals.otHours = totals.otMinutes / 60

  // Attendance volume per calendar date in the period (for the bar strip).
  const perDate = {}
  for (const r of records) {
    if (!perDate[r.date])
      perDate[r.date] = { date: r.date, present: 0, late: 0, absent: 0 }
    perDate[r.date].present++
    if (r.isLate || r.isHalf) perDate[r.date].late++
  }
  const byDate = Object.values(perDate).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  )

  const ranked = summary.filter((s) => s.presentDays > 0 || s.absentDays > 0)
  const topLate = [...ranked]
    .filter((s) => s.lateDays > 0)
    .sort((a, b) => b.lateDays - a.lateDays)
    .slice(0, 6)
  const topAbsent = [...ranked]
    .filter((s) => s.absentDays > 0)
    .sort((a, b) => b.absentDays - a.absentDays)
    .slice(0, 6)
  const perfect = ranked
    .filter(
      (s) =>
        s.presentDays > 0 &&
        s.lateDays === 0 &&
        s.halfDays === 0 &&
        s.absentDays === 0 &&
        s.incompleteDays === 0,
    )
    .sort((a, b) => b.presentDays - a.presentDays)

  // Active employees with no punches at all this period — review, don't penalise.
  const noData = summary.filter((s) => s.noData && s.active)

  return { totals, byDate, topLate, topAbsent, perfect, noData }
}

// Employee IDs seen in the data but not in the directory — prompt to register.
export const findUnknownIds = (records, employees) => {
  const seen = new Set()
  for (const r of records) if (!employees[r.id]) seen.add(r.id)
  return [...seen].sort((a, b) => a - b)
}
