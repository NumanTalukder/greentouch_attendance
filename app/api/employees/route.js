import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getEmployees, setEmployees } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const fail = (e) =>
  NextResponse.json(
    { ok: false, error: e?.message || "Database error" },
    { status: 503 },
  )

export async function GET() {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    return NextResponse.json({ ok: true, data: await getEmployees() })
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(req) {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const body = await req.json()
    await setEmployees(body && typeof body === "object" ? body : {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
