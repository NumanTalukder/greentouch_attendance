"use client"

import { useEffect, useMemo, useState } from "react"
import { parseInputData, inputStats } from "@/lib/parse"
import {
  buildDailyRecords,
  buildSummary,
  buildDashboard,
  getPeriod,
  findUnknownIds,
} from "@/lib/engine"
import { buildPayroll } from "@/lib/payroll"
import { buildLeave } from "@/lib/leave"
import {
  useEmployees,
  useSettings,
  useInput,
  useAdjustments,
} from "@/lib/storage"
import { STORAGE_KEYS, SAMPLE_DATA } from "@/lib/constants"

import { Icon, Segmented } from "./ui"
import PastePanel from "./PastePanel"
import Dashboard from "./Dashboard"
import DailyTable from "./DailyTable"
import SummaryTable from "./SummaryTable"
import PayrollTable from "./PayrollTable"
import LeaveTable from "./LeaveTable"
import EmployeesModal from "./modals/EmployeesModal"
import SettingsModal from "./modals/SettingsModal"
import RecordsModal from "./modals/RecordsModal"

export default function AppShell() {
  const { input, setInput } = useInput()
  const { settings, setSettings, status: settingsStatus } = useSettings()
  const { employees, setEmployees, status: employeesStatus } = useEmployees()
  const { adjustments, updateMonth, status: adjStatus } = useAdjustments()

  // Combined cloud sync status across all synced stores.
  const syncStatus = useMemo(() => {
    const all = [employeesStatus, settingsStatus, adjStatus]
    if (all.includes("saving")) return "saving"
    if (all.includes("offline")) return "offline"
    if (all.includes("loading")) return "loading"
    return "synced"
  }, [employeesStatus, settingsStatus, adjStatus])

  const [tab, setTab] = useState("dashboard")
  const [modal, setModal] = useState(null) // "employees" | "settings"
  const [dark, setDark] = useState(false)

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

  // ---- engine pipeline (memoized) ----
  const punches = useMemo(() => parseInputData(input), [input])
  const stats = useMemo(() => inputStats(punches), [punches])
  const records = useMemo(
    () => buildDailyRecords(punches, settings, employees),
    [punches, settings, employees],
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
  // Manual adjustments (approved OT, penalties, bonuses) are stored per month;
  // derive the key from the pasted period.
  const monthKey = period.from ? period.from.slice(0, 7) : ""
  const adjForPeriod = useMemo(
    () => adjustments[monthKey] || { ot: {}, penalty: {}, bonus: {} },
    [adjustments, monthKey],
  )
  const setOt = (id, hours) =>
    updateMonth(monthKey, "ot", (m) => ({ ...m, [id]: hours }))
  const approveAllOt = (patch) =>
    updateMonth(monthKey, "ot", (m) => ({ ...m, ...patch }))
  const setPenalty = (id, amt) =>
    updateMonth(monthKey, "penalty", (m) => ({ ...m, [id]: amt }))
  const setBonus = (id, amt) =>
    updateMonth(monthKey, "bonus", (m) => ({ ...m, [id]: amt }))
  const setLeaveEarned = (id, days) =>
    updateMonth(monthKey, "leaveEarned", (m) => ({ ...m, [id]: days }))
  const setLeaveSick = (id, days) =>
    updateMonth(monthKey, "leaveSick", (m) => ({ ...m, [id]: days }))

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
    { value: "daily", label: "Daily", icon: <Icon.calendar className="w-4 h-4" />, count: records.length || null },
    { value: "summary", label: "Summary", icon: <Icon.users className="w-4 h-4" />, count: dashboard?.totals.activeWithData || null },
    { value: "leave", label: "Leave", icon: <Icon.leaf className="w-4 h-4" /> },
    { value: "payroll", label: "Payroll", icon: <Icon.wallet className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
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

          <div className="flex items-center gap-2">
            <CloudStatus status={syncStatus} />
            <button
              onClick={() => setModal("records")}
              title="Monthly records (cloud)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Icon.history className="w-4 h-4" />
              <span className="hidden md:inline">Records</span>
            </button>
            <button
              onClick={() => setModal("employees")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Icon.users className="w-4 h-4" />
              <span className="hidden sm:inline">Employees</span>
              {unknownIds.length > 0 && (
                <span className="rounded-full bg-violet-500 px-1.5 text-xs text-white">
                  {unknownIds.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setModal("settings")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Icon.settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={toggleTheme}
              title="Toggle theme"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dark ? <Icon.sun className="w-4 h-4" /> : <Icon.moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              title="Log out"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-900/20"
            >
              <Icon.logout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 md:px-6">
        <PastePanel
          input={input}
          setInput={setInput}
          stats={stats}
          onSample={() => setInput(SAMPLE_DATA)}
          onClear={() => setInput("")}
        />

        <div className="flex items-center justify-between">
          <Segmented options={tabs} value={tab} onChange={setTab} />
        </div>

        <div>
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
            />
          )}
        </div>

        <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
          {syncStatus === "offline"
            ? "Saved locally · cloud offline"
            : "Synced to cloud · cached locally"}{" "}
          · {records.length} day-records processed
        </footer>
      </main>

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
    </div>
  )
}

// Small pill showing whether data is syncing to MongoDB.
function CloudStatus({ status }) {
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
      className={`hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium sm:inline-flex dark:border-slate-700 ${s.tone}`}
    >
      {s.icon}
      {s.label}
    </span>
  )
}
