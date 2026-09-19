import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { reviewSession } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Admin approves or rejects a pending check-in.
export async function POST(req) {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const user = await currentUser()
    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || "")
    const action = body?.action
    if (!id || !["approve", "reject"].includes(action))
      return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 })
    const status = action === "approve" ? "approved" : "rejected"
    await reviewSession(id, status, user?.name || user?.uid || "admin")
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
