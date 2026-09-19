import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySession } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Returns the current user's own session claims (never anything sensitive).
export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value
  const session = await verifySession(process.env.AUTH_SECRET, token)
  if (!session)
    return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({
    ok: true,
    user: {
      uid: session.uid,
      role: session.role,
      name: session.name || null,
      employeeId: session.employeeId || null,
    },
  })
}
