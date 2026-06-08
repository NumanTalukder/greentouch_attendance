"use client"

import { useState } from "react"
import Modal from "./Modal"
import { DEFAULT_SETTINGS } from "@/lib/constants"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const inp =
  "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"

export default function SettingsModal({ settings, setSettings, onClose }) {
  const [draft, setDraft] = useState(settings)
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

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
          <input type="time" value={draft.officeStart} onChange={(e) => set("officeStart", e.target.value)} className={inp} />
        </Field>
        <Field label="Office end">
          <input type="time" value={draft.officeEnd} onChange={(e) => set("officeEnd", e.target.value)} className={inp} />
        </Field>
        <Field label="Grace (minutes)" hint="On-time window after start">
          <input type="number" value={draft.graceMinutes} onChange={(e) => set("graceMinutes", e.target.value)} className={`${inp} w-full`} />
        </Field>
        <Field label="Half-day after" hint="Arrive later → half day">
          <input type="time" value={draft.halfDayStart} onChange={(e) => set("halfDayStart", e.target.value)} className={inp} />
        </Field>
        <Field label="Overtime starts" hint="OT accrues after this">
          <input type="time" value={draft.otStart} onChange={(e) => set("otStart", e.target.value)} className={inp} />
        </Field>
        <Field label="“Stayed late” after" hint="Flag long days">
          <input type="time" value={draft.otThreshold} onChange={(e) => set("otThreshold", e.target.value)} className={inp} />
        </Field>
        <Field label="Day boundary" hint="Punches before roll to prev. day">
          <input type="time" value={draft.dayBoundary} onChange={(e) => set("dayBoundary", e.target.value)} className={inp} />
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

const Field = ({ label, hint, children, full }) => (
  <label className={`block ${full ? "col-span-full" : ""}`}>
    <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
    {children}
    {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
  </label>
)
