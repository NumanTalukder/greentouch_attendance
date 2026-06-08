"use client"

import { useMemo, useState } from "react"
import { Badge, Bar, Icon, SortTH, Empty } from "./ui"
import { Toolbar, TableWrap } from "./DailyTable"
import {
  minutesToHM,
  minutesToClock,
  formatPercent,
  formatDateLong,
} from "@/lib/format"
import { exportCSV, printReport } from "@/lib/export"

export default function SummaryTable({ summary, period }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ field: "id", dir: "asc" })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return summary
      .filter(
        (s) =>
          !q || `${s.name} ${s.id} ${s.department}`.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1
        if (a[sort.field] < b[sort.field]) return -1 * dir
        if (a[sort.field] > b[sort.field]) return 1 * dir
        return a.id - b.id
      })
  }, [summary, search, sort])

  const subtitle = period.from
    ? `${formatDateLong(period.from)} – ${formatDateLong(period.to)} · ${period.workingDays} working days`
    : ""

  const csvCols = [
    { label: "ID", render: (r) => r.id },
    { label: "Name", render: (r) => r.name },
    { label: "Department", render: (r) => r.department },
    { label: "Present", render: (r) => r.presentDays },
    { label: "On Time", render: (r) => r.onTimeDays },
    { label: "Late", render: (r) => r.lateDays },
    { label: "Half Day", render: (r) => r.halfDays },
    { label: "Incomplete", render: (r) => r.incompleteDays },
    { label: "Left Early", render: (r) => r.leftEarlyDays },
    { label: "Absent", render: (r) => r.absentDays },
    { label: "Work Hours", render: (r) => (r.workMinutes / 60).toFixed(1) },
    { label: "OT Hours", render: (r) => r.otHours.toFixed(1) },
    { label: "Attendance %", render: (r) => Math.round(r.attendanceRate * 100) },
  ]

  const handlePrint = () =>
    printReport({
      title: "Monthly Attendance Summary",
      subtitle,
      columns: [
        { label: "ID", num: true, render: (r) => r.id },
        { label: "Name", render: (r) => r.name },
        { label: "Dept", render: (r) => r.department },
        { label: "Present", num: true, render: (r) => r.presentDays },
        { label: "Absent", num: true, render: (r) => r.absentDays },
        { label: "Late", num: true, render: (r) => r.lateDays },
        { label: "Half", num: true, render: (r) => r.halfDays },
        { label: "Work", num: true, render: (r) => minutesToHM(r.workMinutes) },
        { label: "OT", num: true, render: (r) => minutesToClock(r.otMinutes) },
        { label: "Att%", num: true, render: (r) => Math.round(r.attendanceRate * 100) + "%" },
      ],
      rows,
      note: `Working days in period: ${period.workingDays}. Absent = working days − present days (respecting join dates and the configured weekend).`,
    })

  if (!summary.length)
    return (
      <Empty
        icon={<Icon.users className="w-7 h-7" />}
        title="No summary to show"
        hint="Paste attendance data to roll it up per employee."
      />
    )

  const rateTone = (r) =>
    r >= 0.95 ? "green" : r >= 0.8 ? "amber" : "red"

  return (
    <div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        onCSV={() => exportCSV("attendance-summary.csv", csvCols, rows)}
        onPrint={handlePrint}
        count={rows.length}
      />
      <TableWrap>
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide dark:bg-slate-800">
          <tr>
            <SortTH field="id" label="ID" sort={sort} setSort={setSort} num />
            <SortTH field="name" label="Employee" sort={sort} setSort={setSort} />
            <SortTH field="presentDays" label="Present" sort={sort} setSort={setSort} num />
            <SortTH field="absentDays" label="Absent" sort={sort} setSort={setSort} num />
            <SortTH field="lateDays" label="Late" sort={sort} setSort={setSort} num />
            <SortTH field="halfDays" label="Half" sort={sort} setSort={setSort} num />
            <SortTH field="incompleteDays" label="Incomp." sort={sort} setSort={setSort} num />
            <SortTH field="workMinutes" label="Work" sort={sort} setSort={setSort} num />
            <SortTH field="avgWorkMinutes" label="Avg/day" sort={sort} setSort={setSort} num />
            <SortTH field="otMinutes" label="OT" sort={sort} setSort={setSort} num />
            <SortTH field="attendanceRate" label="Attendance" sort={sort} setSort={setSort} num />
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              className="border-t border-slate-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className="px-3 py-2 text-right tabular-nums text-slate-400">{s.id}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {s.name}
                  </span>
                  {!s.known && <Badge tone="violet">unregistered</Badge>}
                  {s.noData && <Badge tone="slate">no punches</Badge>}
                </div>
                <div className="text-xs text-slate-400">{s.department}</div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                {s.presentDays}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.absentDays > 0 ? (
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {s.absentDays}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">0</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{cell(s.lateDays, "text-amber-600 dark:text-amber-400")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{cell(s.halfDays, "text-orange-600 dark:text-orange-400")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{cell(s.incompleteDays, "text-violet-600 dark:text-violet-400")}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                {minutesToHM(s.workMinutes)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                {s.avgWorkMinutes ? minutesToHM(s.avgWorkMinutes) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.otMinutes > 0 ? (
                  <Badge tone="blue">{minutesToClock(s.otMinutes)}</Badge>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                {s.attendanceRate == null ? (
                  <div className="text-right text-xs text-slate-300 dark:text-slate-600">
                    —
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16">
                      <Bar value={s.attendanceRate * 100} max={100} tone={rateTone(s.attendanceRate)} />
                    </div>
                    <span className="w-9 text-right text-xs font-medium tabular-nums text-slate-500">
                      {formatPercent(s.attendanceRate)}
                    </span>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

const cell = (n, cls) =>
  n > 0 ? (
    <span className={`font-medium ${cls}`}>{n}</span>
  ) : (
    <span className="text-slate-300 dark:text-slate-600">0</span>
  )
