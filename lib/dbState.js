// Server-only data access for MongoDB. Collections:
//   employees   — one document per employee (_id = employee id as string)
//   state       — singletons: _id "settings", _id "adjustments"
//   records      — one document per finalised month (_id = "YYYY-MM")
//   projects     — one document per work site (_id = project id)
import { getDb } from "./db"

// ---- singletons (settings, adjustments) ----
export async function getState(id, fallback = null) {
  const db = await getDb()
  const doc = await db.collection("state").findOne({ _id: id })
  return doc ? doc.data : fallback
}

export async function setState(id, data) {
  const db = await getDb()
  await db
    .collection("state")
    .updateOne(
      { _id: id },
      { $set: { data, updatedAt: new Date() } },
      { upsert: true },
    )
  return data
}

// ---- employees (document per employee) ----
export async function getEmployees() {
  const db = await getDb()
  const docs = await db.collection("employees").find({}).toArray()
  const map = {}
  for (const d of docs) {
    const { _id, updatedAt, ...fields } = d
    map[_id] = fields
  }
  return map
}

export async function setEmployees(map) {
  const db = await getDb()
  const col = db.collection("employees")
  const ids = Object.keys(map || {})
  const ops = ids.map((id) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { ...map[id], updatedAt: new Date() } },
      upsert: true,
    },
  }))
  // Remove employees that no longer exist in the map.
  ops.push({ deleteMany: { filter: { _id: { $nin: ids } } } })
  await col.bulkWrite(ops)
  return map
}

// ---- monthly payroll snapshots ("previous month records") ----
export async function listRecords() {
  const db = await getDb()
  const docs = await db
    .collection("records")
    .find({}, { projection: { rows: 0 } })
    .sort({ _id: -1 })
    .toArray()
  return docs.map(({ _id, ...rest }) => ({ month: _id, ...rest }))
}

export async function getRecord(month) {
  const db = await getDb()
  const doc = await db.collection("records").findOne({ _id: month })
  if (!doc) return null
  const { _id, ...rest } = doc
  return { month: _id, ...rest }
}

export async function saveRecord(month, data) {
  const db = await getDb()
  await db.collection("records").updateOne(
    { _id: month },
    { $set: { ...data, month, savedAt: new Date() } },
    { upsert: true },
  )
  return { month, ...data }
}

// Is a saved month frozen? (cheap check — no rows fetched)
export async function isRecordLocked(month) {
  const db = await getDb()
  const doc = await db
    .collection("records")
    .findOne({ _id: month }, { projection: { locked: 1 } })
  return !!doc?.locked
}

// Freeze / unfreeze a finalised month so a re-paste can't overwrite it.
export async function setRecordLock(month, locked, by) {
  const db = await getDb()
  await db.collection("records").updateOne(
    { _id: month },
    {
      $set: {
        locked: !!locked,
        lockedAt: locked ? new Date() : null,
        lockedBy: locked ? by || null : null,
      },
    },
  )
  return { month, locked: !!locked }
}

// ---- projects (work sites with a geofence) ----
export async function listProjects() {
  const db = await getDb()
  const docs = await db
    .collection("projects")
    .find({})
    .sort({ name: 1 })
    .toArray()
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }))
}

