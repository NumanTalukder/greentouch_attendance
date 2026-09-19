import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getOpenSession, sessionsOn } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"
import { workDateDhaka } from "@/lib/geo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The employee's current open session (if any) + today's sessions.
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const now = new Date()
    const [open, today] = await Promise.all([
      getOpenSession(user.uid),
      sessionsOn(user.uid, workDateDhaka(now)),
    ])
    return NextResponse.json({
      ok: true,
      now: now.toISOString(),
      open,
      today,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
