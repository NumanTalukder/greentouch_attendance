"use client"

import { useCallback, useEffect, useState } from "react"
import { useLang, LangToggle } from "@/lib/i18n"

const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dhaka",
      })
    : "—"

const fmtDur = (min) => {
  if (min == null) return "—"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

const elapsed = (fromIso, nowMs) => {
  const s = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n) => String(n).padStart(2, "0")
  return `${p(h)}:${p(m)}:${p(sec)}`
}

const getPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  })

const currentMonth = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7)

const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const monthLabel = (month, lang) => {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(
    lang === "bn" ? "bn-BD" : "en-US",
    { month: "long", year: "numeric" },
  )
}

const Stat = ({ label, value, tone }) => (
  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
    <div className={`text-lg font-bold tabular-nums ${tone}`}>{value}</div>
    <div className="text-[11px] text-slate-400">{label}</div>
  </div>
)

const LeaveRow = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-800/50">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
)

export default function EmployeeApp() {
  const { lang, setLang, t } = useLang()
  const [month, setMonth] = useState(currentMonth)
  const [my, setMy] = useState(null)
  const [me, setMe] = useState(null)
  const [status, setStatus] = useState(null)
  const [projects, setProjects] = useState([])
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState("")
  const [msg, setMsg] = useState(null)
  const [field, setField] = useState(null)
  const [coField, setCoField] = useState(null)
  const [tick, setTick] = useState(Date.now())

  const badge = (s) => {
    const map = {
      approved: ["bg-emerald-100 text-emerald-700", t("statusApproved")],
      pending: ["bg-amber-100 text-amber-700", t("statusPending")],
      rejected: ["bg-rose-100 text-rose-700", t("statusRejected")],
    }
    const [cls, label] = map[s] || ["bg-slate-100 text-slate-600", s]
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
        {label}
      </span>
    )
  }

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/me/status")
      if (r.status === 401) return (window.location.href = "/login")
      const j = await r.json()
      if (j?.ok) setStatus({ open: j.open, today: j.today || [] })
    } catch {}
  }, [])

  const loadMy = useCallback(() => {
    fetch(`/api/me/summary?month=${month}`)
      .then((r) => r.json())
      .then((j) => setMy(j))
      .catch(() => {})
  }, [month])

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((j) => setMe(j?.user || null))
    fetch("/api/me/projects").then((r) => r.json()).then((j) => setProjects(j?.data || []))
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    loadMy()
  }, [loadMy])

  useEffect(() => {
    const t2 = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t2)
  }, [])

  const doCheckIn = async (projectId, opts = {}) => {
    setMsg(null)
    setBusy("locating")
    const pos = await getPosition()
    setBusy("in")
    try {
      const r = await fetch("/api/me/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...(pos || {}), ...opts }),
      })
      const j = await r.json()
      if (j?.ok) {
        setField(null)
        setMsg({
          tone: j.status === "approved" ? "ok" : "warn",
          text: j.status === "approved" ? t("msgCheckedIn") : t("msgSubmitted"),
        })
        await loadStatus()
        loadMy()
      } else if (j?.code === "out_of_fence" || j?.code === "no_gps") {
        const proj = projects.find((p) => p.id === projectId)
        setField({ projectId, name: proj?.name, code: j.code, distance: j.distance, radius: j.radius, reason: "" })
      } else if (j?.code === "fieldwork_disabled") {
        setMsg({ tone: "err", text: t("errFieldworkDisabled") })
      } else {
        setMsg({ tone: "err", text: j?.error || t("errCheckin") })
      }
    } catch {
      setMsg({ tone: "err", text: t("errNetwork") })
    }
    setBusy("")
  }

  const submitFieldwork = async () => {
    if (!field?.reason.trim()) return
    await doCheckIn(field.projectId, { fieldwork: true, reason: field.reason })
  }

  const doCheckOut = async (opts = {}) => {
    setBusy("out")
    setMsg(null)
    const pos = await getPosition()
    try {
      const r = await fetch("/api/me/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(pos || {}), ...opts }),
      })
      const j = await r.json()
      if (j?.ok) {
        setCoField(null)
        setSelected("")
        setMsg({
          tone: j.review ? "warn" : "ok",
          text: j.review ? t("msgCheckoutReview") : t("msgCheckedOut"),
        })
        await loadStatus()
        loadMy()
      } else if (j?.code === "out_of_fence" || j?.code === "no_gps") {
        setCoField({ code: j.code, distance: j.distance, radius: j.radius, reason: "" })
      } else setMsg({ tone: "err", text: j?.error || t("errCheckout") })
    } catch {
      setMsg({ tone: "err", text: t("errNetwork") })
    }
    setBusy("")
  }

  const submitCheckoutOffsite = async () => {
    if (!coField?.reason.trim()) return
    await doCheckOut({ offsite: true, reason: coField.reason })
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    window.location.href = "/login"
  }

  const open = status?.open
  const today = status?.today || []

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h.01M15 7h.01M9 11h.01M9 15h.01" /></svg>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Green<span className="text-emerald-500">Touch</span></p>
              <p className="text-[11px] text-slate-400">{me?.name || "…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle lang={lang} setLang={setLang} />
            <button onClick={logout} className="text-xs font-medium text-slate-500 hover:text-rose-600">
              {t("logout")}
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              msg.tone === "ok"
                ? "bg-emerald-100 text-emerald-800"
                : msg.tone === "warn"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        {open ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm dark:border-emerald-900/40 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              {t("checkedIn")} {open.status === "pending" ? `· ${t("inReview")}` : ""}
            </p>
            <p className="mt-1 text-lg font-bold">{open.projectName}</p>
            <p className="text-xs text-slate-400">{t("since")} {fmtTime(open.checkInAt)}</p>
            <p className="my-4 font-mono text-4xl font-bold tabular-nums">
              {elapsed(open.checkInAt, tick)}
            </p>
            {open.status === "pending" && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("offsiteAwaiting")}
              </p>
            )}
            {coField ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900/40 dark:bg-amber-900/10">
                <p className="text-sm font-medium text-amber-700">
                  {coField.code === "no_gps"
                    ? t("noGps")
                    : t("awayDist", { distance: coField.distance, radius: coField.radius })}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t("checkoutOffsiteHelp")}</p>
                <textarea
                  value={coField.reason}
                  onChange={(e) => setCoField({ ...coField, reason: e.target.value })}
                  placeholder={t("reasonPlaceholder")}
                  className="mt-2 h-20 w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setCoField(null)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={submitCheckoutOffsite}
                    disabled={!coField.reason.trim() || !!busy}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {busy ? t("submitting") : t("submitReview")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => doCheckOut()}
                  disabled={!!busy}
                  className="w-full rounded-xl bg-rose-500 py-3.5 text-base font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  {busy === "out" ? t("checkingOut") : t("checkOut")}
                </button>
                <button
                  onClick={() => doCheckOut()}
                  className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {t("switchProject")}
                </button>
              </>
            )}
          </div>
        ) : field ? (
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
            <p className="font-semibold text-amber-700">{t("outside", { name: field.name })}</p>
            <p className="mt-1 text-sm text-slate-500">
              {field.code === "no_gps"
                ? t("noGps")
                : t("awayDist", { distance: field.distance, radius: field.radius })}{" "}
              {t("fieldworkHelp")}
            </p>
            <textarea
              value={field.reason}
              onChange={(e) => setField({ ...field, reason: e.target.value })}
              placeholder={t("reasonPlaceholder")}
              className="mt-3 h-20 w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setField(null)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {t("cancel")}
              </button>
              <button
                onClick={submitFieldwork}
                disabled={!field.reason.trim() || !!busy}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {busy ? t("submitting") : t("submitReview")}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-3 text-sm font-semibold">{t("selectProject")}</p>
            {projects.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{t("noProjects")}</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      selected === p.id
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {p.address || p.code || `${p.radius}m`}
                      </span>
                    </span>
                    {selected === p.id && <span className="text-emerald-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => doCheckIn(selected)}
              disabled={!selected || !!busy}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-3.5 text-base font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy === "locating" ? t("gettingLocation") : busy === "in" ? t("checkingIn") : t("checkIn")}
            </button>
          </div>
        )}

        {/* My month */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("myMonth")}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ‹
              </button>
              <span className="min-w-[112px] text-center text-sm font-medium">
                {monthLabel(month, lang)}
              </span>
              <button
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="rounded-md px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ›
              </button>
            </div>
          </div>

          {my && my.linked === false ? (
            <p className="mt-3 text-sm text-slate-400">{t("notLinked")}</p>
          ) : my && my.stats ? (
            <>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Stat label={t("present")} value={my.stats.present} tone="text-emerald-600 dark:text-emerald-400" />
                <Stat label={t("late")} value={my.stats.late} tone="text-amber-600 dark:text-amber-400" />
                <Stat label={t("absent")} value={my.stats.absent} tone="text-rose-600 dark:text-rose-400" />
                <Stat label={t("overtime")} value={`${my.stats.otHours}${t("hrs")}`} tone="text-sky-600 dark:text-sky-400" />
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {my.category === "field" && (
                  <LeaveRow label={t("monthlyLeaveLeft")} value={`${my.leave.monthLeft} / ${my.leave.fieldMonthly}`} />
                )}
                <LeaveRow label={t("earnedLeaveLeft")} value={`${my.leave.earnedLeft} / ${my.leave.entE}`} />
                <LeaveRow label={t("sickLeaveLeft")} value={`${my.leave.sickLeft} / ${my.leave.entS}`} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-400">…</p>
          )}
        </div>

        <div>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("today")}
          </p>
          {today.length === 0 ? (
            <p className="px-1 text-sm text-slate-400">{t("noSessionsToday")}</p>
          ) : (
            <div className="space-y-2">
              {today.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-medium">{s.projectName}</span>
                    <span className="text-xs text-slate-400">
                      {fmtTime(s.checkInAt)} – {s.checkOutAt ? fmtTime(s.checkOutAt) : t("now")}
                      {s.checkOutAt ? ` · ${fmtDur(s.durationMin)}` : ""}
                    </span>
                  </div>
                  {badge(s.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
