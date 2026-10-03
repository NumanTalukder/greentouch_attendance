"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { parseInputData, inputStats } from "@/lib/parse"
import {
  buildDailyRecords,
  buildSummary,
  buildDashboard,
  getPeriod,
  findUnknownIds,
  applyCorrections,
} from "@/lib/engine"
import { buildPayroll } from "@/lib/payroll"
import { buildLeave } from "@/lib/leave"
import {
  useEmployees,
  useSettings,
  useInput,
  useAdjustments,
  useAdvances,
} from "@/lib/storage"
import { STORAGE_KEYS } from "@/lib/constants"

import { Icon } from "./ui"
import PastePanel from "./PastePanel"
import Dashboard from "./Dashboard"
import DailyTable from "./DailyTable"
import SummaryTable from "./SummaryTable"
import PayrollTable from "./PayrollTable"
import LeaveTable from "./LeaveTable"
import LiveBoard from "./LiveBoard"
import SalarySheet from "./SalarySheet"
import { attributePunches, advanceDue } from "@/lib/salaryInput"
import { monthInfo } from "@/lib/salaryCalc"
import EmployeesModal from "./modals/EmployeesModal"
import SettingsModal from "./modals/SettingsModal"
import RecordsModal from "./modals/RecordsModal"
import ProjectsModal from "./modals/ProjectsModal"
import UsersModal from "./modals/UsersModal"
import ApprovalsModal from "./modals/ApprovalsModal"

