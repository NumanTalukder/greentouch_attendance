// CSV export + print-ready HTML reports and payslips.
// Reports open in a clean popup window with their own letterhead styling,
// so they print well regardless of the on-screen theme.

import { COMPANY } from "./constants"
import { formatDateLong, formatMoney } from "./format"

const csvCell = (v) => {
  const s = v == null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const exportCSV = (filename, columns, rows) => {
  const header = columns.map((c) => csvCell(c.label)).join(",")
  const body = rows
    .map((r) => columns.map((c) => csvCell(c.render(r))).join(","))
    .join("\n")
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { font-size: 24px; font-weight: 800; letter-spacing: -.5px; }
  .brand span { color: #10b981; }
  .tag { color: #64748b; font-size: 12px; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #475569; line-height: 1.6; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 7px 9px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: .4px; color: #475569; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tfoot td { font-weight: 700; background: #ecfdf5; border-top: 2px solid #10b981; }
  .note { font-size: 11px; color: #64748b; margin-top: 14px; }
  .sign { margin-top: 56px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #94a3b8; padding-top: 6px; width: 200px; text-align: center; color: #475569; }
  @media print { body { margin: 12mm; } button { display: none; } }
`

const letterhead = (title, subtitle) => `
  <div class="head">
    <div>
      <div class="brand">Green<span>Touch</span></div>
      <div class="tag">${COMPANY.tagline}</div>
    </div>
    <div class="meta">
      <strong>${title}</strong><br/>
      ${subtitle || ""}<br/>
      Generated: ${formatDateLong(new Date().toISOString().slice(0, 10))}
    </div>
  </div>
`

const openAndPrint = (title, inner) => {
  const w = window.open("", "_blank", "width=1000,height=720")
  if (!w) {
    alert("Please allow popups to print the report.")
    return
  }
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <meta charset="utf-8"/><style>${PRINT_CSS}</style></head>
    <body>${inner}
    <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
    </body></html>`)
  w.document.close()
}

// Generic tabular report. columns: [{label, num?, render(row)}]. totals optional.
export const printReport = ({ title, subtitle, columns, rows, totals, note }) => {
  const thead = columns
    .map((c) => `<th class="${c.num ? "num" : ""}">${c.label}</th>`)
    .join("")
  const tbody = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => `<td class="${c.num ? "num" : ""}">${c.render(r)}</td>`)
          .join("")}</tr>`,
    )
    .join("")
  const tfoot = totals
    ? `<tfoot><tr>${columns
        .map(
          (c) =>
            `<td class="${c.num ? "num" : ""}">${
              c.total ? c.total(totals) : ""
            }</td>`,
        )
        .join("")}</tr></tfoot>`
    : ""

  openAndPrint(
    title,
    `${letterhead(title, subtitle)}
     <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>
     ${note ? `<div class="note">${note}</div>` : ""}
     <div class="sign"><div>Prepared by</div><div>Approved by</div></div>`,
  )
}

// One payslip per selected employee, page-broken for printing.
export const printPayslips = (payRows, settings, period) => {
  const c = settings.currency
  const slips = payRows
    .map(
      (r, i) => `
    <div style="${i ? "page-break-before: always;" : ""}">
      ${letterhead("Payslip", `${formatDateLong(period.from)} – ${formatDateLong(period.to)}`)}
      <table>
        <tr><th>Employee</th><td>${r.name}</td><th>ID</th><td class="num">${r.id}</td></tr>
        <tr><th>Designation</th><td>${r.designation}</td><th>Department</th><td>${r.department}</td></tr>
      </table>
      <table style="margin-top:14px">
        <thead><tr><th>Earnings</th><th class="num">Amount</th><th>Deductions</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td class="num">${formatMoney(r.salary, c)}</td>
              <td>Absent (${r.absentDays}d)</td><td class="num">${formatMoney(r.absentDeduction, c)}</td></tr>
          <tr><td>Overtime (${r.otHours.toFixed(1)}h)</td><td class="num">${formatMoney(r.otPay, c)}</td>
              <td>Half day (${r.halfDays})</td><td class="num">${formatMoney(r.halfDayDeduction, c)}</td></tr>
          <tr><td></td><td class="num"></td>
              <td>Late (${r.lateDays})</td><td class="num">${formatMoney(r.lateDeduction, c)}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Gross Earnings</td><td class="num">${formatMoney(r.salary + r.otPay, c)}</td>
              <td>Total Deductions</td><td class="num">${formatMoney(r.totalDeductions, c)}</td></tr>
        </tfoot>
      </table>
      <table style="margin-top:14px">
        <tfoot><tr><td>NET PAYABLE</td><td class="num" style="font-size:15px">${formatMoney(r.netPayable, c)}</td></tr></tfoot>
      </table>
      <div class="sign"><div>Employee Signature</div><div>Authorised Signature</div></div>
    </div>`,
    )
    .join("")

  openAndPrint("Payslips", slips)
}
