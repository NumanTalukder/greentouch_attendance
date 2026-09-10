"use client"

import { useMemo, useState } from "react"
import { Icon, SortTH, Empty } from "./ui"
import { Toolbar, TableWrap } from "./DailyTable"
import { formatMoney, formatDateLong } from "@/lib/format"
import { exportCSV, printReport, printPayslips } from "@/lib/export"

export default function PayrollTable({
  payroll,
  settings,
  period,
  onApprove,
  onApproveAll,
  onPenalty,
  onBonus,
  onAdvance,
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState({ field: "id", dir: "asc" })

  const { rows: allRows, totals, divisor, excludedCount, pendingOtHours } =
    payroll
  const c = settings.currency
  const approval = settings.otApprovalRequired

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

  const subtitle = period.from
    ? `${formatDateLong(period.from)} – ${formatDateLong(period.to)}`
    : ""

  const setApproved = (id, val, worked) =>
    onApprove(id, Math.max(0, Math.min(Number(val) || 0, worked)))
  const setAmount = (fn, id, val) => fn(id, Math.max(0, Number(val) || 0))

  const csvCols = [
    { label: "ID", render: (r) => r.id },
    { label: "Name", render: (r) => r.name },
    { label: "Department", render: (r) => r.department },
    { label: "Salary", render: (r) => Math.round(r.salary) },
    { label: "Per Day", render: (r) => Math.round(r.perDay) },
    { label: "Present", render: (r) => r.presentDays },
    { label: "Absent", render: (r) => r.absentDays },
    { label: "Paid Leave Days", render: (r) => r.paidLeaveDays },
    { label: "Unpaid Absent", render: (r) => r.unpaidAbsentDays },
    { label: "Late", render: (r) => r.lateDays },
    { label: "Half Day", render: (r) => r.halfDays },
    { label: "Late Deduct Days", render: (r) => r.lateDeductionDays },
    { label: "OT Worked (h)", render: (r) => r.workedOtHours.toFixed(2) },
    { label: "OT Approved (h)", render: (r) => r.approvedOtHours.toFixed(2) },
    { label: "OT Pay", render: (r) => Math.round(r.otPay) },
    { label: "Absent Deduction", render: (r) => Math.round(r.absentDeduction) },
    { label: "Half Day Deduction", render: (r) => Math.round(r.halfDayDeduction) },
    { label: "Late Deduction", render: (r) => Math.round(r.lateDeduction) },
    { label: "Total Deductions", render: (r) => Math.round(r.totalDeductions) },
    { label: "Bonus", render: (r) => Math.round(r.bonus) },
    { label: "Penalty", render: (r) => Math.round(r.penalty) },
    { label: "Advance", render: (r) => Math.round(r.advance) },
    { label: "Net Payable", render: (r) => Math.round(r.netPayable) },
  ]

  const handlePrint = () =>
    printReport({
      title: "Payroll Register",
      subtitle,
      columns: [
        { label: "ID", num: true, render: (r) => r.id },
        { label: "Name", render: (r) => r.name },
        { label: "Salary", num: true, render: (r) => formatMoney(r.salary, c), total: (t) => formatMoney(t.salary, c) },
        { label: "P", num: true, render: (r) => r.presentDays },
        { label: "A", num: true, render: (r) => r.absentDays },
        { label: "L", num: true, render: (r) => r.lateDays },
        { label: "H", num: true, render: (r) => r.halfDays },
        { label: "OT", num: true, render: (r) => r.approvedOtHours.toFixed(1) + "h" },
        { label: "OT Pay", num: true, render: (r) => formatMoney(r.otPay, c), total: (t) => formatMoney(t.otPay, c) },
        { label: "Deduct.", num: true, render: (r) => formatMoney(r.totalDeductions, c), total: (t) => formatMoney(t.totalDeductions, c) },
        { label: "Bonus", num: true, render: (r) => formatMoney(r.bonus, c), total: (t) => formatMoney(t.bonus, c) },
        { label: "Penalty", num: true, render: (r) => formatMoney(r.penalty, c), total: (t) => formatMoney(t.penalty, c) },
        { label: "Advance", num: true, render: (r) => formatMoney(r.advance, c), total: (t) => formatMoney(t.advance, c) },
        { label: "Net Payable", num: true, render: (r) => formatMoney(r.netPayable, c), total: (t) => formatMoney(t.netPayable, c) },
      ],
      rows,
      totals,
      note: `Per-day = salary ÷ ${divisor}. OT ${settings.otMethod === "flat" ? `at ${formatMoney(settings.otHourlyRate, c)}/h` : `= salary ÷ (${divisor} × ${settings.standardHoursPerDay}h)`}, ${approval ? "approved hours only" : "all worked hours"}. Late: 1 day's pay per ${settings.lateGroupSize} late days. Half-day pays ${Math.round(settings.halfDayPayFactor * 100)}%. Only unpaid absences are deducted (approved paid leave is excluded). Net = salary + OT + bonus − deductions − penalty − advance (salary advance recovered).`,
    })

  if (!allRows.length && !excludedCount)
    return (
      <Empty
        icon={<Icon.wallet className="w-7 h-7" />}
        title="No payroll to compute"
        hint="Paste attendance data and set employee salaries in Employees to generate payroll."
      />
    )

  const noSalaries = allRows.every((r) => r.salary === 0)
  const numCell =
    "px-3 py-2 text-right tabular-nums"
  const adjInput = (value, onChange, tone) =>
    (
      <input
        type="number"
        min={0}
        step={100}
        value={value || ""}
        placeholder="0"
        onChange={onChange}
        className={`w-20 rounded-md border px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-emerald-400 dark:bg-slate-950 ${
          value > 0
            ? tone === "bonus"
              ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
              : "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
            : "border-slate-200 dark:border-slate-700"
        }`}
      />
    )

  return (
    <div>
      {/* Rules banner — keeps the money math auditable. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
        <span className="font-semibold uppercase tracking-wide">Rules</span>
        <span>Per-day = salary ÷ <b>{divisor}</b></span>
        <span>
          OT ={" "}
          <b>
            {settings.otMethod === "flat"
              ? `${formatMoney(settings.otHourlyRate, c)}/h`
              : `salary ÷ (${divisor} × ${settings.standardHoursPerDay}h)`}
          </b>{" "}
          {approval ? "(approved only)" : "(all worked)"}
        </span>
        <span>Late: 1 day per <b>{settings.lateGroupSize}</b> lates</span>
        <span>Half-day pays <b>{Math.round(settings.halfDayPayFactor * 100)}%</b></span>
        <span className="font-medium">Net = salary + OT + bonus − deductions − penalty − advance</span>
        <span className="text-emerald-600/80 dark:text-emerald-400/70">Edit in Settings</span>
      </div>

      {noSalaries && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <Icon.alert className="w-4 h-4" />
          No salaries set yet. Open <b>Employees</b> and add monthly salary to see real payroll figures.
        </div>
      )}

      {approval && pendingOtHours > 0.01 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-300">
          <Icon.clock className="w-4 h-4" />
          <span>
            <b>{pendingOtHours.toFixed(1)}h</b> of worked overtime is not yet approved, so it isn&apos;t being paid. Enter approved hours below (from the signed sheet) or
          </span>
          <button
            onClick={() =>
              onApproveAll(
                Object.fromEntries(allRows.map((r) => [r.id, r.workedOtHours])),
              )
            }
            className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            Approve all worked
          </button>
        </div>
      )}

      {excludedCount > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Icon.users className="w-3.5 h-3.5" />
          {excludedCount} active employee{excludedCount > 1 ? "s" : ""} excluded — no attendance recorded this period.
        </div>
      )}

      <Toolbar
        search={search}
        setSearch={setSearch}
        onCSV={() => exportCSV("payroll.csv", csvCols, rows)}
        onPrint={handlePrint}
        count={rows.length}
      >
        <button
          onClick={() => printPayslips(rows, settings, period)}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
        >
          <Icon.printer className="w-3.5 h-3.5" /> Payslips
        </button>
      </Toolbar>

      <TableWrap minWidth={1520}>
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide dark:bg-slate-800">
          <tr>
            <SortTH field="id" label="ID" sort={sort} setSort={setSort} num />
            <SortTH field="name" label="Employee" sort={sort} setSort={setSort} />
            <SortTH field="salary" label="Salary" sort={sort} setSort={setSort} num />
            <SortTH field="presentDays" label="Pres." sort={sort} setSort={setSort} num />
            <SortTH field="absentDays" label="Abs." sort={sort} setSort={setSort} num />
            <SortTH field="lateDays" label="Late" sort={sort} setSort={setSort} num />
            <SortTH field="halfDays" label="Half" sort={sort} setSort={setSort} num />
            <SortTH field="workedOtHours" label="OT worked" sort={sort} setSort={setSort} num />
            <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">OT approved</th>
            <SortTH field="otPay" label="OT Pay" sort={sort} setSort={setSort} num />
            <SortTH field="totalDeductions" label="Deductions" sort={sort} setSort={setSort} num />
            <th className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">Bonus (+)</th>
            <th className="px-3 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">Penalty (−)</th>
            <th className="px-3 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">Advance (−)</th>
            <SortTH field="netPayable" label="Net Payable" sort={sort} setSort={setSort} num />
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-slate-100 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className={`${numCell} text-slate-400`}>{r.id}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                <div className="text-xs text-slate-400">{r.designation} · {r.department}</div>
              </td>
              <td className={`${numCell} text-slate-700 dark:text-slate-200`}>{formatMoney(r.salary, c)}</td>
              <td className={`${numCell} text-emerald-600 dark:text-emerald-400`}>{r.presentDays}</td>
              <td className={numCell}>
                {r.absentDays > 0 ? (
                  <span
                    title={
                      r.paidLeaveDays > 0
                        ? `${r.absentDays} absent — ${r.paidLeaveDays} paid leave, ${r.unpaidAbsentDays} unpaid`
                        : undefined
                    }
                  >
                    <span className={r.unpaidAbsentDays > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                      {r.absentDays}
                    </span>
                    {r.paidLeaveDays > 0 && (
                      <span className="ml-1 text-xs text-emerald-500">−{r.paidLeaveDays}lv</span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">0</span>
                )}
              </td>
              <td className={numCell}>
                {r.lateDays > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400" title={`${r.lateDeductionDays} day(s) deducted`}>
                    {r.lateDays}
                    {r.lateDeductionDays > 0 && (
                      <span className="ml-1 text-xs text-rose-500">−{r.lateDeductionDays}d</span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">0</span>
                )}
              </td>
              <td className={numCell}>
                {r.halfDays > 0 ? (
                  <span className="text-orange-600 dark:text-orange-400">{r.halfDays}</span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">0</span>
                )}
              </td>
              <td className={`${numCell} text-slate-500`}>
                {r.workedOtHours > 0 ? `${r.workedOtHours.toFixed(1)}h` : <span className="text-slate-300 dark:text-slate-600">—</span>}
              </td>
              <td className="px-3 py-2 text-right">
                {!approval ? (
                  <span className="text-xs text-slate-400">auto</span>
                ) : r.workedOtHours === 0 ? (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={r.workedOtHours}
                    step={0.5}
                    value={r.approvedOtHours || 0}
                    onChange={(e) => setApproved(r.id, e.target.value, r.workedOtHours)}
                    className={`w-16 rounded-md border px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-emerald-400 dark:bg-slate-950 ${
                      r.approvedOtHours > 0
                        ? "border-emerald-300 dark:border-emerald-700"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  />
                )}
              </td>
              <td className={`${numCell} text-sky-600 dark:text-sky-400`}>
                {r.otPay > 0 ? formatMoney(r.otPay, c) : <span className="text-slate-300 dark:text-slate-600">—</span>}
              </td>
              <td className={numCell}>
                {r.totalDeductions > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400" title={`Absent(unpaid ${r.unpaidAbsentDays}d) ${formatMoney(r.absentDeduction, c)} · Half ${formatMoney(r.halfDayDeduction, c)} · Late ${formatMoney(r.lateDeduction, c)}`}>
                    −{formatMoney(r.totalDeductions, c)}
                  </span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {adjInput(r.bonus, (e) => setAmount(onBonus, r.id, e.target.value), "bonus")}
              </td>
              <td className="px-3 py-2 text-right">
                {adjInput(r.penalty, (e) => setAmount(onPenalty, r.id, e.target.value), "penalty")}
              </td>
              <td className="px-3 py-2 text-right">
                {adjInput(r.advance, (e) => setAmount(onAdvance, r.id, e.target.value), "penalty")}
              </td>
              <td className={`${numCell} text-base font-bold text-slate-900 dark:text-white`}>
                {formatMoney(r.netPayable, c)}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => printPayslips([r], settings, period)}
                  title="Print payslip"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Icon.printer className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-emerald-50 font-semibold dark:bg-emerald-900/30">
          <tr className="border-t-2 border-emerald-300 dark:border-emerald-800">
            <td className="px-3 py-2.5" colSpan={2}>Total ({rows.length})</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(totals.salary, c)}</td>
            <td className="px-3 py-2.5" colSpan={4}></td>
            <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{totals.workedOtHours.toFixed(1)}h</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{totals.approvedOtHours.toFixed(1)}h</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-sky-700 dark:text-sky-300">{formatMoney(totals.otPay, c)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-rose-700 dark:text-rose-300">−{formatMoney(totals.totalDeductions, c)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(totals.bonus, c)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-rose-700 dark:text-rose-300">−{formatMoney(totals.penalty, c)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-rose-700 dark:text-rose-300">−{formatMoney(totals.advance, c)}</td>
            <td className="px-3 py-2.5 text-right text-base tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(totals.netPayable, c)}</td>
            <td></td>
          </tr>
        </tfoot>
      </TableWrap>
    </div>
  )
}
