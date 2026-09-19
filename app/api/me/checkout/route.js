import { NextResponse } from "next/server"
import { dbConfigured } from "@/lib/db"
import { closeOpenSession, getOpenSession, getProject } from "@/lib/dbState"
import { currentUser } from "@/lib/serverAuth"
import { haversineMeters } from "@/lib/geo"

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
  const offsite = !!body?.offsite
  const reason = String(body?.reason || "").trim()

  try {
    const open = await getOpenSession(user.uid)
    if (!open)
      return NextResponse.json(
        { ok: false, error: "You're not checked in." },
        { status: 409 },
      )

    // Check the geofence of the project the session belongs to.
    const project = await getProject(String(open.projectId || ""))
    const hasGps = Number.isFinite(lat) && Number.isFinite(lng)
    const hasCentre =
      project && Number.isFinite(project.lat) && Number.isFinite(project.lng)

    let distance = null
    let inFence = false
    if (hasGps && hasCentre) {
      distance = Math.round(haversineMeters(lat, lng, project.lat, project.lng))
      const effective = distance - (Number.isFinite(accuracy) ? accuracy : 0)
      inFence = effective <= project.radius
    }

    // Outside the fence (or no GPS) → require a reason and send for review.
    if (!inFence && !(offsite && reason)) {
      return bad(hasGps ? "out_of_fence" : "no_gps", {
        distance,
        radius: project?.radius ?? null,
      })
    }

    const now = new Date() // server-owned timestamp
    const durationMin = Math.max(
      0,
      Math.round((now - new Date(open.checkInAt)) / 60000),
    )

    const fields = {
      checkOutAt: now,
      checkOutGeo: hasGps
        ? {
            lat,
            lng,
            accuracy: Number.isFinite(accuracy) ? accuracy : null,
            distance,
            inFence,
          }
        : { lat: null, lng: null, accuracy: null, distance, inFence: false },
      durationMin,
    }

    // An off-site checkout flags the whole session for manual review; an
    // in-fence checkout leaves the check-in's status untouched (a pending
    // check-in stays pending).
    if (!inFence) {
      fields.status = "pending"
      fields.checkOutReason = reason
      fields.checkOutFieldwork = true
      fields.checkOutVerification = hasGps ? "out-of-fence" : "no-gps"
    }

    const session = await closeOpenSession(user.uid, fields)
    return NextResponse.json({ ok: true, review: !inFence, session })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
