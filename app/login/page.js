"use client"

import { useState } from "react"
import { useLang, LangToggle } from "@/lib/i18n"

export default function LoginPage() {
  const { lang, setLang, t } = useLang()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json?.ok) {
        // Full navigation so the new cookie is sent through middleware.
        window.location.href = json.role === "employee" ? "/app" : "/"
      } else {
        setError(
          json?.error === "Incorrect username or password"
            ? t("errIncorrect")
            : json?.error || t("errIncorrect"),
        )
        setBusy(false)
      }
    } catch {
      setError(t("errNetwork"))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex justify-center">
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <rect x="4" y="3" width="16" height="18" rx="1" />
              <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Green<span className="text-emerald-500">Touch</span>
          </h1>
          <p className="text-sm text-slate-500">{t("tagline")}</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("username")}
          </label>
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-900/40"
          />

          <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-900/40"
          />

          {error && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">{t("ownerHint")}</p>
      </div>
    </div>
  )
}
