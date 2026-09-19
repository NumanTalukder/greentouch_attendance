import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  safeEqual,
} from "@/lib/auth"
import { dbConfigured } from "@/lib/db"
import { getUser } from "@/lib/dbState"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const setSession = async (secret, claims) => {
  const token = await createSession(secret, claims)
  const res = NextResponse.json({ ok: true, role: claims.role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return res
}

const deny = async (msg = "Incorrect username or password") => {
  await new Promise((r) => setTimeout(r, 500)) // slow brute force
  return NextResponse.json({ ok: false, error: msg }, { status: 401 })
}

export async function POST(req) {
  const secret = process.env.AUTH_SECRET
  const ownerPassword = process.env.APP_PASSWORD
  if (!secret || !ownerPassword) {
    return NextResponse.json(
      { ok: false, error: "Auth not configured (set APP_PASSWORD & AUTH_SECRET)" },
      { status: 500 },
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const username = String(body?.username || "").trim()
  const password = String(body?.password || "")

  // Owner bootstrap: no username + the app password → always an admin.
  if (!username) {
    if (safeEqual(password, ownerPassword)) {
      return setSession(secret, { uid: "owner", role: "admin", name: "Owner" })
    }
    return deny()
  }

  // Account login against the users collection.
  if (!dbConfigured()) return deny("Accounts unavailable (no database)")
  try {
    const user = await getUser(username)
    if (
      !user ||
      user.active === false ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    )
      return deny()
    return setSession(secret, {
      uid: user._id,
      role: user.role === "admin" ? "admin" : "employee",
      employeeId: user.employeeId || null,
      name: user.name || user._id,
    })
  } catch {
    return deny("Login failed — try again")
  }
}
