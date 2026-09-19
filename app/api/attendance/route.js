import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { listApprovedSessions } from "@/lib/dbState"
import { dhakaDateTime } from "@/lib/geo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Admin zone. Approved app check-ins as punch events the attendance engine reads
// (same {id, date, time} shape as pasted machine data), tagged source "app".
export async function GET() {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const sessions = await listApprovedSessions()
    const punches = []
    for (const s of sessions) {
      const id = parseInt(s.employeeId, 10)
      if (!Number.isFinite(id) || !s.checkInAt) continue
      const ci = dhakaDateTime(new Date(s.checkInAt))
      punches.push({ id, date: ci.date, time: ci.time, source: "app", project: s.projectName })
      if (s.checkOutAt) {
        const co = dhakaDateTime(new Date(s.checkOutAt))
        punches.push({ id, date: co.date, time: co.time, source: "app", project: s.projectName })
      }
    }
    return NextResponse.json({ ok: true, punches })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
