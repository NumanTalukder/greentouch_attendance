// Server-only data access for MongoDB. Collections:
//   employees   — one document per employee (_id = employee id as string)
//   state       — singletons: _id "settings", _id "adjustments"
//   records      — one document per finalised month (_id = "YYYY-MM")
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
