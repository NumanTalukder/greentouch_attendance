"use client"

import { useCallback, useEffect, useState } from "react"
import Modal from "./Modal"
import MapPicker from "../MapPicker"
import { Badge, Icon } from "../ui"

const inputCls =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"

const blankProject = () => ({
  name: "",
  code: "",
  address: "",
  lat: null,
  lng: null,
  radius: 150,
  requireSelfie: false,
  allowFieldwork: true,
  active: true,
  archived: false,
})

export default function ProjectsModal({ onClose }) {
  const [list, setList] = useState([])
  const [state, setState] = useState("loading") // loading | ready | offline
  const [editing, setEditing] = useState(blankProject())
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const activeList = list.filter((p) => !p.archived)
  const archivedList = list.filter((p) => p.archived)
  const shown = showArchived ? archivedList : activeList

  const load = useCallback(async () => {
    setState("loading")
    try {
      const r = await fetch("/api/projects")
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

  const set = (key, value) => setEditing((e) => ({ ...e, [key]: value }))

  const save = async () => {
    if (!editing.name.trim()) return alert("Project name is required")
    if (!Number.isFinite(editing.lat) || !Number.isFinite(editing.lng))
      return alert("Set the project location on the map first")
    setSaving(true)
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      })
      const j = await r.json()
      if (j?.ok) {
        setEditing((e) => ({ ...e, id: j.id }))
        await load()
      } else alert(j?.error || "Could not save")
    } catch {
      alert("Could not save — cloud unavailable")
    }
    setSaving(false)
  }

  const setArchived = async (value) => {
    if (!editing.id) return
    setSaving(true)
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, archived: value }),
      })
      const j = await r.json()
      if (j?.ok) {
        setEditing((e) => ({ ...e, archived: value }))
        setShowArchived(value)
        await load()
      } else alert(j?.error || "Could not update")
    } catch {
      alert("Could not update — cloud unavailable")
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!editing.id) return setEditing(blankProject())
    if (!confirm(`Delete project "${editing.name}"?`)) return
    try {
      await fetch(`/api/projects?id=${encodeURIComponent(editing.id)}`, {
        method: "DELETE",
      })
      setEditing(blankProject())
      await load()
    } catch {
      alert("Could not delete")
    }
  }

  return (
    <Modal
      title="Projects & geofences"
      subtitle="Work sites where employees clock in. Attendance outside the radius needs review."
      width="max-w-5xl"
      onClose={onClose}
    >
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        {/* List */}
        <div className="md:border-r md:border-slate-100 md:pr-4 dark:md:border-slate-800">
          <button
            onClick={() => setEditing(blankProject())}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            <Icon.plus className="w-4 h-4" /> New project
          </button>

          {state === "loading" && (
            <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
          )}
          {state === "offline" && (
            <p className="flex items-center gap-1.5 py-4 text-sm text-slate-500">
              <Icon.cloudOff className="w-4 h-4" /> Cloud unreachable
            </p>
          )}
          {state === "ready" && (
            <div className="mb-2 flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
              {[
                { v: false, label: `Active (${activeList.length})` },
                { v: true, label: `Archived (${archivedList.length})` },
              ].map((t) => (
                <button
                  key={String(t.v)}
                  onClick={() => setShowArchived(t.v)}
                  className={`flex-1 rounded-md px-2 py-1 transition ${
                    showArchived === t.v
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {state === "ready" && shown.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {showArchived ? "No archived projects." : "No active projects yet."}
            </p>
          )}

          <div className="max-h-[48vh] space-y-1 overflow-y-auto">
            {shown.map((p) => (
              <button
                key={p.id}
                onClick={() => setEditing({ ...blankProject(), ...p })}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  editing.id === p.id
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-200"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.code ? `${p.code} · ` : ""}
                    {p.radius}m radius
                  </span>
                </span>
                {p.archived ? (
                  <Badge tone="slate">archived</Badge>
                ) : p.active === false ? (
                  <Badge tone="amber">paused</Badge>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project name" className="col-span-2">
              <input value={editing.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="e.g. Gulshan Site" />
            </Field>
            <Field label="Code">
              <input value={editing.code} onChange={(e) => set("code", e.target.value)} className={inputCls} placeholder="GUL-01" />
            </Field>
            <Field label="Radius (metres)">
              <input type="number" min={10} value={editing.radius} onChange={(e) => set("radius", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Address" className="col-span-2">
              <input value={editing.address} onChange={(e) => set("address", e.target.value)} className={inputCls} placeholder="Street, area, city" />
            </Field>
          </div>

          <MapPicker
            lat={editing.lat}
            lng={editing.lng}
            radius={editing.radius}
            onChange={({ lat, lng }) => setEditing((e) => ({ ...e, lat, lng }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input type="number" step="0.000001" value={editing.lat ?? ""} onChange={(e) => set("lat", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Longitude">
              <input type="number" step="0.000001" value={editing.lng ?? ""} onChange={(e) => set("lng", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle checked={editing.allowFieldwork} onChange={(v) => set("allowFieldwork", v)} label="Allow off-site (field work) claims" />
            <Toggle checked={editing.requireSelfie} onChange={(v) => set("requireSelfie", v)} label="Require selfie at check-in" />
            <Toggle checked={editing.active} onChange={(v) => set("active", v)} label="Active" />
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <button
                onClick={remove}
                className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                {editing.id ? "Delete" : "Clear"}
              </button>
              {editing.id && (
                <button
                  onClick={() => setArchived(!editing.archived)}
                  disabled={saving}
                  className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300 disabled:opacity-50"
                >
                  {editing.archived ? "Unarchive" : "Archive"}
                </button>
              )}
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : editing.id ? "Save changes" : "Create project"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
      {label}
    </span>
    {children}
  </label>
)

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="accent-emerald-500"
    />
    {label}
  </label>
)
