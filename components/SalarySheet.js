"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon, Segmented, StatCard, Empty } from "./ui"
import { formatMoney } from "@/lib/format"
import { computeSalary, monthInfo, WD } from "@/lib/salaryCalc"
import { buildSalaryInput, advanceSchedule, advanceProgress, advanceDue } from "@/lib/salaryInput"

const pad = (n) => String(n).padStart(2, "0")
const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const niceMonth = (month) => monthInfo(month).label.replace("-", " ")
const n0 = (v) => Math.round(Number(v) || 0).toLocaleString("en-US") // same grouping as formatMoney

// Compact money/number input for dense tables.
function NumIn({ value, onChange, disabled, label, width = "w-20", step = "1" }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      aria-label={label}
      disabled={disabled}
      value={value ? value : ""}
      placeholder="0"
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={`${width} rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm tabular-nums outline-none transition placeholder:text-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600`}
    />
  )
}

// Number input that may be filled automatically (ledger / machine). Shows
// where the value came from, and ↺ to drop a typed value.
function AutoNum({ value, src, autoTag, onChange, onRevert, disabled, label, width, step }) {
  return (
    <div className="inline-flex items-center justify-end gap-1">
      {src === "manual" && !disabled ? (
        <button
          onClick={onRevert}
          title="Typed for this month. Click to use the automatic value."
          aria-label={`Restore automatic value: ${label}`}
          className="cursor-pointer rounded px-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30"
        >
          ↺
        </button>
      ) : src !== "manual" && src !== "none" && value ? (
        <span className="rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          {autoTag}
        </span>
      ) : null}
      <NumIn label={label} value={value} onChange={onChange} disabled={disabled} width={width} step={step} />
    </div>
  )
}

// One day in the attendance strip: P / A / ½, with where the value came from.
function DayCell({ value, source, label, off, disabled, onToggle }) {
  const absent = value === 0
  const half = value > 0 && value < 1
  const tone = absent
    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    : half
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : off
        ? "bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
  const word = absent ? "Absent" : half ? "Half day" : "Present"
  const src = { data: "from attendance data", override: "edited", default: off ? "weekend / holiday" : "no data — default present" }[source]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => onToggle(e.shiftKey)}
      title={`${label} · ${word} · ${src}`}
      aria-label={`${label}: ${word}, ${src}`}
      className={`relative h-6 w-5 shrink-0 rounded text-[10px] font-semibold leading-6 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 enabled:cursor-pointer enabled:hover:brightness-95 disabled:cursor-not-allowed ${tone}`}
    >
      {absent ? "A" : half ? "½" : "P"}
      {source === "override" && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-500 ring-1 ring-white dark:ring-slate-900" />
      )}
      {source === "data" && (
        <span className="absolute bottom-0.5 left-1/2 h-0.5 w-2.5 -translate-x-1/2 rounded bg-current opacity-50" />
      )}
    </button>
  )
}

const TH = ({ children, right, className = "" }) => (
  <th
    className={`whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${right ? "text-right" : "text-left"} ${className}`}
  >
    {children}
  </th>
)
const TD = ({ children, right, className = "" }) => (
  <td className={`whitespace-nowrap px-2 py-1.5 ${right ? "text-right tabular-nums" : ""} ${className}`}>
    {children}
  </td>
)
const stickyCls =
  "sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-slate-900 dark:group-hover:bg-[#182234]" // opaque = slate-800/60 over slate-900, so scrolled days never show through

