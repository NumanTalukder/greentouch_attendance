"use client"

import { useMemo, useState } from "react"
import { Badge, Icon, SortTH, StatusBadge, Empty } from "./ui"
import {
  formatDate,
  formatTime12,
  minutesToHM,
  minutesToClock,
} from "@/lib/format"
import { exportCSV, printReport } from "@/lib/export"
import { formatDateLong } from "@/lib/format"

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Late", label: "Late" },
  { value: "Half Day", label: "Half day" },
  { value: "Incomplete", label: "Incomplete" },
  { value: "early", label: "Left early" },
  { value: "ot", label: "Overtime" },
]

export default function DailyTable({ records, period, settings }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState({ field: "date", dir: "asc" })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = records.filter((r) => {
      if (q && !`${r.name} ${r.id} ${r.department}`.toLowerCase().includes(q))
        return false
      if (filter === "all") return true
      if (filter === "early") return r.leftEarly
      if (filter === "ot") return r.otMinutes > 0
      return r.status === filter
    })
    rows = rows.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      const av = a[sort.field]
      const bv = b[sort.field]
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return a.id - b.id
    })
    return rows
  }, [records, search, filter, sort])

  const counts = useMemo(() => {
    const c = { Late: 0, "Half Day": 0, Incomplete: 0, early: 0, ot: 0 }
    for (const r of records) {
      if (c[r.status] != null) c[r.status]++
      if (r.leftEarly) c.early++
      if (r.otMinutes > 0) c.ot++
    }
    return c
  }, [records])

  const csvCols = [
    { label: "ID", render: (r) => r.id },
    { label: "Name", render: (r) => r.name },
    { label: "Department", render: (r) => r.department },
    { label: "Date", render: (r) => r.date },
    { label: "Day", render: (r) => r.weekday },
    { label: "Check In", render: (r) => formatTime12(r.first) },
    { label: "Check Out", render: (r) => formatTime12(r.last) },
    { label: "Punches", render: (r) => r.punchCount },
    { label: "Work (min)", render: (r) => r.workMinutes },
    { label: "Status", render: (r) => r.status },
    { label: "Late (min)", render: (r) => r.lateMinutes },
    { label: "OT (min)", render: (r) => r.otMinutes },
  ]

  const subtitle = period.from
    ? `${formatDateLong(period.from)} – ${formatDateLong(period.to)}`
    : ""

  const handlePrint = () =>
    printReport({
      title: "Daily Attendance",
      subtitle,
      columns: [
        { label: "ID", num: true, render: (r) => r.id },
        { label: "Name", render: (r) => r.name },
        { label: "Date", render: (r) => formatDate(r.date) },
        { label: "In", num: true, render: (r) => formatTime12(r.first) },
        { label: "Out", num: true, render: (r) => formatTime12(r.last) },
        { label: "Work", num: true, render: (r) => minutesToHM(r.workMinutes) },
        { label: "OT", num: true, render: (r) => minutesToClock(r.otMinutes) },
        { label: "Status", render: (r) => r.status },
      ],
      rows: filtered,
    })

  if (!records.length)
    return (
      <Empty
        icon={<Icon.calendar className="w-7 h-7" />}
        title="No attendance yet"
        hint="Paste your machine data above to see daily check-in / check-out records."
      />
    )

  return (
    <div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        onCSV={() => exportCSV("daily-attendance.csv", csvCols, filtered)}
        onPrint={handlePrint}
        count={filtered.length}
      >
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.value
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
              {f.value !== "all" && counts[f.value] > 0 && (
                <span className="ml-1 opacity-70">{counts[f.value]}</span>
              )}
            </button>
          ))}
        </div>
      </Toolbar>

      <TableWrap>
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide dark:bg-slate-800">
          <tr>
            <SortTH field="id" label="ID" sort={sort} setSort={setSort} num />
            <SortTH field="name" label="Name" sort={sort} setSort={setSort} />
            <SortTH field="date" label="Date" sort={sort} setSort={setSort} />
            <SortTH field="firstMin" label="Check In" sort={sort} setSort={setSort} num />
            <SortTH field="lastMin" label="Check Out" sort={sort} setSort={setSort} num />
            <SortTH field="workMinutes" label="Work" sort={sort} setSort={setSort} num />
            <SortTH field="otMinutes" label="OT" sort={sort} setSort={setSort} num />
            <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr
              key={`${r.id}-${r.date}`}
              className="border-t border-slate-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                {r.id}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {r.name}
                </div>
                <div className="text-xs text-slate-400">{r.department}</div>
              </td>
              <td className="px-3 py-2">
                <div className="text-slate-700 dark:text-slate-200">
                  {formatDate(r.date)}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={r.isLate || r.isHalf ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                  {formatTime12(r.first)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className={r.leftEarly ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
                  {r.incomplete ? "—" : formatTime12(r.last)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                {r.incomplete ? "—" : minutesToHM(r.workMinutes)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.otMinutes > 0 ? (
                  <Badge tone="blue">{minutesToClock(r.otMinutes)}</Badge>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={r.status} />
                  {r.punchCount === 1 && (
                    <span className="text-xs text-violet-500" title="Only one punch recorded">
                      1 punch
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// ---- shared table chrome (kept local to avoid prop drilling) ----

export function Toolbar({ search, setSearch, onCSV, onPrint, count, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon.search className="w-4 h-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, department…"
            className="w-64 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-emerald-900/40"
          />
        </div>
        {children}
      </div>
      <div className="flex items-center gap-2">
        {count != null && (
          <span className="text-sm text-slate-400">{count} rows</span>
        )}
        <button
          onClick={onCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon.download className="w-4 h-4" /> CSV
        </button>
        <button
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Icon.printer className="w-4 h-4" /> Print
        </button>
      </div>
    </div>
  )
}

export function TableWrap({ children, minWidth = 820 }) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}
