// Company identity used on printed reports / payslips.
export const COMPANY = {
  name: "GreenTouch",
  tagline: "Attendance & Payroll",
  address: "",
}

// All business rules live here so nothing is hard-coded in the UI.
// Times are "HH:MM" (24h). weekendDays use JS getDay(): 0=Sun ... 5=Fri, 6=Sat.
export const DEFAULT_SETTINGS = {
  officeStart: "09:00", // expected check-in
  officeEnd: "19:00", // expected check-out (7 PM)
  graceMinutes: 10, // minutes after start that still count as on-time
  halfDayStart: "11:00", // arrive after this => half day
  otStart: "19:00", // overtime accrues after this
  otThreshold: "19:10", // stay past this to be flagged "stayed late"
  dayBoundary: "05:00", // punches before this roll into the previous work day
  weekendDays: [5], // Friday off
  holidays: [], // ["YYYY-MM-DD", ...] excluded from working days

  // Payroll (money) — editable per company.
  currency: "৳",
  otMethod: "salary", // "salary" → salary ÷ (days × hours); "flat" → fixed rate
  standardHoursPerDay: 8, // working hours per day, used for the salary-based OT rate
  otHourlyRate: 50, // flat rate per overtime hour (only when otMethod = "flat")
  perDayBasis: "fixed30", // days/month for per-day rate & OT: "working" | "fixed26" | "fixed30"
  deductAbsent: true, // subtract a day's pay per absent day
  halfDayPayFactor: 0.5, // a half day is paid at 50%
  lateDeductionPerDay: 0, // money deducted per late arrival (0 = just track it)
}

// Seed employee directory. Names carried over from the original app;
// designation / department / salary are placeholders to fill in via Employees.
const SEED_NAMES = {
  1: "Root",
  2: "Numan Talukder",
  3: "Shahjahan Patwary",
  4: "Alamgir Hossain",
  5: "Md. Fariduzzaman",
  6: "Jahan Talukder",
  7: "Jisan Talukder",
  8: "Maksud Alam Bhuiyan",
  9: "Sabbir Alam Bhuiyan",
  10: "Mohon",
  11: "Abul Kalam",
  12: "Rajib Talukder",
  13: "Masud Farvez Rony",
  14: "Md Tajuddin Talukder",
  15: "Md Saiful Islam",
  17: "Shakhawat Hossain",
  18: "Md Raeduzzaman",
  19: "Jubayer",
  20: "Sharif Audit",
  21: "Sumiya Amin Sharmeen",
  23: "Mizanur Rahman",
}

export const blankEmployee = (name = "") => ({
  name,
  designation: "Staff",
  department: "General",
  salary: 0,
  joinDate: "",
  phone: "",
  active: true,
})

export const DEFAULT_EMPLOYEES = Object.fromEntries(
  Object.entries(SEED_NAMES).map(([id, name]) => [id, blankEmployee(name)]),
)

export const STORAGE_KEYS = {
  employees: "gt_employees_v2",
  settings: "gt_settings_v1",
  input: "gt_input_v1",
  theme: "gt_theme",
  legacyEmployees: "employees", // old id->name map, migrated on first load
}

// A small, realistic sample so the app is explorable before real data is pasted.
export const SAMPLE_DATA = `2  2026-06-01  09:02:11
2  2026-06-01  19:34:02
3  2026-06-01  09:48:20
3  2026-06-01  18:31:55
4  2026-06-01  11:20:05
4  2026-06-01  19:05:40
5  2026-06-01  08:55:00
5  2026-06-01  20:12:30
2  2026-06-02  08:58:41
2  2026-06-02  19:10:09
3  2026-06-02  09:05:00
3  2026-06-02  19:02:18
4  2026-06-02  09:00:12
4  2026-06-02  18:40:00
5  2026-06-02  09:31:44
5  2026-06-02  19:48:51
2  2026-06-03  09:01:00
2  2026-06-03  19:22:00
4  2026-06-03  09:12:33
4  2026-06-03  19:01:10
5  2026-06-03  08:50:20
5  2026-06-03  17:45:00`
