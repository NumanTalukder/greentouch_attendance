"use client"

import { Bar, Badge, Icon, StatCard, Empty } from "./ui"
import {
  formatMoney,
  formatPercent,
  formatHours,
  formatDateLong,
  formatDate,
} from "@/lib/format"

export default function Dashboard({
  dashboard,
  payroll,
  period,
  settings,
  unknownIds,
  onManage,
}) {
  if (!dashboard) return null
  const { totals, byDate, topLate, perfect, noData } = dashboard

  if (totals.presentDays === 0)
    return (
      <Empty
        icon={<Icon.dashboard className="w-7 h-7" />}
        title="Your dashboard is waiting"
        hint="Paste the machine export above and this fills with live attendance and payroll insight."
      />
    )

  const maxDay = Math.max(...byDate.map((d) => d.present), 1)
  const dist = [
    { label: "On time", value: totals.onTimeDays, tone: "green", cls: "bg-emerald-500" },
    { label: "Late", value: totals.lateDays, tone: "amber", cls: "bg-amber-500" },
    { label: "Half day", value: totals.halfDays, tone: "orange", cls: "bg-orange-500" },
    { label: "Incomplete", value: totals.incompleteDays, tone: "violet", cls: "bg-violet-500" },
  ]
  const distTotal = dist.reduce((a, b) => a + b.value, 0) || 1

  return (
    <div className="space-y-5">
      {/* Period strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm">
          <Icon.calendar className="w-4 h-4 text-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {formatDateLong(period.from)} – {formatDateLong(period.to)}
          </span>
          <Badge tone="slate">{period.workingDays} working days</Badge>
        </div>
        <span className="text-xs text-slate-400">
          {totals.activeWithData} employees in this data
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Icon.users className="w-4 h-4" />}
          label="Employees"
          value={totals.activeWithData}
          sub={`${period.workingDays} working days`}
          tone="slate"
        />
        <StatCard
          icon={<Icon.check className="w-4 h-4" />}
          label="On-time rate"
          value={formatPercent(totals.onTimeRate)}
          sub={`${totals.onTimeDays} of ${totals.presentDays} present days`}
          tone="green"
        />
        <StatCard
          icon={<Icon.clock className="w-4 h-4" />}
          label="Late arrivals"
          value={totals.lateDays}
          sub={`${totals.halfDays} half days`}
          tone="amber"
        />
        <StatCard
          icon={<Icon.alert className="w-4 h-4" />}
          label="Absent days"
          value={totals.absentDays}
          sub={`${formatPercent(totals.attendanceRate)} attendance`}
          tone="red"
        />
        <StatCard
          icon={<Icon.trend className="w-4 h-4" />}
          label="Overtime"
          value={formatHours(totals.otMinutes)}
          sub={`${formatMoney(payroll.totals.otPay, settings.currency)} OT pay`}
          tone="blue"
        />
        <StatCard
          icon={<Icon.clock className="w-4 h-4" />}
          label="Total work hours"
          value={formatHours(totals.workMinutes)}
          sub="across all employees"
          tone="slate"
        />
        <StatCard
          icon={<Icon.wallet className="w-4 h-4" />}
          label="Net payroll"
          value={formatMoney(payroll.totals.netPayable, settings.currency)}
          sub={`${formatMoney(payroll.totals.totalDeductions, settings.currency)} deductions`}
          tone="green"
        />
        <StatCard
          icon={<Icon.spark className="w-4 h-4" />}
          label="Perfect attendance"
          value={perfect.length}
          sub="no late, half or absent"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status distribution */}
        <Panel title="Punctuality mix" className="lg:col-span-1">
          <div className="flex h-3 overflow-hidden rounded-full">
            {dist.map(
              (d) =>
                d.value > 0 && (
                  <div
                    key={d.label}
                    className={d.cls}
                    style={{ width: `${(d.value / distTotal) * 100}%` }}
                    title={`${d.label}: ${d.value}`}
                  />
                ),
            )}
          </div>
          <div className="mt-4 space-y-2">
            {dist.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className={`h-2.5 w-2.5 rounded-full ${d.cls}`} />
                  {d.label}
                </span>
                <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">
                  {d.value}{" "}
                  <span className="text-xs text-slate-400">
                    ({Math.round((d.value / distTotal) * 100)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Attendance per day */}
        <Panel title="Attendance by day" className="lg:col-span-2">
          {byDate.length === 0 ? (
            <p className="text-sm text-slate-400">No daily data.</p>
          ) : (
            <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
              {byDate.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" style={{ minWidth: 22 }}>
                  <span className="text-[10px] tabular-nums text-slate-400">{d.present}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400"
                    style={{ height: `${(d.present / maxDay) * 90 + 6}px` }}
                    title={`${formatDate(d.date)} · ${d.present} present · ${d.late} late/half`}
                  />
                  <span className="rotate-0 text-[10px] text-slate-400">
                    {d.date.slice(8)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Late watchlist */}
        <Panel title="Most late arrivals">
          {topLate.length === 0 ? (
            <p className="text-sm text-slate-400">Nobody was late 🎉</p>
          ) : (
            <ul className="space-y-2.5">
              {topLate.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {s.name}
                  </span>
                  <div className="flex-1">
                    <Bar value={s.lateDays} max={topLate[0].lateDays} tone="amber" />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-slate-500">
                    {s.lateDays} late
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Perfect attendance */}
        <Panel title="Perfect attendance">
          {perfect.length === 0 ? (
            <p className="text-sm text-slate-400">No perfect records this period.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {perfect.map((s) => (
                <Badge key={s.id} tone="green">
                  <Icon.check className="w-3 h-3" /> {s.name}
                </Badge>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Data-quality nudges */}
      {(unknownIds.length > 0 ||
        totals.incompleteDays > 0 ||
        noData.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {unknownIds.length > 0 && (
            <button
              onClick={onManage}
              className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-left transition hover:border-violet-300 dark:border-violet-900/50 dark:bg-violet-900/20"
            >
              <Icon.users className="mt-0.5 w-5 h-5 text-violet-500" />
              <div>
                <p className="font-medium text-violet-800 dark:text-violet-300">
                  {unknownIds.length} unregistered ID{unknownIds.length > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-violet-600 dark:text-violet-400/80">
                  IDs {unknownIds.slice(0, 8).join(", ")}
                  {unknownIds.length > 8 ? "…" : ""} appear in the data. Click to name them.
                </p>
              </div>
            </button>
          )}
          {totals.incompleteDays > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <Icon.alert className="mt-0.5 w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {totals.incompleteDays} incomplete day{totals.incompleteDays > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400/80">
                  Only one punch was recorded — a missing check-in or check-out. Work hours cannot be computed for these.
                </p>
              </div>
            </div>
          )}
          {noData.length > 0 && (
            <button
              onClick={onManage}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon.users className="mt-0.5 w-5 h-5 text-slate-400" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {noData.length} employee{noData.length > 1 ? "s" : ""} with no punches
                </p>
                <p className="text-sm text-slate-500">
                  {noData.slice(0, 4).map((s) => s.name).join(", ")}
                  {noData.length > 4 ? "…" : ""} aren&apos;t in this period&apos;s data. Mark inactive if they&apos;ve left, or check the export.
                </p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h3>
      {children}
    </div>
  )
}
