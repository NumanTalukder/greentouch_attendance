"use client"

import { useMemo, useState } from "react"
import { Badge, Icon, SortTH, Empty } from "./ui"
import { Toolbar, TableWrap } from "./DailyTable"
import { exportCSV } from "@/lib/export"

export default function LeaveTable({ leave, period, monthKey, onEarned, onSick }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ field: "id", dir: "asc" })

  const { rows: allRows, range, entE, entS } = leave

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows
      .filter(
        (r) =>
          !q || `${r.name} ${r.id} ${r.department}`.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1
        if (a[sort.field] < b[sort.field]) return -1 * dir
        if (a[sort.field] > b[sort.field]) return 1 * dir
        return a.id - b.id
      })
  }, [allRows, search, sort])

  const csvCols = [
    { label: "ID", render: (r) => r.id },
    { label: "Name", render: (r) => r.name },
    { label: "Absent", render: (r) => r.absentDays },
    { label: "Earned taken (month)", render: (r) => r.earnedMonth },
    { label: "Sick taken (month)", render: (r) => r.sickMonth },
    { label: "Unpaid absent", render: (r) => r.unpaidAbsent },
    { label: "Earned YTD", render: (r) => r.earnedYTD },
    { label: "Earned left", render: (r) => r.earnedLeft },
    { label: "Sick YTD", render: (r) => r.sickYTD },
    { label: "Sick left", render: (r) => r.sickLeft },
  ]

  if (!monthKey)
    return (
      <Empty
        icon={<Icon.leaf className="w-7 h-7" />}
        title="Paste a month first"
        hint="Leave is recorded against a pay month. Paste attendance data, then approve each employee's earned and sick days here."
      />
    )

  const numInput = (value, onChange, over) => (
    <input
      type="number"
      min={0}
      step={1}
      value={value || ""}
      placeholder="0"
      onChange={onChange}
      className={`w-16 rounded-md border px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-emerald-400 dark:bg-slate-950 ${
        over
          ? "border-rose-400 text-rose-600 dark:text-rose-300"
          : value > 0
            ? "border-emerald-300 dark:border-emerald-700"
            : "border-slate-200 dark:border-slate-700"
      }`}
    />
  )

  const balCell = (used, ent, left) => (
    <div className="flex items-center justify-end gap-1.5">
      <span className="tabular-nums text-slate-500">
        {used}/{ent}
      </span>
      <Badge tone={left < 0 ? "red" : left === 0 ? "amber" : "green"}>
        {left < 0 ? `${left}` : `${left} left`}
      </Badge>
    </div>
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
        <span className="font-semibold uppercase tracking-wide">Leave year</span>
        <span className="font-medium">{range?.label || "—"}</span>
        <span>Entitlement: <b>{entE}</b> earned · <b>{entS}</b> sick</span>
        <span>Recording for <b>{monthKey}</b></span>
        <span className="text-emerald-600/80 dark:text-emerald-400/70">
          Approved (paid) leave isn&apos;t deducted — only unpaid absence is
        </span>
      </div>

      {!allRows.length ? (
        <Empty
          icon={<Icon.leaf className="w-7 h-7" />}
          title="No employees to show"
          hint="Add active employees or paste attendance data."
        />
      ) : (
        <>
          <Toolbar
            search={search}
            setSearch={setSearch}
            onCSV={() => exportCSV(`leave-${monthKey}.csv`, csvCols, rows)}
            onPrint={() => window.print()}
            count={rows.length}
          />
          <TableWrap minWidth={920}>
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide dark:bg-slate-800">
              <tr>
                <SortTH field="id" label="ID" sort={sort} setSort={setSort} num />
                <SortTH field="name" label="Employee" sort={sort} setSort={setSort} />
                <SortTH field="absentDays" label="Absent" sort={sort} setSort={setSort} num />
                <th className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">Earned taken</th>
                <th className="px-3 py-2.5 text-right font-semibold text-sky-600 dark:text-sky-400">Sick taken</th>
                <SortTH field="unpaidAbsent" label="Unpaid absent" sort={sort} setSort={setSort} num />
                <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Earned balance</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Sick balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{r.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.department}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.absentDays > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{r.absentDays}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numInput(
                      r.earnedMonth,
                      (e) => onEarned(r.id, Math.max(0, Number(e.target.value) || 0)),
                      r.earnedLeft < 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numInput(
                      r.sickMonth,
                      (e) => onSick(r.id, Math.max(0, Number(e.target.value) || 0)),
                      r.sickLeft < 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.unpaidAbsent > 0 ? (
                      <span className="font-medium text-rose-600 dark:text-rose-400" title="Deducted in payroll">
                        {r.unpaidAbsent}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{balCell(r.earnedYTD, entE, r.earnedLeft)}</td>
                  <td className="px-3 py-2">{balCell(r.sickYTD, entS, r.sickLeft)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </div>
  )
}
