import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { listProjects, saveProject, deleteProject } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

const num = (v, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

// Keep only the fields we recognise, coerced to sane types.
const clean = (b) => ({
  name: String(b?.name || "").trim(),
  code: String(b?.code || "").trim(),
  address: String(b?.address || "").trim(),
  lat: num(b?.lat, null),
  lng: num(b?.lng, null),
  radius: Math.max(10, num(b?.radius, 150)), // metres, min 10
  requireSelfie: !!b?.requireSelfie,
  allowFieldwork: b?.allowFieldwork !== false, // default true
  active: b?.active !== false, // default true (accepting check-ins)
  archived: !!b?.archived, // soft-closed: hidden from lists, no check-ins
})

export async function GET() {
  if (!dbConfigured()) return noDb()
  try {
    return NextResponse.json({ ok: true, data: await listProjects() })
  } catch (e) {
    return fail(e)
  }
}

// Create (no id) or update (id present).
export async function POST(req) {
  if (!dbConfigured()) return noDb()
  try {
    const body = await req.json()
    const data = clean(body)
    if (!data.name)
      return NextResponse.json(
        { ok: false, error: "Project name is required" },
        { status: 400 },
      )
    const id =
      body?.id ||
      `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    await saveProject(id, data)
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(req) {
  if (!dbConfigured()) return noDb()
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id)
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 })
    await deleteProject(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