export default function AppShell() {
  const { input, setInput } = useInput()
  const { settings, setSettings, status: settingsStatus } = useSettings()
  const { employees, setEmployees, status: employeesStatus } = useEmployees()
  const { adjustments, updateMonth, status: adjStatus } = useAdjustments()
  const { advances, setAdvances } = useAdvances()

  // Combined cloud sync status across all synced stores.
  const syncStatus = useMemo(() => {
    const all = [employeesStatus, settingsStatus, adjStatus]
    if (all.includes("saving")) return "saving"
    if (all.includes("offline")) return "offline"
    if (all.includes("loading")) return "loading"
    return "synced"
  }, [employeesStatus, settingsStatus, adjStatus])

  const [tab, setTab] = useState("dashboard")
  const [modal, setModal] = useState(null) // "employees" | "settings" | ...
  const [dark, setDark] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [appPunches, setAppPunches] = useState([])

  // Approved app check-ins, as punches merged with the pasted machine data.
  const loadAppPunches = useCallback(() => {
    fetch("/api/attendance")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) setAppPunches(j.punches || [])
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    loadAppPunches()
  }, [loadAppPunches])

  // Poll the approvals count so the badge stays live.
  useEffect(() => {
    let alive = true
    const poll = () =>
      fetch("/api/attendance/pending")
        .then((r) => r.json())
        .then((j) => {
          if (alive && j?.ok) setPendingCount(j.count || 0)
        })
        .catch(() => {})
    poll()
    const t = setInterval(poll, 60000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    window.location.href = "/login"
  }

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next ? "dark" : "light")
    } catch {}
  }

  // ---- machine data: stored in the cloud, one document per month ----
  const [month, setMonthState] = useState("")
  const [machineMonths, setMachineMonths] = useState([])
  const [machineCache, setMachineCache] = useState({}) // month → punches (raw machine IDs)
  const [machineLoading, setMachineLoading] = useState(false)
  const setMonth = useCallback((m) => {
    setMonthState(m)
    try {
      localStorage.setItem(STORAGE_KEYS.viewMonth, m)
    } catch {}
  }, [])

  const loadMachineMonths = useCallback(async () => {
    try {
      const j = await (await fetch("/api/machine")).json()
      if (j?.ok) {
        setMachineMonths(j.months || [])
        return j.months || []
      }
    } catch {}
    return []
  }, [])

  // Start on: last month viewed → latest month with machine data → this month.
  useEffect(() => {
    ;(async () => {
      const months = await loadMachineMonths()
      let saved = ""
      try {
        saved = localStorage.getItem(STORAGE_KEYS.viewMonth) || ""
      } catch {}
      const now = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7)
      setMonthState((cur) => cur || saved || months[0]?.month || now)
    })()
  }, [loadMachineMonths])

  const loadMachineMonth = useCallback(async (m) => {
    if (!m) return
    setMachineLoading(true)
    try {
      const j = await (await fetch(`/api/machine?month=${m}`)).json()
      if (j?.ok) setMachineCache((c) => ({ ...c, [m]: j.data || [] }))
    } catch {}
    setMachineLoading(false)
  }, [])
  useEffect(() => {
    if (month && machineCache[month] === undefined) loadMachineMonth(month)
  }, [month, machineCache, loadMachineMonth])
  // Another PC may have imported meanwhile — refresh when this tab regains focus.
  useEffect(() => {
    const onFocus = () => {
      if (month) loadMachineMonth(month)
      loadMachineMonths()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [month, loadMachineMonth, loadMachineMonths])

  // Import draft: pasted text stays in this browser until "Save to cloud".
  const draftPunches = useMemo(() => parseInputData(input), [input])
  const draftStats = useMemo(() => inputStats(draftPunches), [draftPunches])
  const [importNote, setImportNote] = useState(null) // { busy } | { tone, text }
  const niceMonth = (m) => monthInfo(m).label.replace("-", " ")
  const saveDraft = async () => {
    if (!draftPunches.length) return
    setImportNote({ busy: true })
    try {
      const r = await fetch("/api/machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ punches: draftPunches.map(({ id, date, time }) => ({ id, date, time })) }),
      })
      if (r.status === 401) return (window.location.href = "/login")
      const j = await r.json()
      if (!j?.ok) throw new Error(j?.error || "server error")
      const saved = [...(j.saved || [])].sort((a, b) => b.month.localeCompare(a.month))
      setMachineCache((c) => {
        const n = { ...c }
        for (const x of saved) delete n[x.month]
        return n
      })
      await loadMachineMonths()
      const parts = saved.map((x) => `${niceMonth(x.month)}: ${x.added} new punch${x.added === 1 ? "" : "es"} (${x.total} total)`)
      if (j.locked?.length) parts.push(`${j.locked.map(niceMonth).join(", ")} is locked in Records, so it was not changed`)
      setImportNote({ tone: j.locked?.length ? "warn" : "ok", text: `Saved to cloud · ${parts.join(" · ")}` })
      if (!j.locked?.length) setInput("")
      if (saved[0]) setMonth(saved[0].month)
    } catch (e) {
      setImportNote({ tone: "err", text: `Could not save to cloud (${e.message}). The data is still here, try again.` })
    }
  }
  const deleteMachineMonth = async (m) => {
    if (!confirm(`Delete ALL machine data for ${niceMonth(m)}? Everyone will lose this month's punches until it is imported again.`)) return
    try {
      const j = await (await fetch(`/api/machine?month=${m}`, { method: "DELETE" })).json()
      if (!j?.ok) throw new Error(j?.error || "server error")
      setMachineCache((c) => ({ ...c, [m]: [] }))
      await loadMachineMonths()
      setImportNote({ tone: "ok", text: `Deleted machine data for ${niceMonth(m)}.` })
    } catch (e) {
      setImportNote({ tone: "err", text: `Could not delete: ${e.message}` })
    }
  }

  // ---- engine pipeline (memoized) ----
  // The selected month's machine punches (machine IDs → employees via
  // machineId) + that month's approved app check-ins.
  const machinePunches = useMemo(
    () => attributePunches(machineCache[month] || [], employees),
    [machineCache, month, employees],
  )
  const stats = useMemo(() => inputStats(machinePunches), [machinePunches])
  const punches = useMemo(
    () => [...machinePunches, ...appPunches.filter((p) => month && String(p.date).startsWith(month))],
    [machinePunches, appPunches, month],
  )
  // Machine-fault / office-work corrections (with notes) for this month,
  // applied before anything is computed so every screen agrees.
  const corrections = useMemo(() => {
    const out = {}
    const byEmp = adjustments[month]?.corrections || {}
    for (const [id, days] of Object.entries(byEmp))
      for (const [d, c] of Object.entries(days || {}))
        if (c) out[`${id}|${month}-${String(d).padStart(2, "0")}`] = c
    return out
  }, [adjustments, month])
  const records = useMemo(
    () => applyCorrections(buildDailyRecords(punches, settings, employees), corrections, employees),
    [punches, settings, employees, corrections],
  )
  const period = useMemo(() => getPeriod(records, settings), [records, settings])
  const summary = useMemo(
    () => buildSummary(records, settings, employees, period),
    [records, settings, employees, period],
  )
  const dashboard = useMemo(
    () => buildDashboard(records, summary, period),
    [records, summary, period],
  )
  // Monthly adjustments are keyed by the month being viewed.
  const monthKey = month
  // Advances come from the ledger unless a value was typed for the month.
  const adjForPeriod = useMemo(() => {
    const m = adjustments[monthKey] || { ot: {}, penalty: {}, bonus: {} }
    const advance = { ...(m.advance || {}) }
    for (const key of Object.keys(employees)) {
      if (Object.prototype.hasOwnProperty.call(advance, key)) continue
      const due = advanceDue(advances, key, monthKey)
      if (due) advance[key] = due
    }
    return { ...m, advance }
  }, [adjustments, monthKey, advances, employees])
  const setOt = (id, hours) =>
    updateMonth(monthKey, "ot", (m) => ({ ...m, [id]: hours }))
  const approveAllOt = (patch) =>
    updateMonth(monthKey, "ot", (m) => ({ ...m, ...patch }))
  const setPenalty = (id, amt) =>
    updateMonth(monthKey, "penalty", (m) => ({ ...m, [id]: amt }))
  const setBonus = (id, amt) =>
    updateMonth(monthKey, "bonus", (m) => ({ ...m, [id]: amt }))
  const setAdvance = (id, amt) =>
    updateMonth(monthKey, "advance", (m) => ({ ...m, [id]: amt }))
  const setLeaveEarned = (id, days) =>
    updateMonth(monthKey, "leaveEarned", (m) => ({ ...m, [id]: days }))
  const setLeaveSick = (id, days) =>
    updateMonth(monthKey, "leaveSick", (m) => ({ ...m, [id]: days }))
  const setLeaveMonthly = (id, days) =>
    updateMonth(monthKey, "leaveMonthly", (m) => ({ ...m, [id]: days }))

  const payroll = useMemo(
    () => buildPayroll(summary, settings, period, adjForPeriod),
    [summary, settings, period, adjForPeriod],
  )
  const leave = useMemo(
    () => buildLeave(summary, adjustments, monthKey, settings),
    [summary, adjustments, monthKey, settings],
  )
  const unknownIds = useMemo(
    () => findUnknownIds(records, employees),
    [records, employees],
  )

  const tabs = [
    { value: "dashboard", label: "Dashboard", icon: <Icon.dashboard className="w-4 h-4" /> },
    { value: "live", label: "Live", icon: <Icon.live className="w-4 h-4" /> },
    { value: "daily", label: "Daily", icon: <Icon.calendar className="w-4 h-4" />, count: records.length || null },
    { value: "summary", label: "Summary", icon: <Icon.users className="w-4 h-4" />, count: dashboard?.totals.activeWithData || null },
    { value: "leave", label: "Leave", icon: <Icon.leaf className="w-4 h-4" /> },
    { value: "payroll", label: "Payroll", icon: <Icon.wallet className="w-4 h-4" /> },
    { value: "salary", label: "Salary sheet", icon: <Icon.sheet className="w-4 h-4" /> },
  ]

  const tools = [
    { value: "approvals", label: "Approvals", icon: <Icon.inbox className="w-4 h-4" />, badge: pendingCount, badgeTone: "amber" },
    { value: "projects", label: "Projects", icon: <Icon.pin className="w-4 h-4" /> },
    { value: "records", label: "Records", icon: <Icon.history className="w-4 h-4" /> },
    { value: "employees", label: "Employees", icon: <Icon.users className="w-4 h-4" />, badge: unknownIds.length, badgeTone: "violet" },
    { value: "users", label: "Logins", icon: <Icon.key className="w-4 h-4" /> },
    { value: "settings", label: "Settings", icon: <Icon.settings className="w-4 h-4" /> },
  ]

  const openTab = (v) => {
    setTab(v)
    setSidebarOpen(false)
  }
  const openModal = (v) => {
    setModal(v)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Icon.menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold">Green<span className="text-emerald-500">Touch</span></span>
        <CloudStatus status={syncStatus} inline />
      </div>

      {/* Backdrop (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm">
            <Icon.building className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight">
              Green<span className="text-emerald-500">Touch</span>
            </h1>
            <p className="text-[11px] text-slate-400">Attendance & Payroll</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {tabs.map((t) => (
              <SideItem
                key={t.value}
                icon={t.icon}
                label={t.label}
                active={tab === t.value}
                count={t.count}
                onClick={() => openTab(t.value)}
              />
            ))}
          </div>
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Manage
            </p>
            {tools.map((t) => (
              <SideItem
                key={t.value}
                icon={t.icon}
                label={t.label}
                onClick={() => openModal(t.value)}
                badge={t.badge}
                badgeTone={t.badgeTone}
              />
            ))}
          </div>
        </nav>

        <div className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
          <div className="flex items-center justify-between px-1">
            <CloudStatus status={syncStatus} inline />
            <button
              onClick={toggleTheme}
              title="Toggle theme"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {dark ? <Icon.sun className="w-4 h-4" /> : <Icon.moon className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-900/20"
          >
            <Icon.logout className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 md:px-8">
          <PastePanel
            month={month}
            setMonth={setMonth}
            months={machineMonths}
            stats={stats}
            loading={machineLoading || machineCache[month] === undefined}
            input={input}
            setInput={setInput}
            draftStats={draftStats}
            onSave={saveDraft}
            note={importNote}
            onDismissNote={() => setImportNote(null)}
            onDeleteMonth={deleteMachineMonth}
          />

          {tab === "dashboard" && (
            <Dashboard
              dashboard={dashboard}
              payroll={payroll}
              period={period}
              settings={settings}
              unknownIds={unknownIds}
              onManage={() => setModal("employees")}
            />
          )}
          {tab === "live" && (
            <LiveBoard
              period={period}
              employees={employees}
              settings={settings}
            />
          )}
          {tab === "daily" && (
            <DailyTable records={records} period={period} settings={settings} />
          )}
          {tab === "summary" && (
            <SummaryTable summary={summary} period={period} />
          )}
          {tab === "leave" && (
            <LeaveTable
              leave={leave}
              period={period}
              monthKey={monthKey}
              onEarned={setLeaveEarned}
              onSick={setLeaveSick}
              onMonthly={setLeaveMonthly}
            />
          )}
          {tab === "salary" && month && (
            <SalarySheet
              employees={employees}
              setEmployees={setEmployees}
              settings={settings}
              adjustments={adjustments}
              updateMonth={updateMonth}
              advances={advances}
              setAdvances={setAdvances}
              records={records}
              coverage={period /* same data window as the Payroll page */}
              month={month}
              setMonth={setMonth}
              currency={settings.currency}
              onOpenEmployees={() => openModal("employees")}
            />
          )}
          {tab === "payroll" && (
            <PayrollTable
              payroll={payroll}
              settings={settings}
              period={period}
              onApprove={setOt}
              onApproveAll={approveAllOt}
              onPenalty={setPenalty}
              onBonus={setBonus}
              onAdvance={setAdvance}
            />
          )}

          <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
            {syncStatus === "offline"
              ? "Saved locally · cloud offline"
              : "Synced to cloud · cached locally"}{" "}
            · {records.length} day-records processed
          </footer>
        </main>
      </div>

      {modal === "employees" && (
        <EmployeesModal
          employees={employees}
          setEmployees={setEmployees}
          unknownIds={unknownIds}
          currency={settings.currency}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "records" && (
        <RecordsModal
          monthKey={monthKey}
          period={period}
          payroll={payroll}
          currency={settings.currency}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "projects" && (
        <ProjectsModal onClose={() => setModal(null)} />
      )}
      {modal === "users" && (
        <UsersModal employees={employees} setEmployees={setEmployees} onClose={() => setModal(null)} />
      )}
      {modal === "approvals" && (
        <ApprovalsModal
          onChange={(n) => {
            setPendingCount(n)
            loadAppPunches() // a just-approved session should appear in the tables
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// Sidebar / mobile-bar navigation button.
function SideItem({ icon, label, active, onClick, count, badge, badgeTone }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-emerald-500 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <span className={active ? "" : "text-slate-400"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 text-xs ${
            active
              ? "bg-white/25"
              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {count}
        </span>
      )}
      {badge > 0 && (
        <span
          className={`rounded-full px-1.5 text-xs font-semibold text-white ${
            badgeTone === "violet" ? "bg-violet-500" : "bg-amber-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// Small pill showing whether data is syncing to MongoDB.
function CloudStatus({ status, inline }) {
  const map = {
    synced: { tone: "text-emerald-600 dark:text-emerald-400", icon: <Icon.cloud className="w-4 h-4" />, label: "Synced" },
    saving: { tone: "text-amber-600 dark:text-amber-400", icon: <Icon.cloud className="w-4 h-4 animate-pulse" />, label: "Saving…" },
    offline: { tone: "text-slate-400", icon: <Icon.cloudOff className="w-4 h-4" />, label: "Offline" },
    loading: { tone: "text-slate-400", icon: <Icon.cloud className="w-4 h-4 animate-pulse" />, label: "…" },
  }
  const s = map[status] || map.loading
  return (
    <span
      title={status === "offline" ? "Cloud unreachable — saved locally" : "Cloud sync"}
      className={`items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${s.tone} ${
        inline ? "inline-flex" : "hidden sm:inline-flex"
      }`}
    >
      {s.icon}
      {s.label}
    </span>
  )
}
