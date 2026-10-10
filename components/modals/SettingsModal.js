"use client"

import { useState } from "react"
import Modal from "./Modal"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { formatTime12 } from "@/lib/format"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const inp =
  "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"

export default function SettingsModal({ settings, setSettings, onClose }) {
  const [draft, setDraft] = useState(settings)
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const company = { ...DEFAULT_SETTINGS.company, ...(draft.company || {}) }
  const split = { ...DEFAULT_SETTINGS.salarySplit, ...(draft.salarySplit || {}) }
  const setCompany = (k, v) => set("company", { ...company, [k]: v })
  const setSplit = (k, pct) =>
    set("salarySplit", { ...split, [k]: (Number(pct) || 0) / 100 })
  const splitTotal = Math.round(
    (split.basic + split.house + split.medical + split.conveyance) * 1000,
  ) / 10

  const toggleWeekend = (day) =>
    setDraft((d) => ({
      ...d,
      weekendDays: d.weekendDays.includes(day)
        ? d.weekendDays.filter((x) => x !== day)
        : [...d.weekendDays, day].sort(),
    }))

  const save = () => {
    setSettings({
      ...draft,
      graceMinutes: Number(draft.graceMinutes) || 0,
      otHourlyRate: Number(draft.otHourlyRate) || 0,
      standardHoursPerDay: Number(draft.standardHoursPerDay) || 8,
      lateGroupSize: Number(draft.lateGroupSize) || 0,
      halfDayPayFactor: Number(draft.halfDayPayFactor) || 0,
      earnedLeavePerYear: Number(draft.earnedLeavePerYear) || 0,
      sickLeavePerYear: Number(draft.sickLeavePerYear) || 0,
      leaveYearStartMonth: Number(draft.leaveYearStartMonth) || 7,
      holidays:
        typeof draft.holidays === "string"
          ? draft.holidays
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
          : draft.holidays,
    })
    onClose()
  }

  const holidaysText = Array.isArray(draft.holidays)
    ? draft.holidays.join("\n")
    : draft.holidays

  return (
    <Modal
      title="Settings"
      subtitle="Define the rules — everything else is calculated from these"
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDraft(DEFAULT_SETTINGS)}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Save changes
            </button>
          </div>
        </div>
      }
    >
      <Section title="Work schedule">
        <Field label="Office start">
          <Time12 value={draft.officeStart} onChange={(v) => set("officeStart", v)} />
        </Field>
        <Field label="Office end">
          <Time12 value={draft.officeEnd} onChange={(v) => set("officeEnd", v)} />
        </Field>
        <Field label="Grace (minutes)" hint="On-time window after start">
          <input type="number" value={draft.graceMinutes} onChange={(e) => set("graceMinutes", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Half-day after" hint="Arrive later → half day">
          <Time12 value={draft.halfDayStart} onChange={(v) => set("halfDayStart", v)} />
        </Field>
        <Field label="Overtime starts" hint="OT accrues after this">
          <Time12 value={draft.otStart} onChange={(v) => set("otStart", v)} />
        </Field>
        <Field label="“Stayed late” after" hint="Flag long days">
          <Time12 value={draft.otThreshold} onChange={(v) => set("otThreshold", v)} />
        </Field>
        <Field label="Day boundary" hint="Punches before roll to prev. day">
          <Time12 value={draft.dayBoundary} onChange={(v) => set("dayBoundary", v)} />
        </Field>
      </Section>

      <Section title="Weekend / non-working days">
        <div className="col-span-full flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => toggleWeekend(i)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                draft.weekendDays.includes(i)
                  ? "bg-rose-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Payroll">
        <Field label="Currency symbol">
          <input value={draft.currency} onChange={(e) => set("currency", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Per-day pay basis" hint="Days per month for rates & deductions">
          <select value={draft.perDayBasis} onChange={(e) => set("perDayBasis", e.target.value)} className={`${inp} w-full`}>
            <option value="working">Working days in period</option>
            <option value="fixed26">Fixed 26 days</option>
            <option value="fixed30">Fixed 30 days</option>
            <option value="calendar">Calendar days in month (28–31)</option>
          </select>
        </Field>
        <Field label="Overtime method" hint="How the OT rate is set">
          <select value={draft.otMethod} onChange={(e) => set("otMethod", e.target.value)} className={`${inp} w-full`}>
            <option value="salary">From salary ÷ (days × hours)</option>
            <option value="flat">Flat rate / hour</option>
          </select>
        </Field>
        {draft.otMethod === "flat" ? (
          <Field label="Overtime rate / hour">
            <input type="number" value={draft.otHourlyRate} onChange={(e) => set("otHourlyRate", e.target.value)} className={`${inp} w-full`} />
          </Field>
        ) : (
          <Field label="Work hours / day" hint="Divisor for hourly wage (e.g. 8)">
            <input type="number" value={draft.standardHoursPerDay} onChange={(e) => set("standardHoursPerDay", e.target.value)} className={`${inp} w-full`} />
          </Field>
        )}
        <Field
          label="Lates per 1-day cut"
          hint={`Every ${draft.lateGroupSize || 0} lates = 1 day; first ${Math.max(0, (Number(draft.lateGroupSize) || 1) - 1)} graced`}
        >
          <input type="number" min={0} value={draft.lateGroupSize} onChange={(e) => set("lateGroupSize", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Half-day pays (%)" hint="Rest is deducted">
          <input
            type="number"
            value={Math.round(draft.halfDayPayFactor * 100)}
            onChange={(e) => set("halfDayPayFactor", (Number(e.target.value) || 0) / 100)}
            className={`${inp} w-full`}
          />
        </Field>
        <Field label="Require OT approval" hint="Pay only signed-off OT hours">
          <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={draft.otApprovalRequired} onChange={(e) => set("otApprovalRequired", e.target.checked)} className="accent-emerald-500" />
            Approved hours only
          </label>
        </Field>
        <Field label="Deduct absent days">
          <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={draft.deductAbsent} onChange={(e) => set("deductAbsent", e.target.checked)} className="accent-emerald-500" />
            Subtract one day of pay per absent day
          </label>
        </Field>
        <Field label="Leaving early" hint={`Office staff leaving before ${formatTime12(draft.officeEnd)}; excusable per day with a note`}>
          <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={draft.earlyLeaveHalfDay !== false} onChange={(e) => set("earlyLeaveHalfDay", e.target.checked)} className="accent-emerald-500" />
            Counts as a half day
          </label>
        </Field>
        <Field label="Holiday work" hint="Friday / weekend / declared holiday; lates still count">
          <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={draft.holidayWorkPay !== false} onChange={(e) => set("holidayWorkPay", e.target.checked)} className="accent-emerald-500" />
            Pays one extra full day
          </label>
        </Field>
      </Section>

      <Section title="Paid leave (per leave year)">
        <Field label="Earned leave / year" hint="Days of paid earned leave">
          <input type="number" min={0} value={draft.earnedLeavePerYear} onChange={(e) => set("earnedLeavePerYear", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Sick leave / year" hint="Days of paid sick leave">
          <input type="number" min={0} value={draft.sickLeavePerYear} onChange={(e) => set("sickLeavePerYear", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Leave year starts" hint="Balances reset this month">
          <select value={draft.leaveYearStartMonth} onChange={(e) => set("leaveYearStartMonth", e.target.value)} className={`${inp} w-full`}>
            {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Salary sheet (accounts workbook)">
        <Field label="Company name">
          <input value={company.name} onChange={(e) => setCompany("name", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Address line 1">
          <input value={company.address1} onChange={(e) => setCompany("address1", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Address line 2">
          <input value={company.address2} onChange={(e) => setCompany("address2", e.target.value)} className={`${inp} w-full`} />
        </Field>
        {[
          ["basic", "Basic %"],
          ["house", "House rent %"],
          ["medical", "Medical %"],
          ["conveyance", "Conveyance %"],
        ].map(([k, label]) => (
          <Field key={k} label={label} hint={k === "conveyance" ? `Split of gross — total ${splitTotal}%${splitTotal === 100 ? "" : " (should be 100%)"}` : undefined}>
            <input type="number" min={0} max={100} step="0.5" value={Math.round(split[k] * 1000) / 10} onChange={(e) => setSplit(k, e.target.value)} className={`${inp} w-full`} />
          </Field>
        ))}
      </Section>

      <Section title="Holidays" cols={1}>
        <Field label="Dates (YYYY-MM-DD, one per line)" hint="Excluded from working days" full>
          <textarea
            value={holidaysText}
            onChange={(e) => set("holidays", e.target.value)}
            placeholder={"2026-06-16\n2026-06-17"}
            className={`${inp} h-20 w-full resize-y font-mono`}
          />
        </Field>
      </Section>
    </Modal>
  )
}

const Section = ({ title, children, cols = 3 }) => (
  <div className="mb-5">
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
      {title}
    </h3>
    <div
      className={`grid grid-cols-2 gap-3 ${
        cols === 1 ? "sm:grid-cols-1" : "sm:grid-cols-3"
      }`}
    >
      {children}
    </div>
  </div>
)

// 12-hour time picker. Stores "HH:MM" (24h) like the rest of the app, but always
// shows hour : minute AM/PM — the browser's own time box follows the computer's
// clock setting and can show 24h.
const pad = (n) => String(n).padStart(2, "0")
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
function Time12({ value = "00:00", onChange }) {
  const [h24 = 0, m = 0] = String(value).split(":").map(Number)
  const pm = h24 >= 12
  const h12 = h24 % 12 || 12
  const emit = (h, min, isPm) => onChange(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(min)}`)
  const sel = `${inp} cursor-pointer appearance-none text-center tabular-nums`
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b)
  return (
    <span className="inline-flex items-center gap-1">
      <select aria-label="Hour" value={h12} onChange={(e) => emit(Number(e.target.value), m, pm)} className={`${sel} w-12`}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select aria-label="Minute" value={m} onChange={(e) => emit(h12, Number(e.target.value), pm)} className={`${sel} w-12`}>
        {minutes.map((x) => (
          <option key={x} value={x}>{pad(x)}</option>
        ))}
      </select>
      <select aria-label="AM or PM" value={pm ? "PM" : "AM"} onChange={(e) => emit(h12, m, e.target.value === "PM")} className={`${sel} w-14`}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </span>
  )
}

const Field = ({ label, hint, children, full }) => (
  <label className={`block ${full ? "col-span-full" : ""}`}>
    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
    {children}
    {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
  </label>
)
