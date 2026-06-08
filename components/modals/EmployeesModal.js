"use client"

import { useMemo, useState } from "react"
import Modal from "./Modal"
import { Badge, Icon } from "../ui"
import { blankEmployee } from "@/lib/constants"

const inputCls =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"

export default function EmployeesModal({
  employees,
  setEmployees,
  unknownIds = [],
  currency = "৳",
  onClose,
}) {
  const [search, setSearch] = useState("")
  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")

  const ids = useMemo(() => {
    const q = search.trim().toLowerCase()
    return Object.keys(employees)
      .filter((id) => {
        const e = employees[id]
        return (
          !q ||
          `${e.name} ${id} ${e.department} ${e.designation}`
            .toLowerCase()
            .includes(q)
        )
      })
      .sort((a, b) => Number(a) - Number(b))
  }, [employees, search])

  const patch = (id, key, value) =>
    setEmployees((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))

  const remove = (id) =>
    setEmployees((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

  const add = (id, name = "") => {
    const key = String(id).trim()
    if (!key) return alert("ID is required")
    if (employees[key]) return alert("That ID already exists")
    setEmployees((prev) => ({ ...prev, [key]: blankEmployee(name) }))
    setNewId("")
    setNewName("")
  }

  return (
    <Modal
      title="Employees"
      subtitle="Names, departments and salaries used across attendance & payroll"
      width="max-w-4xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {Object.keys(employees).length} employees · saved automatically
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
      {/* Unregistered IDs from the pasted data */}
      {unknownIds.length > 0 && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/50 dark:bg-violet-900/20">
          <p className="mb-2 text-sm font-medium text-violet-800 dark:text-violet-300">
            IDs in your data without a name
          </p>
          <div className="flex flex-wrap gap-2">
            {unknownIds.map((id) => (
              <button
                key={id}
                onClick={() => add(id)}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-violet-700 shadow-sm hover:bg-violet-100 dark:bg-slate-800 dark:text-violet-300"
              >
                <Icon.plus className="w-3 h-3" /> Add #{id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + quick add */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon.search className="w-4 h-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
            className={`${inputCls} w-full py-1.5 pl-8`}
          />
        </div>
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value.replace(/\D/g, ""))}
          placeholder="ID"
          className={`${inputCls} w-20`}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New employee name"
          className={`${inputCls} w-48`}
        />
        <button
          onClick={() => add(newId, newName)}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
        >
          <Icon.plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Employee cards */}
      <div className="space-y-2">
        {ids.map((id) => {
          const e = employees[id]
          return (
            <div
              key={id}
              className={`rounded-lg border p-3 ${
                e.active === false
                  ? "border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-950/40"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge tone="slate">#{id}</Badge>
                <input
                  value={e.name}
                  onChange={(ev) => patch(id, "name", ev.target.value)}
                  className={`${inputCls} flex-1 font-medium`}
                  placeholder="Full name"
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={e.active !== false}
                    onChange={(ev) => patch(id, "active", ev.target.checked)}
                    className="accent-emerald-500"
                  />
                  Active
                </label>
                <button
                  onClick={() => remove(id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  title="Remove employee"
                >
                  <Icon.trash className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Field label="Designation">
                  <input
                    value={e.designation || ""}
                    onChange={(ev) => patch(id, "designation", ev.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </Field>
                <Field label="Department">
                  <input
                    value={e.department || ""}
                    onChange={(ev) => patch(id, "department", ev.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </Field>
                <Field label={`Salary (${currency})`}>
                  <input
                    type="number"
                    value={e.salary || 0}
                    onChange={(ev) => patch(id, "salary", Number(ev.target.value))}
                    className={`${inputCls} w-full tabular-nums`}
                  />
                </Field>
                <Field label="Join date">
                  <input
                    type="date"
                    value={e.joinDate || ""}
                    onChange={(ev) => patch(id, "joinDate", ev.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={e.phone || ""}
                    onChange={(ev) => patch(id, "phone", ev.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </Field>
              </div>
            </div>
          )
        })}
        {ids.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            No employees match “{search}”.
          </p>
        )}
      </div>
    </Modal>
  )
}

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
      {label}
    </span>
    {children}
  </label>
)
