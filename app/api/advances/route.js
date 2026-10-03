import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getState, setState } from "@/lib/dbState"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

export async function GET() {
  if (!dbConfigured()) return noDb()
  try {
    // `exists` lets the client tell "deliberately empty" from "never saved",
    // so a stale browser can't resurrect deleted advances by re-seeding.
    const data = await getState("advances", null)
    return NextResponse.json({ ok: true, data: data || [], exists: data !== null })
  } catch (e) {
    return fail(e)
  }
}

export async function PUT(req) {
  if (!dbConfigured()) return noDb()
  try {
    const body = await req.json()
    if (!Array.isArray(body))
      return NextResponse.json({ ok: false, error: "expected a list" }, { status: 400 })
    await setState("advances", body)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}

// PATCH [{ op: "upsert", item } | { op: "remove", id }] — applied by id, so a
// stale browser can't drop advances someone else recorded meanwhile.
export async function PATCH(req) {
  if (!dbConfigured()) return noDb()
  try {
    const ops = await req.json()
    if (!Array.isArray(ops) || ops.length > 200)
      return NextResponse.json({ ok: false, error: "expected a list of changes" }, { status: 400 })
    const col = (await getDb()).collection("state")
    for (const o of ops) {
      const id = String(o?.op === "remove" ? o.id : o?.item?.id || "")
      if (!id || !["upsert", "remove"].includes(o?.op))
        return NextResponse.json({ ok: false, error: "bad change" }, { status: 400 })
      await col.updateOne({ _id: "advances" }, { $pull: { data: { id } } }, { upsert: true })
      if (o.op === "upsert")
        await col.updateOne({ _id: "advances" }, { $push: { data: { ...o.item, id } }, $set: { updatedAt: new Date() } })
    }
    return NextResponse.json({ ok: true, applied: ops.length })
  } catch (e) {
    return fail(e)
  }
}
