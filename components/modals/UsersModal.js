"use client"

import { useCallback, useEffect, useState } from "react"
import Modal from "./Modal"
import { Badge, Icon } from "../ui"
import { blankEmployee, nextFieldId, officeFirst } from "@/lib/constants"

const inputCls =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"

// Sentinel used in the "Linked employee" dropdown to mean "make a brand-new
// app-only (field) employee for this login" instead of picking an existing one.
const NEW_FIELD = "__new_field__"

const blank = () => ({
  username: "",
  name: "",
  role: "employee",
  employeeId: "",
  password: "",
  active: true,
  isNew: true,
  fieldSalary: 0,
  fieldDepartment: "",
})

export default function UsersModal({ employees = {}, setEmployees, onClose }) {
  const [list, setList] = useState([])
  const [state, setState] = useState("loading")
  const [editing, setEditing] = useState(blank())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setState("loading")
    try {
      const r = await fetch("/api/users")
      const j = await r.json()
      if (j?.ok) {
        setList(j.data || [])
        setState("ready")
      } else setState("offline")
    } catch {
      setState("offline")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))

  const save = async () => {
    if (!editing.username.trim()) return alert("Username is required")

    // "New field employee" → create the employee record first (auto ID) so the
    // login has something real to link to. No more double entry.
    let employeeId = editing.employeeId || null
    if (editing.employeeId === NEW_FIELD) {
      if (!setEmployees)
        return alert("Cannot create an employee from here — open Employees.")
      const name = editing.name.trim()
      if (!name) return alert("Display name is required for a new field employee")
      const id = nextFieldId(employees)
      setEmployees((prev) => ({
        ...prev,
        [id]: {
          ...blankEmployee(name),
          category: "field",
          salary: Number(editing.fieldSalary) || 0,
          department: editing.fieldDepartment.trim() || "Field",
        },
      }))
      employeeId = id
    }

    setSaving(true)
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editing.username,
          name: editing.name,
          role: editing.role,
          employeeId,
          active: editing.active,
          password: editing.password || undefined,
        }),
      })
      const j = await r.json()
      if (j?.ok) {
        setEditing(blank())
        await load()
      } else alert(j?.error || "Could not save")
    } catch {
      alert("Could not save — cloud unavailable")
    }
    setSaving(false)
  }

  const remove = async (username) => {
    if (!confirm(`Delete login "${username}"?`)) return
    try {
      await fetch(`/api/users?username=${encodeURIComponent(username)}`, {
        method: "DELETE",
      })
      if (editing.username === username) setEditing(blank())
      await load()
    } catch {
      alert("Could not delete")
    }
  }

  const empName = (id) => employees[id]?.name || (id ? `#${id}` : "—")
  const empIds = Object.keys(employees).sort((a, b) => officeFirst(employees[a], employees[b]) || Number(a) - Number(b))

  return (
    <Modal
      title="Logins & access"
      subtitle="Create login IDs for employees and admins. The owner login always works."
      width="max-w-3xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {list.length} login{list.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        {/* Editor */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {editing.isNew ? "New login" : `Editing ${editing.username}`}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <input
                value={editing.username}
                disabled={!editing.isNew}
                onChange={(e) => set("username", e.target.value.toLowerCase())}
                placeholder="e.g. numan"
                className={`${inputCls} ${!editing.isNew ? "opacity-60" : ""}`}
              />
            </Field>
            <Field label="Role">
              <select value={editing.role} onChange={(e) => set("role", e.target.value)} className={inputCls}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Display name">
              <input value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" className={inputCls} />
            </Field>
            <Field label="Linked employee">
              <select value={editing.employeeId} onChange={(e) => set("employeeId", e.target.value)} className={inputCls}>
                <option value="">— none —</option>
                {editing.isNew && setEmployees && (
                  <option value={NEW_FIELD}>➕ New field employee (auto ID)</option>
                )}
                {empIds.map((id) => (
                  <option key={id} value={id}>#{id} {employees[id]?.name}</option>
                ))}
              </select>
            </Field>
            <Field label={editing.isNew ? "Password" : "New password (blank = keep)"}>
              <input type="text" value={editing.password} onChange={(e) => set("password", e.target.value)} placeholder={editing.isNew ? "Set a password" : "Leave blank to keep"} className={inputCls} />
            </Field>
            {editing.employeeId === NEW_FIELD && (
              <>
                <Field label="Salary (৳)">
                  <input type="number" value={editing.fieldSalary} onChange={(e) => set("fieldSalary", e.target.value)} placeholder="Monthly salary" className={`${inputCls} tabular-nums`} />
                </Field>
                <Field label="Department">
                  <input value={editing.fieldDepartment} onChange={(e) => set("fieldDepartment", e.target.value)} placeholder="e.g. Site A" className={inputCls} />
                </Field>
              </>
            )}
            <Field label="Active">
              <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} className="accent-emerald-500" />
                Can log in
              </label>
            </Field>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <button onClick={() => setEditing(blank())} className="text-sm font-medium text-slate-500 hover:underline">
              Clear
            </button>
            <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {saving ? "Saving…" : editing.isNew ? "Create login" : "Save changes"}
            </button>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50">
            Field workers use <b>New field employee</b> (app-only, auto ID). Machine
            staff already have an employee record — link to it here to also give them
            app access (hybrid: machine at HQ, app when outside; both sync on one ID).
            An employee login with no link will not count in payroll.
          </p>
        </div>

        {/* List */}
        <div className="md:border-l md:border-slate-100 md:pl-4 dark:md:border-slate-800">
          {state === "loading" && <p className="py-6 text-center text-sm text-slate-400">Loading…</p>}
          {state === "offline" && (
            <p className="flex items-center gap-1.5 py-4 text-sm text-slate-500">
              <Icon.cloudOff className="w-4 h-4" /> Cloud unreachable
            </p>
          )}
          {state === "ready" && list.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">No logins yet.</p>
          )}
          <div className="max-h-[56vh] space-y-1 overflow-y-auto">
            {list.map((u) => (
              <div
                key={u.username}
                className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <button
                  onClick={() => setEditing({ ...blank(), ...u, password: "", isNew: false })}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{u.username}</span>
                    <Badge tone={u.role === "admin" ? "violet" : "slate"}>{u.role}</Badge>
                    {u.active === false && <Badge tone="amber">off</Badge>}
                    {u.role === "employee" && !u.employeeId && (
                      <Badge tone="rose">no link</Badge>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {u.name || "—"} · {empName(u.employeeId)}
                  </span>
                </button>
                <button
                  onClick={() => remove(u.username)}
                  className="rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  title="Delete login"
                >
                  <Icon.trash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
    </span>
    {children}
  </label>
)
