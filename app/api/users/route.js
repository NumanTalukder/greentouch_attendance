import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { dbConfigured } from "@/lib/db"
import { listUsers, getUser, saveUser, deleteUser } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// This route lives in the admin zone (middleware enforces admin-only access).

const noDb = () =>
  NextResponse.json({ ok: false, error: "no-db" }, { status: 503 })
const fail = (e) =>
  NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 503 })

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

export async function GET() {
  if (!dbConfigured()) return noDb()
  try {
    return NextResponse.json({ ok: true, data: await listUsers() })
  } catch (e) {
    return fail(e)
  }
}

// Create or update a login.
export async function POST(req) {
  if (!dbConfigured()) return noDb()
  try {
    const body = await req.json()
    const username = String(body?.username || "").trim().toLowerCase()
    if (!USERNAME_RE.test(username))
      return NextResponse.json(
        { ok: false, error: "Username must be 3–32 chars: a–z, 0–9, . _ -" },
        { status: 400 },
      )

    const existing = await getUser(username)
    const fields = {
      role: body?.role === "admin" ? "admin" : "employee",
      employeeId: body?.employeeId ? String(body.employeeId) : null,
      name: String(body?.name || "").trim(),
      active: body?.active !== false,
    }

    const password = String(body?.password || "")
    if (password) {
      if (password.length < 4)
        return NextResponse.json(
          { ok: false, error: "Password must be at least 4 characters" },
          { status: 400 },
        )
      fields.passwordHash = await bcrypt.hash(password, 10)
    } else if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Password is required for a new login" },
        { status: 400 },
      )
    }

    await saveUser(username, fields)
    return NextResponse.json({ ok: true, username })
  } catch (e) {
    return fail(e)
  }
}

export async function DELETE(req) {
  if (!dbConfigured()) return noDb()
  try {
    const username = new URL(req.url).searchParams.get("username")
    if (!username)
      return NextResponse.json(
        { ok: false, error: "username required" },
        { status: 400 },
      )
    await deleteUser(username)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return fail(e)
  }
}
