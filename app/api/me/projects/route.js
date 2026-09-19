import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { listProjects } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Active, non-archived projects an employee can check into.
export async function GET() {
  if (!(await currentUser()))
    return NextResponse.json({ ok: false }, { status: 401 })
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
  try {
    const projects = (await listProjects())
      .filter((p) => !p.archived && p.active !== false)
      .map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        radius: p.radius,
        requireSelfie: p.requireSelfie,
        allowFieldwork: p.allowFieldwork,
      }))
    return NextResponse.json({ ok: true, data: projects })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
