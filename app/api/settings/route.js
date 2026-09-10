import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getState, setState } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

export async function GET() {
  if (!dbConfigured()) return noDb()
  try {
    return NextResponse.json({ ok: true, data: await getState("settings", null) })
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(req) {
  if (!dbConfigured()) return noDb()
  try {
    await setState("settings", await req.json())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
