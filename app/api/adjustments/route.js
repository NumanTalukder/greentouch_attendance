import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getState, setState, patchState } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

export async function GET() {
  if (!dbConfigured()) return noDb()
  try {
    return NextResponse.json({ ok: true, data: await getState("adjustments", {}) })
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(req) {
  if (!dbConfigured()) return noDb()
  try {
    await setState("adjustments", await req.json())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}

// PATCH [{ month, field, key, value }]  — value null = remove.
// Only the changed month/field/employee values are written, so two people
// editing at once never overwrite each other's numbers.
const FIELDS = new Set([
  "ot", "penalty", "bonus", "advance", "leaveEarned", "leaveSick", "leaveMonthly",
  "ait", "otAdjust", "days", "otDays", "lateCut", "corrections", "holidayWork",
])
export async function PATCH(req) {
  if (!dbConfigured()) return noDb()
  try {
    const ops = await req.json()
    if (!Array.isArray(ops) || ops.length > 500)
      return NextResponse.json({ ok: false, error: "expected a list of changes" }, { status: 400 })
    const set = {}
    const unset = []
    for (const o of ops) {
      if (!/^\d{4}-\d{2}$/.test(o?.month || "") || !FIELDS.has(o?.field) || !/^[\w-]{1,40}$/.test(String(o?.key ?? "")))
        return NextResponse.json({ ok: false, error: "bad change" }, { status: 400 })
      const path = `${o.month}.${o.field}.${o.key}`
      if (o.value === null || o.value === undefined) unset.push(path)
      else set[path] = o.value
    }
    await patchState("adjustments", set, unset)
    return NextResponse.json({ ok: true, applied: ops.length })
  } catch (e) {
    return fail(e)
  }
}
