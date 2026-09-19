import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { listPending } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Admin zone (middleware enforces admin). Pending off-site / no-GPS check-ins.
export async function GET() {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const data = await listPending()
    return NextResponse.json({ ok: true, data, count: data.length })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
