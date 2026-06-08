"use client"

import { useState } from "react"
import { Icon } from "./ui"
import { formatDateLong } from "@/lib/format"

export default function PastePanel({ input, setInput, stats, onSample, onClear }) {
  const hasData = stats.rows > 0
  const [open, setOpen] = useState(!hasData)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Icon.upload className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Machine data
            </p>
            <p className="text-xs text-slate-400">
              {hasData
                ? `${stats.rows} punches · ${stats.employees} employees · ${formatDateLong(stats.from)} – ${formatDateLong(stats.to)}`
                : "Paste the raw export from your ZKTeco device"}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {open ? "Hide" : hasData ? "Edit data" : "Paste"}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"Paste rows like:\n2   2026-06-01   09:02:11\n2   2026-06-01   19:34:02"}
            spellCheck={false}
            className="h-44 w-full resize-y rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-700 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:ring-emerald-900/30"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={onSample}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Load sample
            </button>
            {hasData && (
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <Icon.trash className="w-4 h-4" /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-slate-400">
              One row per punch · ID · date · time
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
