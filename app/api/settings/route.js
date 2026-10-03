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

// PATCH [{ key, value }] — only the settings that changed are written.
export async function PATCH(req) {
  if (!dbConfigured()) return noDb()
  try {
    const ops = await req.json()
    if (!Array.isArray(ops) || ops.length > 200)
      return NextResponse.json({ ok: false, error: "expected a list of changes" }, { status: 400 })
    const set = {}
    for (const o of ops) {
      if (!/^[A-Za-z][\w]{0,40}$/.test(o?.key || ""))
        return NextResponse.json({ ok: false, error: "bad key" }, { status: 400 })
      set[o.key] = o.value
    }
    await patchState("settings", set)
    return NextResponse.json({ ok: true, applied: ops.length })
  } catch (e) {
    return fail(e)
  }
}
