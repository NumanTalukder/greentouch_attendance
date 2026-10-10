"use client"

import { useCallback, useEffect, useState } from "react"
import Modal from "./Modal"
import { Badge, Icon } from "../ui"

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dhaka",
      })
    : "—"

export default function ApprovalsModal({ onClose, onChange }) {
  const [list, setList] = useState([])
  const [state, setState] = useState("loading")
  const [acting, setActing] = useState("")

  const load = useCallback(async () => {
    setState("loading")
    try {
      const r = await fetch("/api/attendance/pending")
      const j = await r.json()
      if (j?.ok) {
        setList(j.data || [])
        setState("ready")
        onChange?.(j.count ?? (j.data || []).length)
      } else setState("offline")
    } catch {
      setState("offline")
    }
  }, [onChange])

  useEffect(() => {
    load()
  }, [load])

  const review = async (id, action) => {
    setActing(id)
    try {
      await fetch("/api/attendance/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
      await load()
    } catch {
      alert("Could not update")
    }
    setActing("")
  }

  return (
    <Modal
      title="Approvals"
      subtitle="Off-site / no-GPS check-ins waiting for your review. Approved ones count in payroll."
      width="max-w-2xl"
      onClose={onClose}
    >
      {state === "loading" && (
        <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
      )}
      {state === "offline" && (
        <p className="flex items-center gap-1.5 py-6 text-sm text-slate-500">
          <Icon.cloudOff className="w-4 h-4" /> Cloud unreachable
        </p>
      )}
      {state === "ready" && list.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Icon.check className="mb-2 h-8 w-8 text-emerald-400" />
          <p className="font-medium text-slate-700 dark:text-slate-200">All clear</p>
          <p className="text-sm text-slate-400">Nothing waiting for approval.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {list.map((s) => {
          const g = s.checkInGeo || {}
          const hasLoc = Number.isFinite(g.lat) && Number.isFinite(g.lng)
          const cg = s.checkOutGeo || {}
          const hasCoLoc = Number.isFinite(cg.lat) && Number.isFinite(cg.lng)
          return (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {s.employeeName}
                    </span>
                    {s.verification && (
                      <Badge tone={s.verification === "no-gps" ? "violet" : "amber"}>
                        {s.verification === "no-gps" ? "no GPS in" : "off-site in"}
                      </Badge>
                    )}
                    {s.checkOutFieldwork && (
                      <Badge tone={s.checkOutVerification === "no-gps" ? "violet" : "amber"}>
                        {s.checkOutVerification === "no-gps" ? "no GPS out" : "off-site out"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {s.projectName} · {fmt(s.checkInAt)}
                    {s.checkOutAt ? ` → ${fmt(s.checkOutAt)}` : ""}
                    {g.distance != null ? ` · in ${g.distance}m` : ""}
                    {s.checkOutFieldwork && cg.distance != null ? ` · out ${cg.distance}m` : ""}
                  </p>
                  {s.reason && (
                    <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      In: “{s.reason}”
                    </p>
                  )}
                  {s.checkOutReason && (
                    <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      Out: “{s.checkOutReason}”
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3">
                    {hasLoc && (
                      <a
                        href={`https://www.google.com/maps?q=${g.lat},${g.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Check-in location ↗
                      </a>
                    )}
                    {hasCoLoc && (
                      <a
                        href={`https://www.google.com/maps?q=${cg.lat},${cg.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        Check-out location ↗
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => review(s.id, "reject")}
                    disabled={acting === s.id}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => review(s.id, "approve")}
                    disabled={acting === s.id}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
