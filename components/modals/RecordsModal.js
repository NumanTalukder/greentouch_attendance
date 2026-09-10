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
      } else setSavedNote("Could not save — cloud unavailable.")
    } catch {
      setSavedNote("Could not save — cloud unavailable.")
    }
    setSaving(false)
  }

  return (
    <Modal
      title="Monthly records"
      subtitle="Archived payroll snapshots, stored online"
      width="max-w-2xl"
      onClose={onClose}
    >
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
        <button
          disabled={!monthKey || saving}
          onClick={saveCurrent}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Icon.cloud className="w-4 h-4" />
          {saving ? "Saving…" : "Save this month"}
        </button>
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
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
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
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-3 py-2 font-medium">
                    {m.month}
                    {m.month === monthKey && (
                      <Badge tone="green" className="ml-2">current</Badge>
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
    </Modal>
  )
}
