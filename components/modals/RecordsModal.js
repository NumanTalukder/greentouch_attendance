"use client"

import { useEffect, useState, useCallback } from "react"
import Modal from "./Modal"
import { Badge, Icon } from "../ui"
import { formatMoney, formatDateLong } from "@/lib/format"

// Saved monthly payroll snapshots ("previous month records") stored in MongoDB.
export default function RecordsModal({ monthKey, period, payroll, currency, onClose }) {
  const [list, setList] = useState([])
  const [state, setState] = useState("loading") // loading | ready | offline
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState("")
  const [detail, setDetail] = useState(null) // { month, ...snapshot } | { month, loading:true }

  const openMonth = async (month) => {
    setDetail({ month, loading: true })
    try {
      const r = await fetch(`/api/records?month=${encodeURIComponent(month)}`)
      const j = await r.json()
      if (j?.ok && j.data) setDetail({ ...j.data, month })
      else setDetail({ month, error: true })
    } catch {
      setDetail({ month, error: true })
    }
  }

  const load = useCallback(async () => {
    setState("loading")
    try {
      const r = await fetch("/api/records")
      const j = await r.json()
      if (j?.ok) {
        setList(j.data || [])
        setState("ready")
      } else setState("offline")
    } catch {
      setState("offline")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveCurrent = async () => {
    if (!monthKey) return
    setSaving(true)
    setSavedNote("")
    try {
      // Trim each row to the essentials worth archiving.
      const rows = payroll.rows.map((r) => ({
        id: r.id,
        name: r.name,
        department: r.department,
        salary: r.salary,
        presentDays: r.presentDays,
        absentDays: r.absentDays,
        lateDays: r.lateDays,
        halfDays: r.halfDays,
        otPay: Math.round(r.otPay),
        totalDeductions: Math.round(r.totalDeductions),
        bonus: Math.round(r.bonus),
        penalty: Math.round(r.penalty),
        netPayable: Math.round(r.netPayable),
      }))
      const r = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthKey,
          period,
          employees: rows.length,
          totals: {
            salary: Math.round(payroll.totals.salary),
            otPay: Math.round(payroll.totals.otPay),
            totalDeductions: Math.round(payroll.totals.totalDeductions),
            bonus: Math.round(payroll.totals.bonus),
            penalty: Math.round(payroll.totals.penalty),
            netPayable: Math.round(payroll.totals.netPayable),
          },
          rows,
        }),
      })
      const j = await r.json()
      if (j?.ok) {
        setSavedNote(`Saved ${monthKey} to cloud.`)
        load()
      } else if (j?.locked) {
        setSavedNote(j.error || `${monthKey} is locked.`)
      } else setSavedNote("Could not save — cloud unavailable.")
    } catch {
      setSavedNote("Could not save — cloud unavailable.")
    }
    setSaving(false)
  }

  // Freeze / unfreeze a finalised month (after the salary sheet is generated).
  const toggleLock = async (month, locked) => {
    try {
      const r = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, action: locked ? "lock" : "unlock" }),
      })
      const j = await r.json()
      if (j?.ok) {
        await load()
        setDetail((d) => (d && d.month === month ? { ...d, locked } : d))
      }
    } catch {}
  }

  const currentLocked = list.find((m) => m.month === monthKey)?.locked

  return (
    <Modal
      title="Monthly records"
      subtitle="Archived payroll snapshots, stored online"
      width="max-w-2xl"
      onClose={onClose}
    >
      {detail ? (
        <MonthDetail
          detail={detail}
          currency={currency}
          onBack={() => setDetail(null)}
          onToggleLock={toggleLock}
        />
      ) : (
      <>
      {/* Save current month */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {monthKey ? `Current month: ${monthKey}` : "No month loaded"}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400/80">
            {payroll?.rows?.length || 0} employees ·{" "}
            {formatMoney(payroll?.totals?.netPayable || 0, currency)} net payable
          </p>
        </div>
        {currentLocked ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            <Icon.lock className="w-4 h-4" /> Locked
          </span>
        ) : (
          <button
            disabled={!monthKey || saving}
            onClick={saveCurrent}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            <Icon.cloud className="w-4 h-4" />
            {saving ? "Saving…" : "Save this month"}
          </button>
        )}
      </div>
      {savedNote && (
        <p className="mb-3 text-sm text-slate-500">{savedNote}</p>
      )}

      {/* History */}
      {state === "loading" && (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      )}
      {state === "offline" && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <Icon.cloudOff className="w-5 h-5" />
          Cloud storage isn&apos;t reachable. Check the MongoDB connection (see README).
        </div>
      )}
      {state === "ready" && list.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          No months saved yet. Save the current month above to start your archive.
        </p>
      )}
      {state === "ready" && list.length > 0 && (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">Employees</th>
                <th className="px-3 py-2 text-right">Net payable</th>
                <th className="px-3 py-2 text-right">Saved</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr
                  key={m.month}
                  onClick={() => openMonth(m.month)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 font-medium">
                    <span className="text-emerald-600 hover:underline dark:text-emerald-400">
                      {m.month}
                    </span>
                    {m.month === monthKey && (
                      <Badge tone="green" className="ml-2">current</Badge>
                    )}
                    {m.locked && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-amber-600 dark:text-amber-400">
                        <Icon.lock className="h-3 w-3" /> locked
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {m.employees ?? m.totals?.count ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatMoney(m.totals?.netPayable || 0, currency)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {m.savedAt ? formatDateLong(String(m.savedAt).slice(0, 10)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </Modal>
  )
}

// Read-only per-employee breakdown of one archived month.
function MonthDetail({ detail, currency, onBack, onToggleLock }) {
  const rows = detail.rows || []
  const t = detail.totals || {}
  const num = (n) => (n || 0).toLocaleString()
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        ← All months
      </button>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          {detail.month}
          {detail.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Icon.lock className="h-3 w-3" /> Locked
            </span>
          )}
        </h3>
        <span className="text-sm text-slate-400">
          {detail.employees ?? rows.length} employees ·{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {formatMoney(t.netPayable || 0, currency)}
          </span>{" "}
          net
        </span>
      </div>

      {!detail.loading && !detail.error && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
          <span className="text-xs text-slate-500">
            {detail.locked
              ? "This month is finalised. Unlock it to re-save from a new paste."
              : "Lock the month once you have generated the salary sheet — a re-paste can no longer overwrite it."}
          </span>
          {detail.locked ? (
            <button
              onClick={() => onToggleLock(detail.month, false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300"
            >
              <Icon.unlock className="h-4 w-4" /> Unlock
            </button>
          ) : (
            <button
              onClick={() => onToggleLock(detail.month, true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Icon.lock className="h-4 w-4" /> Lock month
            </button>
          )}
        </div>
      )}

      {detail.loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      ) : detail.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <Icon.cloudOff className="w-5 h-5" /> Could not load this month.
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          This snapshot has no per-employee rows.
        </p>
      ) : (
        <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Employee</th>
                <th className="px-2 py-2 text-right">Pres</th>
                <th className="px-2 py-2 text-right">Abs</th>
                <th className="px-2 py-2 text-right">Late</th>
                <th className="px-2 py-2 text-right">OT pay</th>
                <th className="px-2 py-2 text-right">Deduct</th>
                <th className="px-3 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{r.name || `#${r.id}`}</span>
                    <span className="ml-1 text-xs text-slate-400">#{r.id}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.presentDays ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{r.absentDays ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.lateDays ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{num(r.otPay)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{num(r.totalDeductions)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{num(r.netPayable)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 py-2">Total</td>
                <td colSpan={3} />
                <td className="px-2 py-2 text-right tabular-nums">{num(t.otPay)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{num(t.totalDeductions)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(t.netPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
