import { NextResponse } from "next/server"
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  safeEqual,
} from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req) {
  const password = process.env.APP_PASSWORD
  const secret = process.env.AUTH_SECRET
  if (!password || !secret) {
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

  if (!safeEqual(String(body?.password || ""), password)) {
    // Small delay to slow brute-force attempts.
    await new Promise((r) => setTimeout(r, 600))
    return NextResponse.json(
      { ok: false, error: "Incorrect password" },
      { status: 401 },
    )
  }

  const token = await createSession(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return res
}
