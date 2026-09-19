import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { openSessions, approvedSessionsInRange } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Admin zone. Live "on site now" + approved sessions in a range for per-project
// hours & cost.  GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req) {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    const [open, sessions] = await Promise.all([
      openSessions(),
      approvedSessionsInRange(from, to),
    ])

    return NextResponse.json({
      ok: true,
      now: new Date().toISOString(),
      open: open.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        projectId: s.projectId,
        projectName: s.projectName,
        checkInAt: s.checkInAt,
        status: s.status,
      })),
      sessions: sessions
        .filter((s) => s.checkOutAt)
        .map((s) => ({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          projectName: s.projectName,
          durationMin: s.durationMin || 0,
          workDate: s.workDate,
        })),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
