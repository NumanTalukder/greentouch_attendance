"use client"

// Shared, dependency-free UI primitives: inline icons, badges, stat cards,
// segmented control, sortable header. All theme-aware (light/dark).

const ic = (paths, props = {}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className || "w-5 h-5"}
    aria-hidden="true"
  >
    {paths}
  </svg>
)

export const Icon = {
  dashboard: (p) =>
    ic(
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>,
      p,
    ),
  calendar: (p) =>
    ic(
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
      </>,
      p,
    ),
  users: (p) =>
    ic(
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
      </>,
      p,
    ),
  wallet: (p) =>
    ic(
      <>
        <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
        <path d="M16 12h.01" />
      </>,
      p,
    ),
  settings: (p) =>
    ic(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>,
      p,
    ),
  sun: (p) =>
    ic(
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>,
      p,
    ),
  moon: (p) => ic(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />, p),
  printer: (p) =>
    ic(
      <>
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" rx="1" />
      </>,
      p,
    ),
  download: (p) =>
    ic(
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </>,
      p,
    ),
  search: (p) =>
    ic(
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </>,
      p,
    ),
  clock: (p) =>
    ic(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>,
      p,
    ),
  check: (p) => ic(<path d="M20 6L9 17l-5-5" />, p),
  alert: (p) =>
    ic(
      <>
        <path d="M10.3 3.9l-8 13.9A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-13.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </>,
      p,
    ),
  plus: (p) => ic(<path d="M12 5v14M5 12h14" />, p),
  x: (p) => ic(<path d="M18 6L6 18M6 6l12 12" />, p),
  trash: (p) =>
    ic(
      <>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </>,
      p,
    ),
  upload: (p) =>
    ic(
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </>,
      p,
    ),
  sort: (p) => ic(<path d="M8 9l4-5 4 5M16 15l-4 5-4-5" />, p),
  spark: (p) =>
    ic(
      <path d="M12 3l1.9 5.6L19.5 10l-4.6 2.4L12 18l-2.9-5.6L4.5 10l5.6-1.4z" />,
      p,
    ),
  building: (p) =>
    ic(
      <>
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
      </>,
      p,
    ),
  trend: (p) =>
    ic(<path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" />, p),
}

const TONES = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
}

export const Badge = ({ tone = "slate", children, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
  >
    {children}
  </span>
)

const STATUS_TONE = {
  Present: "green",
  Late: "amber",
  "Half Day": "orange",
  Incomplete: "violet",
  Absent: "red",
}

export const StatusBadge = ({ status }) => (
  <Badge tone={STATUS_TONE[status] || "slate"}>{status}</Badge>
)

export const StatCard = ({ icon, label, value, sub, tone = "slate" }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className={`rounded-lg p-1.5 ${TONES[tone]}`}>{icon}</span>
    </div>
    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
      {value}
    </div>
    {sub != null && (
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {sub}
      </div>
    )}
  </div>
)

export const Segmented = ({ options, value, onChange }) => (
  <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
          value === o.value
            ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        {o.icon}
        {o.label}
        {o.count != null && (
          <span className="ml-0.5 rounded-full bg-slate-200 px-1.5 text-xs dark:bg-slate-600">
            {o.count}
          </span>
        )}
      </button>
    ))}
  </div>
)

// Clickable table header that toggles sort direction.
export const SortTH = ({ field, label, sort, setSort, num, className = "" }) => {
  const active = sort.field === field
  return (
    <th
      onClick={() =>
        setSort({
          field,
          dir: active && sort.dir === "asc" ? "desc" : "asc",
        })
      }
      className={`cursor-pointer select-none px-3 py-2.5 font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${
        num ? "text-right" : "text-left"
      } ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${num ? "flex-row-reverse" : ""}`}>
        {label}
        <span className={active ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  )
}

// Thin horizontal bar for inline visualizations.
export const Bar = ({ value, max, tone = "green" }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const fill = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    blue: "bg-sky-500",
  }[tone]
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-2 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export const Empty = ({ icon, title, hint }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
    <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
      {icon}
    </div>
    <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
    {hint && <p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>}
  </div>
)
