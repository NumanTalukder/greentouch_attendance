import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { getProject, getOpenSession, createSession } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"
import { haversineMeters, workDateDhaka } from "@/lib/geo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bad = (code, extra = {}) =>
  NextResponse.json({ ok: false, code, ...extra }, { status: 422 })

export async function POST(req) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  if (!dbConfigured())
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  const accuracy = Number(body?.accuracy)
  const fieldwork = !!body?.fieldwork
  const reason = String(body?.reason || "").trim()

  try {
    if (await getOpenSession(user.uid))
      return NextResponse.json(
        { ok: false, code: "already_in", error: "You're already checked in." },
        { status: 409 },
      )

    const project = await getProject(String(body?.projectId || ""))
    if (!project || project.archived || project.active === false)
      return NextResponse.json(
        { ok: false, error: "Project not available" },
        { status: 400 },
      )

    const now = new Date() // server-owned timestamp
    const hasGps = Number.isFinite(lat) && Number.isFinite(lng)
    const hasCentre = Number.isFinite(project.lat) && Number.isFinite(project.lng)

    let distance = null
    let inFence = false
    if (hasGps && hasCentre) {
      distance = Math.round(haversineMeters(lat, lng, project.lat, project.lng))
      // Allow the phone's own accuracy margin so a good fix near the edge passes.
      const effective = distance - (Number.isFinite(accuracy) ? accuracy : 0)
      inFence = effective <= project.radius
    }

    let status, verification
    if (inFence) {
      status = "approved"
      verification = "geo"
    } else {
      // Outside the fence or no GPS → must be filed as a field-work claim.
      if (!fieldwork) {
        if (!project.allowFieldwork)
          return bad("fieldwork_disabled", { distance, radius: project.radius })
        return bad(hasGps ? "out_of_fence" : "no_gps", {
          distance,
          radius: project.radius,
        })
      }
      status = "pending"
      verification = hasGps ? "out-of-fence" : "no-gps"
    }

    const session = {
      uid: user.uid,
      employeeId: user.employeeId || null,
      employeeName: user.name || user.uid,
      projectId: project.id,
      projectName: project.name,
      checkInAt: now,
      checkInGeo: { lat: hasGps ? lat : null, lng: hasGps ? lng : null, accuracy: Number.isFinite(accuracy) ? accuracy : null, distance, inFence },
      checkOutAt: null,
      workDate: workDateDhaka(now),
      source: "app",
      status,
      verification,
      fieldwork: status === "pending",
      reason: status === "pending" ? reason || null : null,
    }
    const { id } = await createSession(session)
    return NextResponse.json({ ok: true, status, session: { id, ...session } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
