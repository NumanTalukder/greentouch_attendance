// Stateless signed-session helpers, usable in both the Edge middleware and
// Node API routes (Web Crypto only). A session token is:
//   base64url(payloadJSON) + "." + base64url(HMAC-SHA256(payloadJSON))
// The payload just carries an expiry; the HMAC (keyed by AUTH_SECRET) makes it
// unforgeable. No DB lookup needed to check a request is authenticated.

export const SESSION_COOKIE = "gt_session"
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const fromB64url = (str) => {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const hmacKey = (secret) =>
  crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )

export async function createSession(secret, ttlMs = SESSION_TTL_MS) {
  const payload = enc.encode(JSON.stringify({ exp: Date.now() + ttlMs }))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), payload)
  return `${toB64url(payload)}.${toB64url(sig)}`
}

export async function verifySession(secret, token) {
  if (!secret || !token) return false
  const [p, s] = token.split(".")
  if (!p || !s) return false
  try {
    const payload = fromB64url(p)
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromB64url(s),
      payload,
    )
    if (!valid) return false
    const { exp } = JSON.parse(dec.decode(payload))
    return typeof exp === "number" && exp > Date.now()
  } catch {
    return false
  }
}

// Constant-time-ish string compare for the password check.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