export default function SalarySheet({
  employees,
  setEmployees,
  settings,
  adjustments,
  updateMonth,
  advances = [],
  setAdvances,
  records,
  coverage,
  currency = "৳",
  onOpenEmployees,
  month, // the app-wide month (shared with every tab)
  setMonth,
}) {
  const [view, setView] = useState("staff")
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [showDays, setShowDays] = useState(true)

  // Respect month locks from Records (finalised months are read-only here).
  useEffect(() => {
    let off = false
    fetch("/api/records")
      .then((r) => r.json())
      .then((j) => {
        if (!off) setLocked(!!(j?.data || []).find((m) => m.month === month && m.locked))
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [month])

  const built = useMemo(
    () => buildSalaryInput({ month, employees, settings, adjustments, advances, records, coverage }),
    [month, employees, settings, adjustments, advances, records, coverage],
  )
  const calc = useMemo(() => computeSalary(built.input), [built])
  const mi = useMemo(() => monthInfo(month), [month])
  const t = calc.totals
  const grand = t.staffNet + t.dirNet // OT & bonus are inside staff net, like Payroll

  const setAdj = useCallback(
    (field, key, value) => updateMonth(month, field, (m) => ({ ...m, [key]: value })),
    [month, updateMonth],
  )

  // Drop a typed value so the automatic one (ledger / machine) applies again.
  const clearAdj = useCallback(
    (field, key) =>
      updateMonth(month, field, (m) => {
        const next = { ...m }
        delete next[key]
        return next
      }),
    [month, updateMonth],
  )

  const toggleDay = (key, d, current, natural, half) => {
    const next = half ? (current === 0.5 ? 1 : 0.5) : current >= 1 ? 0 : 1
    updateMonth(month, "days", (all) => {
      const row = { ...(all[key] || {}) }
      if (next === natural) delete row[d]
      else row[d] = next
      return { ...all, [key]: row }
    })
  }
  const resetRow = (key) =>
    updateMonth(month, "days", (all) => {
      const next = { ...all }
      delete next[key]
      return next
    })

  const addToSheet = (key, group) =>
    setEmployees((prev) => {
      const maxOrder = Math.max(0, ...Object.values(prev).map((e) => Number(e.sheetOrder) || 0))
      return { ...prev, [key]: { ...prev[key], payGroup: group, sheetOrder: maxOrder + 1 } }
    })

  const download = async () => {
    setBusy(true)
    setNote(null)
    try {
      const { salaryWorkbookBuffer, salaryFileName } = await import("@/lib/salarySheet")
      const { buf } = await salaryWorkbookBuffer(built.input)
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = salaryFileName(month)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setNote({ tone: "ok", text: `Downloaded ${salaryFileName(month)}` })
    } catch (e) {
      setNote({ tone: "err", text: `Could not build the workbook: ${e.message}` })
    }
    setBusy(false)
  }

  const empty = !calc.staff.length && !calc.directors.length
  const dayLabels = Array.from({ length: mi.days }, (_, i) => {
    const dow = new Date(Date.UTC(mi.y, mi.m - 1, i + 1)).getUTCDay()
    const iso = `${mi.y}-${pad(mi.m)}-${pad(i + 1)}`
    return {
      d: i + 1,
      wd: WD[dow],
      iso,
      off: (settings.weekendDays || [5]).includes(dow) || (settings.holidays || []).includes(iso),
      label: new Date(Date.UTC(mi.y, mi.m - 1, i + 1)).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", weekday: "short", timeZone: "UTC",
      }),
    }
  })

  return (
    <div className="space-y-4">
      {/* Header: month + primary action */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Icon.sheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Salary sheet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The accounts workbook: Remuneration · Salary &amp; Wages · Overtime · Payment Summary
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Previous month"
              className="cursor-pointer rounded-l-lg px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              ‹
            </button>
            <span className="min-w-[120px] px-2 text-center text-sm font-semibold tabular-nums">
              {niceMonth(month)}
            </span>
            <button
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Next month"
              className="cursor-pointer rounded-r-lg px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              ›
            </button>
          </div>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <Icon.lock className="h-3.5 w-3.5" /> Locked
            </span>
          )}
          <button
            onClick={download}
            disabled={busy || empty}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
          >
            <Icon.download className="h-4 w-4" />
            {busy ? "Preparing…" : "Download .xlsx"}
          </button>
        </div>
      </div>

      {note && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg px-3 py-2 text-sm ${note.tone === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"}`}
        >
          {note.text}
        </div>
      )}

      {empty ? (
        <Empty
          icon={<Icon.sheet className="h-6 w-6" />}
          title="No one is on the salary sheet yet"
          hint="Open Employees and set each person's Pay group to Staff or Director."
        />
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Staff net" value={formatMoney(t.staffNet, currency)} sub={`${calc.staff.length} staff · gross ${formatMoney(t.staffGross, currency)}`} icon={<Icon.users className="h-4 w-4" />} />
            <StatCard label="Directors net" value={formatMoney(t.dirNet, currency)} sub={`${calc.directors.length} directors`} icon={<Icon.building className="h-4 w-4" />} />
            <StatCard label="Overtime pay" value={formatMoney(t.otPay, currency)} sub={`${calc.otRows.length} people · included in staff net`} icon={<Icon.clock className="h-4 w-4" />} tone="amber" />
            <StatCard label="Total payable" value={formatMoney(grand, currency)} sub={`deductions ${formatMoney(t.staffDed + t.dirDed, currency)}`} icon={<Icon.wallet className="h-4 w-4" />} tone="green" />
          </div>

          {/* Notices */}
          {locked && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              <Icon.lock className="h-4 w-4 shrink-0" />
              {niceMonth(month)} is locked in Records, so editing is off. You can still download it.
            </p>
          )}
          {built.dataNotTicked.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              <Icon.alert className="h-4 w-4 shrink-0" />
              <span>
                {built.dataNotTicked.map((k) => employees[k]?.name || `#${k}`).join(", ")}{" "}
                {built.dataNotTicked.length === 1 ? "has" : "have"} attendance data for {niceMonth(month)} but{" "}
                {built.dataNotTicked.length === 1 ? "isn’t" : "aren’t"} ticked as machine staff, so it isn’t used here (no late/absent deductions).
              </span>
              {onOpenEmployees && (
                <button onClick={onOpenEmployees} className="cursor-pointer font-semibold underline underline-offset-2 hover:no-underline">
                  Tick “On machine” in Employees
                </button>
              )}
            </div>
          )}
          {built.machineStaffWithoutData > 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-300">
              <Icon.alert className="h-4 w-4 shrink-0" />
              {built.machineStaffWithoutData} machine staff have no machine data for {niceMonth(month)} yet, so they show as present. Paste that month’s export on the Dashboard to fill in their days.
            </p>
          )}

          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "staff", label: "Salary & Wages", count: calc.staff.length },
              { value: "directors", label: "Remuneration", count: calc.directors.length },
              { value: "overtime", label: "Overtime", count: calc.otRows.length },
              { value: "advances", label: "Advances", count: advances.filter((a) => advanceProgress(a, month).remaining > 0 || advanceDue(advances, a.key, month)).length },
              { value: "off", label: "Not on sheet", count: built.notOnSheet.length },
            ]}
          />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              {view === "staff" && (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <tr>
                      <TH className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800">
                        <div className="flex items-center gap-2">
                          Employee
                          <button
                            onClick={() => setShowDays((v) => !v)}
                            className="cursor-pointer rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-600 dark:text-slate-300"
                          >
                            {showDays ? "Hide days" : "Show days"}
                          </button>
                        </div>
                      </TH>
                      {showDays && (
                        <TH>
                          <div className="flex gap-0.5 normal-case">
                            {dayLabels.map((x) => (
                              <span key={x.d} className={`w-5 text-center text-[10px] leading-tight ${x.off ? "text-slate-400" : ""}`}>
                                {x.d}
                                <br />
                                <span className="font-normal">{x.wd}</span>
                              </span>
                            ))}
                          </div>
                        </TH>
                      )}
                      <TH right>Salary</TH>
                      <TH right>Pres.</TH>
                      <TH right>Abs.</TH>
                      <TH right>Late</TH>
                      <TH right>Half</TH>
                      <TH right>OT worked</TH>
                      <TH right>OT approved</TH>
                      <TH right>OT pay</TH>
                      <TH right>Deductions</TH>
                      <TH right className="text-emerald-600 dark:text-emerald-400">Bonus (+)</TH>
                      <TH right className="text-rose-600 dark:text-rose-400">Penalty (−)</TH>
                      <TH right className="text-rose-600 dark:text-rose-400">Advance (−)</TH>
                      <TH right className="text-rose-600 dark:text-rose-400">AIT (−)</TH>
                      <TH right>Net payable</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {calc.staff.map((s, i) => {
                      const meta = built.staffMeta[i]
                      const edited = meta.sources.includes("override")
                      const dedTitle = [
                        `Absent ${n0(s.lwp)} (${s.lwpDays} day${s.lwpDays === 1 ? "" : "s"} unpaid${s.leaveDays ? `, ${s.leaveDays} on paid leave` : ""})`,
                        `Late ${n0(s.late)} (${s.lateDays} late → ${s.lateCutDays} day cut)`,
                        `Half day ${n0(s.half)} (${s.halfDays} half day${s.halfDays === 1 ? "" : "s"})`,
                        `One day = ${n0(s.rate)} (gross ÷ ${built.input.dayRule.divisor})`,
                      ].join("\n")
                      return (
                        <tr key={s.key} className="group hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <TD className={stickyCls}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                              {meta.tracked ? (
                                <span title="Attendance, lates, half days and OT come from loaded attendance data" className="rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                                  {meta.dataSources.includes("app") && !meta.dataSources.includes("machine") ? "app" : "machine"}
                                </span>
                              ) : meta.onMachine ? (
                                <span title="Ticked as machine staff, but no attendance data is loaded for this month" className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                  no data
                                </span>
                              ) : meta.dataNotTicked ? (
                                <span title="Has attendance data this month, but isn't ticked “On machine” in Employees, so it isn't used" className="rounded bg-slate-200 px-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                  not ticked
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {s.designation}
                              {edited && !locked && (
                                <button
                                  onClick={() => resetRow(s.key)}
                                  className="cursor-pointer font-medium text-violet-600 hover:underline dark:text-violet-400"
                                >
                                  reset days
                                </button>
                              )}
                            </div>
                          </TD>
                          {showDays && (
                            <TD>
                              <div className="flex gap-0.5">
                                {s.grid.map((v, d) => (
                                  <DayCell
                                    key={d}
                                    value={v}
                                    source={meta.sources[d]}
                                    off={meta.isField ? (settings.holidays || []).includes(dayLabels[d].iso) : dayLabels[d].off}
                                    label={dayLabels[d].label}
                                    disabled={locked}
                                    onToggle={(half) => toggleDay(s.key, d + 1, v, meta.natural[d], half)}
                                  />
                                ))}
                              </div>
                            </TD>
                          )}
                          <TD right>{n0(s.gross)}</TD>
                          <TD right className="font-semibold">{s.present}</TD>
                          <TD right className={s.absentDays ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                            {s.absentDays || "–"}
                            {s.leaveDays > 0 && (
                              <span className="ml-1 text-[10px] font-normal text-sky-600 dark:text-sky-400" title="Approved paid leave (Leave tab)">−{s.leaveDays} leave</span>
                            )}
                          </TD>
                          <TD right className={s.lateDays ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}>{s.lateDays || "–"}</TD>
                          <TD right className={s.halfDays ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}>{s.halfDays || "–"}</TD>
                          <TD right className="text-slate-500">{meta.workedOt ? meta.workedOt.toFixed(1) : "–"}</TD>
                          <TD right>
                            <NumIn label={`Approved overtime hours for ${s.name}`} value={meta.approvedOt} step="0.5" width="w-16" disabled={locked} onChange={(v) => setAdj("ot", s.key, v)} />
                            {meta.otCapped && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400" title="Approval is capped at the hours actually worked">capped at {meta.workedOt.toFixed(1)}</div>
                            )}
                          </TD>
                          <TD right className={s.otPay ? "" : "text-slate-400"}>{s.otPay ? n0(s.otPay) : "–"}</TD>
                          <TD right className={s.attendanceDed ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                            <span title={dedTitle} className="cursor-help underline decoration-dotted underline-offset-2">
                              {s.attendanceDed ? n0(s.attendanceDed) : "–"}
                            </span>
                          </TD>
                          <TD right>
                            <NumIn label={`Bonus for ${s.name}`} value={s.bonus} disabled={locked} onChange={(v) => setAdj("bonus", s.key, v)} />
                            {s.encash > 0 && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400" title={`Field staff: ${s.encashDays} unused monthly leave day(s) paid out at one day's pay`}>
                                + leave {n0(s.encash)}
                              </div>
                            )}
                          </TD>
                          <TD right><NumIn label={`Penalty for ${s.name}`} value={s.penalty} disabled={locked} width="w-16" onChange={(v) => setAdj("penalty", s.key, v)} /></TD>
                          <TD right>
                            <AutoNum
                              label={`Advance for ${s.name}`}
                              value={s.advance}
                              src={meta.src.advance}
                              autoTag="ledger"
                              disabled={locked}
                              onChange={(v) => setAdj("advance", s.key, v)}
                              onRevert={() => clearAdj("advance", s.key)}
                            />
                          </TD>
                          <TD right><NumIn label={`AIT for ${s.name}`} value={s.ait} disabled={locked} width="w-16" onChange={(v) => setAdj("ait", s.key, v)} /></TD>
                          <TD right className="font-bold text-slate-900 dark:text-white">{n0(s.net)}</TD>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
                    <tr>
                      <TD className="sticky left-0 bg-slate-50 dark:bg-slate-800">Total</TD>
                      {showDays && <TD />}
                      <TD right>{n0(t.staffGross)}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.present, 0)}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.absentDays, 0) || "–"}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.lateDays, 0) || "–"}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.halfDays, 0) || "–"}</TD>
                      <TD right>{(built.staffMeta.reduce((a, m) => a + m.workedOt, 0) || 0).toFixed(1)}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.otHours, 0) || "–"}</TD>
                      <TD right>{n0(t.otPay)}</TD>
                      <TD right>{n0(t.lwp + t.late + t.half)}</TD>
                      <TD right>{n0(t.bonus + t.encash)}</TD>
                      <TD right>{n0(t.penalty)}</TD>
                      <TD right>{n0(calc.staff.reduce((a, s) => a + s.advance, 0))}</TD>
                      <TD right>{n0(calc.staff.reduce((a, s) => a + s.ait, 0))}</TD>
                      <TD right className="text-emerald-700 dark:text-emerald-400">{n0(t.staffNet)}</TD>
                    </tr>
                  </tfoot>
                </table>
              )}

              {view === "directors" && (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <tr>
                      <TH>Director</TH>
                      <TH right>Remuneration</TH>
                      <TH right>Basic</TH>
                      <TH right>House rent</TH>
                      <TH right>Medical</TH>
                      <TH right>Conveyance</TH>
                      <TH right>AIT</TH>
                      <TH right>Advance</TH>
                      <TH right>Net</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {calc.directors.map((d) => (
                      <tr key={d.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <TD>
                          <div className="font-medium text-slate-900 dark:text-slate-100">{d.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{d.designation}</div>
                        </TD>
                        <TD right className="font-semibold">{n0(d.remuneration)}</TD>
                        <TD right>{n0(d.basic)}</TD>
                        <TD right>{n0(d.house)}</TD>
                        <TD right>{n0(d.medical)}</TD>
                        <TD right>{n0(d.conveyance)}</TD>
                        <TD right><NumIn label={`AIT for ${d.name}`} value={d.ait} disabled={locked} onChange={(v) => setAdj("ait", d.key, v)} /></TD>
                        <TD right>
                          <AutoNum
                            label={`Advance for ${d.name}`}
                            value={d.advance}
                            src={built.dirMeta.find((x) => x.key === d.key)?.src.advance}
                            autoTag="ledger"
                            disabled={locked}
                            onChange={(v) => setAdj("advance", d.key, v)}
                            onRevert={() => clearAdj("advance", d.key)}
                          />
                        </TD>
                        <TD right className="font-bold text-slate-900 dark:text-white">{n0(d.net)}</TD>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
                    <tr>
                      <TD>Total</TD>
                      <TD right>{n0(t.dirGross)}</TD>
                      <TD /><TD /><TD /><TD />
                      <TD right>{n0(calc.directors.reduce((a, d) => a + d.ait, 0))}</TD>
                      <TD right>{n0(calc.directors.reduce((a, d) => a + d.advance, 0))}</TD>
                      <TD right className="text-emerald-700 dark:text-emerald-400">{n0(t.dirNet)}</TD>
                    </tr>
                  </tfoot>
                </table>
              )}

              {view === "overtime" && (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <tr>
                      <TH>Employee</TH>
                      <TH right>Salary</TH>
                      <TH right>Hourly rate</TH>
                      <TH right>Worked (hrs)</TH>
                      <TH right>Approved (hrs)</TH>
                      <TH right>Overtime</TH>
                      <TH right>Adjustment (+/−)</TH>
                      <TH right>OT pay</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {calc.staff.map((s, i) => {
                      const meta = built.staffMeta[i]
                      const active = s.otHours || s.otAdjust || meta.workedOt
                      return (
                        <tr key={s.key} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${active ? "" : "text-slate-400 dark:text-slate-500"}`}>
                          <TD>
                            <div className={`font-medium ${active ? "text-slate-900 dark:text-slate-100" : ""}`}>{s.name}</div>
                            <div className="text-xs">{s.designation}</div>
                          </TD>
                          <TD right>{n0(s.salary)}</TD>
                          <TD right>{s.otRate.toFixed(2)}</TD>
                          <TD right>
                            {meta.workedOt ? meta.workedOt.toFixed(1) : "–"}
                            {!locked && meta.workedOt > meta.approvedOt && (
                              <button onClick={() => setAdj("ot", s.key, Math.round(meta.workedOt * 10) / 10)} className="ml-2 cursor-pointer text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                                approve
                              </button>
                            )}
                          </TD>
                          <TD right>
                            <NumIn label={`Approved overtime hours for ${s.name}`} value={meta.approvedOt} step="0.5" width="w-16" disabled={locked} onChange={(v) => setAdj("ot", s.key, v)} />
                            {meta.otCapped && <div className="text-[10px] text-amber-600 dark:text-amber-400">capped at {meta.workedOt.toFixed(1)}</div>}
                          </TD>
                          <TD right>{s.ot ? n0(s.ot) : "–"}</TD>
                          <TD right><NumIn label={`Overtime adjustment for ${s.name}`} value={s.otAdjust} disabled={locked} onChange={(v) => setAdj("otAdjust", s.key, v)} /></TD>
                          <TD right className={s.otPay ? "font-bold text-slate-900 dark:text-white" : ""}>{s.otPay ? n0(s.otPay) : "–"}</TD>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
                    <tr>
                      <TD>Total</TD>
                      <TD /><TD />
                      <TD right>{(built.staffMeta.reduce((a, m) => a + m.workedOt, 0) || 0).toFixed(1)}</TD>
                      <TD right>{calc.staff.reduce((a, s) => a + s.otHours, 0) || "–"}</TD>
                      <TD right>{n0(t.ot)}</TD>
                      <TD right>{n0(t.otAdjust)}</TD>
                      <TD right className="text-emerald-700 dark:text-emerald-400">{n0(t.otPay)}</TD>
                    </tr>
                  </tfoot>
                </table>
              )}

              {view === "advances" && (
                <AdvancesLedger
                  month={month}
                  advances={advances}
                  setAdvances={setAdvances}
                  people={[...calc.staff, ...calc.directors].map((p) => ({ key: p.key, name: p.name }))}
                  currency={currency}
                />
              )}

              {view === "off" && (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    <tr>
                      <TH>Employee</TH>
                      <TH right>Salary</TH>
                      <TH right>Add to sheet</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {built.notOnSheet.map((e) => (
                      <tr key={e.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <TD>
                          <div className="font-medium text-slate-900 dark:text-slate-100">{e.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">#{e.key} · {e.designation}</div>
                        </TD>
                        <TD right>{e.salary ? n0(e.salary) : "–"}</TD>
                        <TD right>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => addToSheet(e.key, "staff")} className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:hover:text-emerald-400">
                              + Staff
                            </button>
                            <button onClick={() => addToSheet(e.key, "director")} className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:hover:text-emerald-400">
                              + Director
                            </button>
                          </div>
                        </TD>
                      </tr>
                    ))}
                    {!built.notOnSheet.length && (
                      <tr><TD className="py-6 text-center text-slate-400">Every active employee is on the sheet.</TD></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span><b className="text-emerald-700 dark:text-emerald-400">P</b> present · <b className="text-rose-600">A</b> absent (LWP) · <b className="text-amber-600">½</b> half day</span>
            <span>Click a day to switch P/A · Shift-click for ½</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> edited by hand</span>
            <span className="inline-flex items-center gap-1"><span className="h-0.5 w-2.5 rounded bg-slate-400" /> from attendance data</span>
            <span>Same rules as Payroll: one day = gross ÷ {built.input.dayRule.divisor} · absent (after paid leave), late &amp; half-day deducted · OT = approved hours only</span>
            <span><b>Auto-filled:</b> attendance, lates, half days &amp; worked OT from the machine · advances from the ledger · paid leave from the Leave tab · bonus, penalty &amp; OT approvals shared with Payroll</span>
            {onOpenEmployees && (
              <button onClick={onOpenEmployees} className="cursor-pointer font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                Edit pay group / machine staff in Employees
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Advances ledger: record an advance once, when it's given. Its instalments
// then fill the Advance column automatically, month by month.
function AdvancesLedger({ month, advances, setAdvances, people, currency }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    key: people[0]?.key || "",
    amount: "",
    months: 1,
    startMonth: month,
    date: today,
    note: "",
  })
  const [err, setErr] = useState("")
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const nameOf = (key) => people.find((p) => String(p.key) === String(key))?.name || `#${key}`
  const field =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 dark:border-slate-700 dark:bg-slate-950"

  const add = () => {
    const amount = Number(form.amount)
    if (!form.key) return setErr("Choose who took the advance.")
    if (!(amount > 0)) return setErr("Enter the amount given.")
    if (!/^\d{4}-\d{2}$/.test(form.startMonth)) return setErr("Choose the first month to recover from.")
    setErr("")
    const id = globalThis.crypto?.randomUUID?.() || `adv_${Date.now()}`
    setAdvances((prev) => [
      ...(prev || []),
      {
        id,
        key: String(form.key),
        date: form.date,
        amount,
        months: Math.max(1, Math.round(Number(form.months) || 1)),
        startMonth: form.startMonth,
        note: form.note.trim(),
        createdAt: new Date().toISOString(),
      },
    ])
    setForm((f) => ({ ...f, amount: "", note: "" }))
  }
  const remove = (a) => {
    if (confirm(`Delete the ${formatMoney(a.amount, currency)} advance for ${nameOf(a.key)}? Its remaining instalments will stop.`))
      setAdvances((prev) => (prev || []).filter((x) => x.id !== a.id))
  }

  const rows = [...advances].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const thisMonth = rows.reduce((s, a) => s + (advanceSchedule(a).find((x) => x.month === month)?.amount || 0), 0)
  const outstanding = rows.reduce((s, a) => s + advanceProgress(a, month).remaining, 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-4 sm:grid-cols-7 dark:border-slate-800">
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Employee</span>
          <select value={form.key} onChange={(e) => set("key", e.target.value)} className={field}>
            {people.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Amount given</span>
          <input type="number" inputMode="decimal" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} className={`${field} text-right tabular-nums`} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date given</span>
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Recover over</span>
          <select value={form.months} onChange={(e) => set("months", Number(e.target.value))} className={field}>
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((m) => (
              <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Starting</span>
          <input type="month" value={form.startMonth} onChange={(e) => set("startMonth", e.target.value)} className={field} />
        </label>
        <div className="flex items-end">
          <button onClick={add} className="w-full cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            Record advance
          </button>
        </div>
        <label className="col-span-2 block sm:col-span-7">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Note (optional)</span>
          <input value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. medical emergency, salary taken early" className={field} />
        </label>
        {err && <p role="alert" className="col-span-full text-sm text-rose-600">{err}</p>}
        {Number(form.amount) > 0 && !err && (
          <p className="col-span-full text-xs text-slate-500 dark:text-slate-400">
            Deducts {advanceSchedule({ amount: Number(form.amount), months: form.months, startMonth: form.startMonth })
              .map((x) => `${formatMoney(x.amount, currency)} in ${niceMonth(x.month)}`)
              .join(", ")}
            .
          </p>
        )}
      </div>

      {rows.length ? (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
            <tr>
              <TH>Employee</TH>
              <TH>Given</TH>
              <TH right>Amount</TH>
              <TH>Recovery</TH>
              <TH right>{niceMonth(month)}</TH>
              <TH right>Recovered</TH>
              <TH right>Remaining</TH>
              <TH>Note</TH>
              <TH />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((a) => {
              const p = advanceProgress(a, month)
              const due = advanceSchedule(a).find((x) => x.month === month)?.amount || 0
              const done = p.remaining === 0
              return (
                <tr key={a.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${done ? "text-slate-400 dark:text-slate-500" : ""}`}>
                  <TD className={done ? "" : "font-medium text-slate-900 dark:text-slate-100"}>{nameOf(a.key)}</TD>
                  <TD>{a.date ? new Date(`${a.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–"}</TD>
                  <TD right className="font-semibold">{n0(a.amount)}</TD>
                  <TD>
                    {a.months} × {n0(advanceSchedule(a)[0]?.amount)}
                    <span className="ml-1 text-xs text-slate-400">({niceMonth(a.startMonth)} → {niceMonth(p.lastMonth)})</span>
                  </TD>
                  <TD right className={due ? "font-bold text-slate-900 dark:text-white" : "text-slate-400"}>{due ? n0(due) : "–"}</TD>
                  <TD right>{n0(p.recovered)}</TD>
                  <TD right className={done ? "" : "font-semibold text-amber-600 dark:text-amber-400"}>{done ? "Cleared" : n0(p.remaining)}</TD>
                  <TD className="max-w-[16rem] truncate text-xs" ><span title={a.note}>{a.note || "–"}</span></TD>
                  <TD right>
                    <button onClick={() => remove(a)} aria-label={`Delete advance for ${nameOf(a.key)}`} className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                      <Icon.trash className="h-4 w-4" />
                    </button>
                  </TD>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/60">
            <tr>
              <TD>Total</TD>
              <TD /><TD /><TD />
              <TD right className="text-emerald-700 dark:text-emerald-400">{n0(thisMonth)}</TD>
              <TD />
              <TD right className="text-amber-600 dark:text-amber-400">{n0(outstanding)}</TD>
              <TD /><TD />
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No advances recorded yet. Record one above when it’s given, and its instalments will be deducted automatically each month.
        </p>
      )}
    </div>
  )
}
