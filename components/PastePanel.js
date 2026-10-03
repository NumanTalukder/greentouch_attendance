"use client"

import { useState } from "react"
import { Icon } from "./ui"
import { formatDateLong } from "@/lib/format"
import { monthInfo } from "@/lib/salaryCalc"

const pad = (n) => String(n).padStart(2, "0")
const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
const nice = (m) => (m ? monthInfo(m).label.replace("-", " ") : "…")
const n0 = (v) => Number(v || 0).toLocaleString("en-US")
const people = (n) => `${n} ${n === 1 ? "person" : "people"}`

// Machine data lives in the cloud, one month at a time. Pasting a ZKTeco
// export only creates a *draft* in this browser; "Save to cloud" merges it
// into the right month(s) for everyone (duplicate punches are ignored).
export default function PastePanel({
  month,
  setMonth,
  months = [],
  stats,
  loading,
  input,
  setInput,
  draftStats,
  onSave,
  note,
  onDismissNote,
  onDeleteMonth,
}) {
  const hasDraft = draftStats.rows > 0
  const [open, setOpen] = useState(hasDraft)
  const meta = months.find((m) => m.month === month)
  const hasData = stats.rows > 0
  const draftMonths = hasDraft
    ? [...new Set([draftStats.from?.slice(0, 7), draftStats.to?.slice(0, 7)].filter(Boolean))]
    : []

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Icon.cloud className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Machine data</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {loading
                ? `Loading ${nice(month)} from the cloud…`
                : hasData
                  ? `${n0(stats.rows)} punches · ${people(stats.employees)} · ${formatDateLong(stats.from)} – ${formatDateLong(stats.to)}${meta?.updatedBy ? ` · saved by ${meta.updatedBy}` : ""}${meta?.updatedAt ? ` · ${formatDateLong(String(meta.updatedAt).slice(0, 10))}` : ""}`
                  : `No machine data saved for ${nice(month)} yet`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* app-wide month: every tab shows this month */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => month && setMonth(shiftMonth(month, -1))}
              aria-label="Previous month"
              className="cursor-pointer rounded-l-lg px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              ‹
            </button>
            <span className="min-w-[120px] px-2 text-center text-sm font-semibold tabular-nums">{nice(month)}</span>
            <button
              onClick={() => month && setMonth(shiftMonth(month, 1))}
              aria-label="Next month"
              className="cursor-pointer rounded-r-lg px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              hasDraft
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            }`}
          >
            <Icon.upload className="h-4 w-4" />
            {hasDraft ? "Unsaved import" : open ? "Hide import" : "Import export"}
          </button>
        </div>
      </div>

      {note && !note.busy && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-4 mb-3 flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
            note.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
              : note.tone === "warn"
                ? "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
          }`}
        >
          <span>{note.text}</span>
          <button onClick={onDismissNote} aria-label="Dismiss" className="cursor-pointer opacity-60 hover:opacity-100">
            <Icon.x className="h-4 w-4" />
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          {hasDraft && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              This browser has machine data that isn’t saved to the cloud yet. Other computers can’t see it until you
              press <b>Save to cloud</b>.
            </p>
          )}
          <label htmlFor="machine-import" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Paste the ZKTeco export (one row per punch: ID · date · time)
          </label>
          <textarea
            id="machine-import"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"12345   2026-09-01   09:02:11\n12345   2026-09-01   19:34:02"}
            spellCheck={false}
            className="h-36 w-full resize-y rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:ring-emerald-900/30"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={onSave}
              disabled={!hasDraft || note?.busy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon.cloud className="h-4 w-4" />
              {note?.busy ? "Saving…" : "Save to cloud"}
            </button>
            {hasDraft && (
              <>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Ready: <b>{n0(draftStats.rows)}</b> punches · {people(draftStats.employees)} ·{" "}
                  {draftMonths.map(nice).join(" & ")}
                </span>
                <button
                  onClick={() => setInput("")}
                  className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Discard draft
                </button>
              </>
            )}
            <span className="ml-auto text-xs text-slate-400">Duplicate punches are ignored, so re-importing is safe</span>
          </div>

          {months.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <span className="font-medium text-slate-500 dark:text-slate-400">Saved months:</span>
              {months.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setMonth(m.month)}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 transition ${
                    m.month === month
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {nice(m.month)} · {n0(m.count)}
                </button>
              ))}
              {meta && (
                <button
                  onClick={() => onDeleteMonth(month)}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <Icon.trash className="h-3.5 w-3.5" /> Delete {nice(month)} data
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
