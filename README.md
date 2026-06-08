# GreenTouch · Attendance & Payroll

Paste the raw export from your ZKTeco attendance machine and instantly get a
dashboard, daily records, a monthly summary, and a full payroll with payslips.
Everything runs **in the browser** — no server, no database. Your data and
settings are saved to the browser's local storage, and the app deploys to
Vercel exactly as-is.

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
   - **Payroll** — salary, overtime pay, deductions and net payable, plus
     printable payslips.

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
| Per-day pay | salary ÷ working days | Basis for absent / half-day deductions |

### Status & absence logic

- A day with only one punch is **Incomplete** (missing check-in or check-out) —
  work hours can't be computed.
- **Absence** is only counted for employees who appear in the pasted data. An
  active employee with *no* punches all period is **flagged for review**, never
  auto-deducted — punch logs can't tell "absent" from "no longer employed".
  Mark them inactive in **Employees** to drop them from reports.
- **Payroll** only includes employees who have attendance; zero-attendance
  staff are excluded (and counted) rather than paid a full, undeducted salary.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (outputs to ./build)
```

Stack: Next.js 13 (App Router) · React 18 · Tailwind CSS. No other runtime
dependencies. Source is plain JavaScript:

```
lib/        parse · engine · payroll · format · export · storage · constants
components/  AppShell, Dashboard, DailyTable, SummaryTable, PayrollTable, ui, modals/
```
