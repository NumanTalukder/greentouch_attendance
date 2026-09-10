import { NextResponse } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth"

// Protect everything except the login page, the auth endpoints, and static
// assets. Pages redirect to /login; API routes get a 401 JSON response.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
}

export async function middleware(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const ok = await verifySession(process.env.AUTH_SECRET, token)
  if (ok) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    )
  }

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  return NextResponse.redirect(url)
}