export async function saveProject(id, data) {
  const db = await getDb()
  const now = new Date()
  await db.collection("projects").updateOne(
    { _id: id },
    {
      $set: { ...data, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )
  return { id, ...data }
}

export async function getProject(id) {
  const db = await getDb()
  const doc = await db.collection("projects").findOne({ _id: id })
  if (!doc) return null
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

export async function deleteProject(id) {
  const db = await getDb()
  await db.collection("projects").deleteOne({ _id: id })
  return { id }
}

// ---- attendance sessions (app check-in/out) ----
// One doc per work segment (check-in → check-out) on a project. String _id.
const cleanSession = (d) => {
  if (!d) return null
  const { _id, ...rest } = d
  return { id: _id, ...rest }
}

export async function getOpenSession(uid) {
  const db = await getDb()
  return cleanSession(
    await db.collection("attendance").findOne({ uid, checkOutAt: null }),
  )
}

export async function createSession(doc) {
  const db = await getDb()
  const _id =
    globalThis.crypto?.randomUUID?.() || `a_${Date.now()}${Math.random()}`
  await db.collection("attendance").insertOne({ _id, ...doc, createdAt: new Date() })
  return { id: _id }
}

export async function closeOpenSession(uid, fields) {
  const db = await getDb()
  const open = await db.collection("attendance").findOne({ uid, checkOutAt: null })
  if (!open) return null
  await db.collection("attendance").updateOne({ _id: open._id }, { $set: fields })
  return cleanSession({ ...open, ...fields })
}

export async function sessionsOn(uid, workDate) {
  const db = await getDb()
  const docs = await db
    .collection("attendance")
    .find({ uid, workDate })
    .sort({ checkInAt: 1 })
    .toArray()
  return docs.map(cleanSession)
}

// ---- admin review of pending (off-site / no-GPS) sessions ----
export async function listPending() {
  const db = await getDb()
  const docs = await db
    .collection("attendance")
    .find({ status: "pending" })
    .sort({ checkInAt: -1 })
    .toArray()
  return docs.map(cleanSession)
}

export async function countPending() {
  const db = await getDb()
  return db.collection("attendance").countDocuments({ status: "pending" })
}

// Currently-open sessions (checked in, not yet out) — the live board.
export async function openSessions() {
  const db = await getDb()
  const docs = await db
    .collection("attendance")
    .find({ checkOutAt: null })
    .sort({ checkInAt: 1 })
    .toArray()
  return docs.map(cleanSession)
}

// Approved sessions within a work-date range (for per-project hours & cost).
export async function approvedSessionsInRange(from, to) {
  const db = await getDb()
  const q = { status: "approved" }
  if (from && to) q.workDate = { $gte: from, $lte: to }
  const docs = await db.collection("attendance").find(q).sort({ checkInAt: 1 }).toArray()
  return docs.map(cleanSession)
}

// One employee's approved sessions for a month (for their self-view).
export async function sessionsForMonth(uid, month) {
  const db = await getDb()
  const docs = await db
    .collection("attendance")
    .find({ uid, status: "approved", workDate: { $gte: `${month}-01`, $lte: `${month}-31` } })
    .sort({ checkInAt: 1 })
    .toArray()
  return docs.map(cleanSession)
}

// Approved sessions that can feed payroll (linked to a real employee).
export async function listApprovedSessions() {
  const db = await getDb()
  const docs = await db
    .collection("attendance")
    .find({ status: "approved", employeeId: { $ne: null } })
    .sort({ checkInAt: 1 })
    .toArray()
  return docs.map(cleanSession)
}

export async function reviewSession(id, status, by) {
  const db = await getDb()
  await db
    .collection("attendance")
    .updateOne(
      { _id: id },
      { $set: { status, reviewedBy: by, reviewedAt: new Date() } },
    )
  return { id, status }
}

// ---- users / logins (_id = lowercased username) ----
// Full doc incl. passwordHash — server-only, used by the login route.
export async function getUser(username) {
  const db = await getDb()
  return db.collection("users").findOne({ _id: String(username).toLowerCase() })
}

// Safe list for the admin UI — never includes password hashes.
export async function listUsers() {
  const db = await getDb()
  const docs = await db
    .collection("users")
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ _id: 1 })
    .toArray()
  return docs.map(({ _id, ...rest }) => ({ username: _id, ...rest }))
}

export async function saveUser(username, fields) {
  const db = await getDb()
  const id = String(username).toLowerCase()
  const now = new Date()
  await db.collection("users").updateOne(
    { _id: id },
    { $set: { ...fields, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
  return { username: id }
}

export async function deleteUser(username) {
  const db = await getDb()
  await db.collection("users").deleteOne({ _id: String(username).toLowerCase() })
  return { username }
}
