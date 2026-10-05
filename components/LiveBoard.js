"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge, Bar, Icon, Empty } from "./ui"
import { perDayDivisor } from "@/lib/payroll"
import { formatMoney, formatDateLong } from "@/lib/format"

const fmtT = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Dhaka",
      })
    : "—"

export default function LiveBoard({ period, employees, settings }) {
  const [data, setData] = useState(null)
  const [now, setNow] = useState(Date.now())
  const c = settings.currency

  const load = useCallback(() => {
    const qs =
      period?.from && period?.to ? `?from=${period.from}&to=${period.to}` : ""
    fetch(`/api/attendance/board${qs}`)
      .then((r) => r.json())
      .then((j) => j?.ok && setData(j))
      .catch(() => {})
  }, [period?.from, period?.to])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const open = data?.open || []
  const sessions = data?.sessions || []

  const divisor = perDayDivisor(settings, period || { workingDays: 0 })
  const hoursPerDay = Number(settings.standardHoursPerDay) || 8
  const rateFor = (empId) => {
    const sal = employees[empId]?.salary || 0
    return sal > 0 ? sal / (divisor * hoursPerDay) : 0
  }

  const byProject = useMemo(() => {
    const m = {}
    for (const s of sessions) {
      const k = s.projectName || "—"
      if (!m[k]) m[k] = { project: k, minutes: 0, cost: 0, emps: new Set() }
      m[k].minutes += s.durationMin
      m[k].emps.add(s.employeeId)
      m[k].cost += (s.durationMin / 60) * rateFor(s.employeeId)
    }
    return Object.values(m)
      .map((x) => ({ ...x, employees: x.emps.size, hours: x.minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, employees, divisor, hoursPerDay])

  const totals = byProject.reduce(
    (t, p) => ({ minutes: t.minutes + p.minutes, cost: t.cost + p.cost }),
    { minutes: 0, cost: 0 },
  )
  const maxMin = Math.max(1, ...byProject.map((p) => p.minutes))

  const openByProject = useMemo(() => {
    const m = {}
    for (const s of open) (m[s.projectName || "—"] ||= []).push(s)
    return Object.entries(m)
  }, [open])

  const elapsed = (iso) => {
    const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="space-y-5">
      {/* On site now */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {open.length > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${open.length ? "bg-emerald-500" : "bg-slate-300"}`} />
            </span>
            On site now
            <Badge tone={open.length ? "green" : "slate"}>{open.length}</Badge>
          </span>
        }
      >
        {open.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No one is checked in right now.
          </p>
        ) : (
          <div className="space-y-4">
            {openByProject.map(([project, list]) => (
              <div key={project}>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Icon.pin className="w-3.5 h-3.5" /> {project}
                  <span className="text-slate-400">· {list.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {s.employeeName}
                        </span>
                        <span className="text-xs text-slate-400">
                          since {fmtT(s.checkInAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "pending" && <Badge tone="amber">review</Badge>}
                        <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {elapsed(s.checkInAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* By project — period */}
      <Panel
        title={
          <span className="flex items-center justify-between">
            <span>Labour by project</span>
            <span className="text-xs font-normal text-slate-400">
              {period?.from
                ? `${formatDateLong(period.from)} – ${formatDateLong(period.to)}`
                : "no period"}
            </span>
          </span>
        }
      >
        {byProject.length === 0 ? (
          <Empty
            icon={<Icon.pin className="w-7 h-7" />}
            title="No project hours yet"
            hint="App check-ins that are approved and checked out will roll up here per project."
          />
        ) : (
          <div className="table-scroll rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Project</th>
                  <th className="px-3 py-2.5 text-right font-semibold">People</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hours</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Share</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Est. labour cost</th>
                </tr>
              </thead>
              <tbody>
                {byProject.map((p) => (
                  <tr key={p.project} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium">{p.project}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.employees}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.hours.toFixed(1)}h</td>
                    <td className="px-3 py-2.5">
                      <div className="w-28"><Bar value={p.minutes} max={maxMin} tone="blue" /></div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      {p.cost > 0 ? formatMoney(p.cost, c) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-3 py-2.5">Total</td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{(totals.minutes / 60).toFixed(1)}h</td>
                  <td></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(totals.cost, c)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {byProject.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Cost = hours × each employee&apos;s hourly rate (salary ÷ {divisor} ÷ {hoursPerDay}h). Approved, checked-out sessions only.
          </p>
        )}
      </Panel>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h3>
      {children}
    </div>
  )
}
