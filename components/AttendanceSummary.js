"use client"

import { useState } from "react"
import { useEmployees } from "@/lib/useEmployees"
import PrintModal from "@/components/modal/PrintModal"

export default function AttendanceSummary({ data }) {
  const { employees } = useEmployees()

  const [sorting, setSorting] = useState({
    field: "id",
    order: "asc",
  })

  const [showPrint, setShowPrint] = useState(false)

  // ---------------- 5AM RULE ----------------
  const getWorkDate = (date, time) => {
    const dt = new Date(`${date}T${time}`)
    const five = new Date(dt)
    five.setHours(5, 0, 0, 0)

    if (dt < five) dt.setDate(dt.getDate() - 1)

    return dt.toISOString().split("T")[0]
  }

  // ---------------- TIME HELPERS ----------------
  const isAfter9AM = (t) =>
    new Date(`2000-01-01T${t}`) > new Date(`2000-01-01T09:10:59`)

  const isAfter11AM = (t) =>
    new Date(`2000-01-01T${t}`) > new Date(`2000-01-01T11:00:59`)

  const isBefore7PM = (t) =>
    new Date(`2000-01-01T${t}`) < new Date(`2000-01-01T19:00:00`)

  const isAfter8PM = (t) =>
    new Date(`2000-01-01T${t}`) > new Date(`2000-01-01T20:00:00`)

  const minutesDiff = (s, e) =>
    Math.round(
      (new Date(`2000-01-01T${e}`) - new Date(`2000-01-01T${s}`)) / 60000,
    )

  const overtime = (t) => {
    const d = new Date(`2000-01-01T${t}`)
    const seven = new Date(`2000-01-01T19:00:00`)
    return d > seven ? Math.floor((d - seven) / 60000) : 0
  }

  const format = (m) => {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}:${mm.toString().padStart(2, "0")}`
  }

  // ---------------- GROUP DATA ----------------
  const grouped = data.reduce((acc, item) => {
    const workDate = getWorkDate(item.date, item.checkout)
    const key = `${item.id}-${workDate}`

    if (!acc[key]) {
      acc[key] = {
        id: item.id,
        name: employees[item.id] || "Unknown",
        date: workDate,
        first: item.checkout,
        last: item.checkout,
      }
    } else {
      if (item.checkout < acc[key].first) acc[key].first = item.checkout
      if (item.checkout > acc[key].last) acc[key].last = item.checkout
    }

    return acc
  }, {})

  const rows = Object.values(grouped)

  // ---------------- SUMMARY ----------------
  const summary = rows.reduce((acc, item) => {
    if (!acc[item.id]) {
      acc[item.id] = {
        id: item.id,
        name: item.name,
        totalMin: 0,
        late: 0,
        halfDay: 0, // ✅ FIXED
        days: new Set(),
        before7: 0,
        after8: 0,
        ot: 0,
      }
    }

    acc[item.id].totalMin += minutesDiff(item.first, item.last)

    // ✅ CORRECT ORDER (IMPORTANT)
    if (isAfter11AM(item.first)) {
      acc[item.id].halfDay++
    } else if (isAfter9AM(item.first)) {
      acc[item.id].late++
    }

    if (isBefore7PM(item.last)) acc[item.id].before7++

    if (isAfter8PM(item.last)) {
      acc[item.id].after8++
      acc[item.id].ot += overtime(item.last)
    }

    acc[item.id].days.add(item.date)

    return acc
  }, {})

  Object.values(summary).forEach((i) => (i.days = i.days.size))

  const finalData = Object.values(summary).map((i) => ({
    ...i,
    totalHours: format(i.totalMin),
    overtime: format(i.ot),
  }))

  // ---------------- SORT ----------------
  const sorted = [...finalData].sort((a, b) => {
    const order = sorting.order === "asc" ? 1 : -1
    return a[sorting.field] < b[sorting.field]
      ? -1 * order
      : a[sorting.field] > b[sorting.field]
        ? 1 * order
        : 0
  })

  // ---------------- PRINT ----------------
  const handlePrint = (ids) => {
    const filtered = finalData.filter((i) => ids.includes(i.id))

    const html = `
      <html>
      <head>
        <title>Attendance Report</title>
        <style>
          table { width:100%; border-collapse: collapse; }
          th, td { border:1px solid #000; padding:6px; text-align:center; }
          th { background:#eee; }
        </style>
      </head>
      <body>
        <h2>Attendance Report</h2>
        <table>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Total Hours</th>
            <th>Days</th>
            <th>Late</th>
            <th>Half Day</th>
            <th>Before 7PM</th>
            <th>After 8PM</th>
            <th>Overtime</th>
          </tr>
          ${filtered
            .map(
              (i) => `
            <tr>
              <td>${i.id}</td>
              <td>${i.name}</td>
              <td>${i.totalHours}</td>
              <td>${i.days}</td>
              <td>${i.late}</td>
              <td>${i.halfDay}</td>
              <td>${i.before7}</td>
              <td>${i.after8}</td>
              <td>${i.overtime}</td>
            </tr>`,
            )
            .join("")}
        </table>
      </body>
      </html>
    `

    const w = window.open("", "", "width=900,height=600")
    w.document.write(html)
    w.document.close()
    w.print()
  }

  // ---------------- UI ----------------
  return (
    <main className="p-6 w-full max-w-none">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold">Attendance Summary</h1>

        <button
          onClick={() => setShowPrint(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Print
        </button>
      </div>

      <div className="w-full overflow-x-auto border rounded-lg shadow">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Total Hours</th>
              <th className="p-2 border">Days</th>
              <th className="p-2 border">Late</th>
              <th className="p-2 border">Half Day</th>
              <th className="p-2 border">Before 7PM</th>
              <th className="p-2 border">After 8PM</th>
              <th className="p-2 border">Overtime</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="p-2 border">{i.id}</td>
                <td className="p-2 border">{i.name}</td>
                <td className="p-2 border">{i.totalHours}</td>
                <td className="p-2 border">{i.days}</td>
                <td className="p-2 border">{i.late}</td>
                <td className="p-2 border">{i.halfDay}</td>
                <td className="p-2 border">{i.before7}</td>
                <td className="p-2 border">{i.after8}</td>
                <td className="p-2 border">{i.overtime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPrint && (
        <PrintModal
          data={finalData}
          onClose={() => setShowPrint(false)}
          onPrint={handlePrint}
        />
      )}
    </main>
  )
}
