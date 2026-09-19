import { NextResponse } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth"

// Protect everything except the login page, auth endpoints, and static assets.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
}

// Employee zone: the employee app and its own APIs. Everything else is admin-only.
const isEmployeeZone = (path) =>
  path === "/app" || path.startsWith("/app/") || path.startsWith("/api/me")

export async function middleware(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = await verifySession(process.env.AUTH_SECRET, token)
  const path = req.nextUrl.pathname
  const isApi = path.startsWith("/api/")

  // Not logged in → login (pages) or 401 (APIs).
  if (!session) {
    if (isApi)
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  const isAdmin = session.role === "admin"

  // Admins can go anywhere. Employees are confined to the employee zone.
  if (!isAdmin && !isEmployeeZone(path)) {
    if (isApi)
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    const url = req.nextUrl.clone()
    url.pathname = "/app"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
