import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import {
  listMachineMonths,
  getMachineMonth,
  addMachinePunches,
  deleteMachineMonth,
  isRecordLocked,
} from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () => NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) => NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })
const MONTH = /^\d{4}-\d{2}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}(:\d{2})?$/

// GET            → { months: [{ month, count, updatedAt, updatedBy }] }
// GET ?month=M   → { data: [{ id, date, time }] }
export async function GET(req) {
  if (!dbConfigured()) return noDb()
  try {
    const month = new URL(req.url).searchParams.get("month")
    if (month) {
      if (!MONTH.test(month)) return NextResponse.json({ ok: false, error: "bad month" }, { status: 400 })
      return NextResponse.json({ ok: true, month, data: await getMachineMonth(month) })
    }
    return NextResponse.json({ ok: true, months: await listMachineMonths() })
  } catch (e) {
    return fail(e)
  }
}

// POST { punches: [{ id, date, time }] } → merged into each month (duplicates
// dropped). Months locked in Records are refused, so paid months can't change.
export async function POST(req) {
  if (!dbConfigured()) return noDb()
  try {
    const body = await req.json()
    const punches = Array.isArray(body?.punches) ? body.punches : null
    if (!punches || punches.length > 200000)
      return NextResponse.json({ ok: false, error: "expected { punches: [...] }" }, { status: 400 })
    const byMonth = {}
    for (const p of punches) {
      const id = Number(p?.id)
      if (!Number.isInteger(id) || id < 0 || !DATE.test(p?.date || "") || !TIME.test(p?.time || ""))
        return NextResponse.json({ ok: false, error: "bad punch row" }, { status: 400 })
      const time = p.time.length === 5 ? `${p.time}:00` : p.time
      ;(byMonth[p.date.slice(0, 7)] ||= []).push(`${id}|${p.date}|${time}`)
    }
    const user = await currentUser()
    const saved = []
    const locked = []
    for (const [month, keys] of Object.entries(byMonth)) {
      if (await isRecordLocked(month)) {
        locked.push(month)
        continue
      }
      saved.push(await addMachinePunches(month, keys, user?.name || user?.uid))
    }
    return NextResponse.json({ ok: true, saved, locked })
  } catch (e) {
    return fail(e)
  }
}

// DELETE ?month=M → remove that month's machine data (refused if locked)
export async function DELETE(req) {
  if (!dbConfigured()) return noDb()
  try {
    const month = new URL(req.url).searchParams.get("month")
    if (!MONTH.test(month || "")) return NextResponse.json({ ok: false, error: "bad month" }, { status: 400 })
    if (await isRecordLocked(month))
      return NextResponse.json({ ok: false, locked: true, error: `${month} is locked in Records.` }, { status: 409 })
    await deleteMachineMonth(month)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
