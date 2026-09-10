import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { listRecords, getRecord, saveRecord } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

// GET /api/records            -> list of saved months (metadata only)
// GET /api/records?month=YYYY-MM -> one full month snapshot
export async function GET(req) {
  if (!dbConfigured()) return noDb()
  try {
    const month = new URL(req.url).searchParams.get("month")
    const data = month ? await getRecord(month) : await listRecords()
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return fail(e)
  }
}

// POST /api/records { month, period, totals, rows } -> save/replace a snapshot
export async function POST(req) {
  if (!dbConfigured()) return noDb()
  try {
    const body = await req.json()
    if (!body?.month)
      return NextResponse.json(
        { ok: false, error: "month required" },
        { status: 400 },
      )
    const { month, ...rest } = body
    await saveRecord(month, rest)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
