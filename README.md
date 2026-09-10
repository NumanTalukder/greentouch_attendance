# GreenTouch · Attendance & Payroll

Paste the raw export from your ZKTeco attendance machine and instantly get a
dashboard, daily records, a monthly summary, and a full payroll with payslips.

The app is **offline-first**: it works entirely in the browser (localStorage),
and when a MongoDB connection is configured it **also syncs** employees,
settings, monthly adjustments, and archived payroll records to the cloud so the
data is shared and backed up. The cloud status shows in the top bar.

## How it works

1. **Paste** the machine log into the box at the top. Each line is one punch:

   ```
   2   2026-06-01   09:02:11
   2   2026-06-01   19:34:02
   ```

   The parser is tolerant of extra columns, tabs, commas, `DD/MM/YYYY` dates
   and `AM/PM` times. One row = one punch (a check-in or check-out event).

2. The engine groups punches per employee per **work day**, picks the earliest
   punch as check-in and the latest as check-out, and classifies the day.

3. Browse the four tabs:
   - **Dashboard** — KPIs (on-time rate, absences, overtime, net payroll),
     punctuality mix, attendance-by-day, late watchlist, perfect attendance.
   - **Daily** — every check-in/out with status, work hours and overtime;
     searchable and filterable (late / half day / left early / overtime).
   - **Summary** — per-employee monthly roll-up with attendance %.
   - **Leave** — approve each employee's **earned/sick** days for the month and
     track the year-to-date balance (see below). Approved leave is paid.
   - **Payroll** — salary, approved overtime, attendance deductions, plus
     per-employee **Bonus**, **Penalty** and **Advance** amounts you enter
     manually (advance = a salary advance being recovered), giving
     **Net = salary + OT + bonus − deductions − penalty − advance**. Printable payslips.

Every table exports to **CSV** and prints a clean, letterheaded report.

## The rules (all editable in Settings)

Defaults match GreenTouch's schedule — **9:00 AM – 7:00 PM, Friday off**:

| Rule | Default | Meaning |
|------|---------|---------|
| Office start / grace | 9:00 + 10 min | Arrive after 9:10 → **Late** |
| Half-day cutoff | 11:00 | Arrive after 11:00 → **Half Day** |
| Office end | 7:00 PM | Leave before → flagged "left early" |
| Overtime start | 7:00 PM | Minutes after this become **overtime** |
| Day boundary | 5:00 AM | Punches before 5 AM count toward the previous day |
| Weekend | Friday | Used to count working days for absence |
| Overtime pay | salary ÷ (days × 8h) × OT hrs | Each employee's own hourly wage (or switch to a flat rate) |
| Overtime approval | approved hours only | Only authority-approved (signed) OT hours are paid; worked OT is shown for reference |
| Late deduction | 1 day per 4 lates | `floor(late days ÷ 4)` days of pay (0–3 lates graced; 4–7 → 1 day; 8–11 → 2 …) |
| Paid leave | 10 earned + 7 sick / year | Leave year **Jul → June**; approved leave is paid, so it isn't deducted |
| Per-day pay | salary ÷ 30 | Basis for **unpaid** absent / half-day / late deductions |

### Status & absence logic

- A day with only one punch is **Incomplete** (missing check-in or check-out) —
  work hours can't be computed.
- **Absence** is only counted for employees who appear in the pasted data. An
  active employee with *no* punches all period is **flagged for review**, never
  auto-deducted — punch logs can't tell "absent" from "no longer employed".
  Mark them inactive in **Employees** to drop them from reports.
- **Payroll** only includes employees who have attendance; zero-attendance
  staff are excluded (and counted) rather than paid a full, undeducted salary.
- **Overtime** worked is computed from punches, but only the hours you **approve**
  on the Payroll tab (matching the signed sheet) are paid. "Approve all worked"
  approves everyone at once; per-month approvals are remembered.
- **Leave** is manually approved on the Leave tab: you enter how many earned/sick
  days each employee took this month. Those days become **paid** — so an absence
  covered by leave is *not* deducted; only **unpaid absence** = absent −
  paid-leave days is deducted. Balances are summed across the Jul–June leave year
  (10 earned + 7 sick by default) and turn red once exhausted.

## Cloud storage (MongoDB)

Optional but recommended. Copy `.env.example` to `.env.local` and set your
Atlas connection string (keep the DB name `greentouch-attendance` in the path):

```
MONGODB_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/greentouch-attendance?retryWrites=true&w=majority"
```

`.env.local` is gitignored and only ever read on the **server** (API routes) —
the URI never reaches the browser.

## Access & login

The whole app is behind a password. Set two more values in `.env.local`:

```
APP_PASSWORD="choose-a-strong-password"   # the login password
AUTH_SECRET="<openssl rand -hex 32>"       # signs the session cookie
```

A Next.js **middleware** (`middleware.js`) enforces this on every page *and*
every `/api/*` route: no valid session → pages redirect to `/login`, API calls
get **401**. So the payroll data can't be read by hitting the API directly.
Login sets a signed, HTTP-only cookie (7-day session); the top-bar logout button
clears it. Change `AUTH_SECRET` to force everyone to re-login. On Vercel, set
`APP_PASSWORD` and `AUTH_SECRET` as environment variables too. Use a dedicated, least-privilege Atlas user,
and add your server's IP (or `0.0.0.0/0` for testing) under Atlas → Network
Access. On Vercel, set `MONGODB_URI` in Project → Settings → Environment
Variables. If it's unset or unreachable, the app runs fine offline on
localStorage.

Collections created automatically:

| Collection | Shape |
|------------|-------|
| `employees` | one document per employee (`_id` = id): name, salary, department… |
| `state` | singletons `settings` and `adjustments` (per-month OT/penalty/bonus) |
| `records` | one document per finalised month (`_id` = `YYYY-MM`): totals + rows |

Save a month's snapshot from **Records** in the top bar.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (outputs to ./build)
```

Stack: Next.js 13 (App Router) · React 18 · Tailwind CSS · MongoDB driver.
Source is plain JavaScript:

```
lib/         parse · engine · payroll · leave · format · export · constants
             storage (offline-first sync) · db + dbState (server-only Mongo)
             auth (signed session)
app/api/     employees · settings · adjustments · records · auth/*  (server routes)
middleware.js  login gate on every page + API route
app/login/   password screen
components/  AppShell, Dashboard, DailyTable, SummaryTable, LeaveTable,
             PayrollTable, ui, modals/
```
