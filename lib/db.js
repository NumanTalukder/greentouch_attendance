// Server-only MongoDB connection. Never imported by client components — the
// URI lives in process.env.MONGODB_URI (.env.local) and stays on the server.
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI

// A single connection promise, reused across requests (and across HMR reloads
// in dev, so we don't leak connections on every file save).
let clientPromise = null

if (uri) {
  if (process.env.NODE_ENV === "development") {
    if (!global._gtMongoClientPromise) {
      global._gtMongoClientPromise = new MongoClient(uri).connect()
    }
    clientPromise = global._gtMongoClientPromise
  } else {
    clientPromise = new MongoClient(uri).connect()
  }
}

export const dbConfigured = () => Boolean(uri)

// Returns the database named in the connection string (greentouch-attendance).
export const getDb = async () => {
  if (!clientPromise) throw new Error("MONGODB_URI is not configured")
  const client = await clientPromise
  return client.db()
}
