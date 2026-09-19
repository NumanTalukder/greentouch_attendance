import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getEmployees, getState, sessionsForMonth } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"
import { dhakaDateTime, workDateDhaka } from "@/lib/geo"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import {
  buildDailyRecords,
  buildSummary,
  workingDaysBetween,
  weekendFor,
} from "@/lib/engine"
import { buildLeave } from "@/lib/leave"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const pad = (n) => String(n).padStart(2, "0")

// The signed-in employee's own monthly stats (from their app check-ins) +
// category-aware leave balances. GET ?month=YYYY-MM
export async function GET(req) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })

  const month =
    new URL(req.url).searchParams.get("month") ||
    workDateDhaka(new Date(), 0).slice(0, 7)

  if (!user.employeeId)
    return NextResponse.json({ ok: true, linked: false, month })

  try {
    const empId = String(user.employeeId)
    const employees = await getEmployees()
    const emp = employees[empId] || { name: user.name, category: "office" }
    const empMap = { [empId]: emp }
    const settings = { ...DEFAULT_SETTINGS, ...((await getState("settings")) || {}) }
    const adjustments = (await getState("adjustments")) || {}
    const sessions = await sessionsForMonth(user.uid, month)

    // Sessions → punches the engine understands.
    const punches = []
    const idNum = parseInt(empId, 10)
    for (const s of sessions) {
      if (!s.checkInAt) continue
      const ci = dhakaDateTime(new Date(s.checkInAt))
      punches.push({ id: idNum, date: ci.date, time: ci.time, source: "app", project: s.projectName })
      if (s.checkOutAt) {
        const co = dhakaDateTime(new Date(s.checkOutAt))
        punches.push({ id: idNum, date: co.date, time: co.time, source: "app", project: s.projectName })
      }
    }

    // Period = month so far (up to today, or the whole month if it's past).
    const [y, m] = month.split("-").map(Number)
    const monthStart = `${month}-01`
    const monthEnd = `${month}-${pad(new Date(y, m, 0).getDate())}`
    const today = workDateDhaka(new Date(), 0)
    let to = today < monthEnd ? today : monthEnd
    if (to < monthStart) to = monthStart
    const period = {
      from: monthStart,
      to,
      workingDays: workingDaysBetween(
        monthStart,
        to,
        weekendFor(emp.category, settings),
        settings.holidays,
      ),
    }

    const records = buildDailyRecords(punches, settings, empMap)
    const summary = buildSummary(records, settings, empMap, period)
    const mine = summary.find((r) => r.id === idNum) || summary[0] || {}
    const leaveOut = buildLeave(summary, adjustments, month, settings)
    const myLeave = leaveOut.rows.find((r) => r.id === idNum) || {}

    return NextResponse.json({
      ok: true,
      linked: true,
      month,
      category: emp.category === "field" ? "field" : "office",
      stats: {
        present: mine.presentDays || 0,
        late: mine.lateDays || 0,
        absent: mine.absentDays || 0,
        otHours: Math.round((mine.otHours || 0) * 10) / 10,
        workHours: Math.round(((mine.workMinutes || 0) / 60) * 10) / 10,
      },
      leave: {
        earnedLeft: myLeave.earnedLeft ?? null,
        sickLeft: myLeave.sickLeft ?? null,
        monthLeft: myLeave.monthLeft ?? null,
        entE: leaveOut.entE,
        entS: leaveOut.entS,
        fieldMonthly: leaveOut.fieldMonthly,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
