// Read the current signed-in user's session claims inside a server route.
import { cookies } from "next/headers"
import { SESSION_COOKIE, verifySession } from "./auth"

export async function currentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value
  return verifySession(process.env.AUTH_SECRET, token) // claims object or null
}
