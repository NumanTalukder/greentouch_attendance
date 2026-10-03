import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getEmployees, setEmployees, patchEmployee, removeEmployee } from "@/lib/dbState"

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

// PATCH [{ op: "upsert", id, fields } | { op: "remove", id }] — only changed
// fields of changed employees are written, so an out-of-date browser can't
// revert other people's edits or delete employees added meanwhile.
export async function PATCH(req) {
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const ops = await req.json()
    if (!Array.isArray(ops) || ops.length > 1000)
      return NextResponse.json({ ok: false, error: "expected a list of changes" }, { status: 400 })
    for (const o of ops) {
      const id = String(o?.id ?? "")
      if (!/^[\w-]{1,40}$/.test(id) || !["upsert", "remove"].includes(o?.op))
        return NextResponse.json({ ok: false, error: "bad change" }, { status: 400 })
      if (o.op === "remove") await removeEmployee(id)
      else {
        if (!o.fields || typeof o.fields !== "object" || Array.isArray(o.fields))
          return NextResponse.json({ ok: false, error: "bad fields" }, { status: 400 })
        await patchEmployee(id, o.fields)
      }
    }
    return NextResponse.json({ ok: true, applied: ops.length })
  } catch (e) {
    return fail(e)
  }
}
