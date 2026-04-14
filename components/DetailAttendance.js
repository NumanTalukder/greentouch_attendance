"use client"

import { useState } from "react"
import EmployeesModal from "@/components/modal/EmployeesModal"
import { useEmployees } from "@/lib/useEmployees"

// Format time
const formatTime12Hour = (time) => {
  const parsed = new Date(`2000-01-01T${time}`)
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

// Calculate duration
const calculateTime = (start, end) => {
  const s = new Date(`2000-01-01T${start}`)
  const e = new Date(`2000-01-01T${end}`)

  const diff = e - s
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)

  return `${h}h ${m}m`
}

export default function Home({ data = [] }) {
  const { employees, saveEmployees } = useEmployees()

  const [sorting, setSorting] = useState({
    field: "date",
    order: "asc",
  })

  const [showEmployees, setShowEmployees] = useState(false)

  // Process data
  const processedData = data.reduce((result, item) => {
    const key = `${item.id}-${item.date}`

    if (!result[key]) {
      result[key] = {
        id: item.id,
        name: employees[item.id] || "Unknown",
        date: item.date,
        firstCheckout: item.checkout,
        lastCheckout: item.checkout,
      }
    } else {
      if (item.checkout < result[key].firstCheckout) {
        result[key].firstCheckout = item.checkout
      }
      if (item.checkout > result[key].lastCheckout) {
        result[key].lastCheckout = item.checkout
      }
    }

    return result
  }, {})

  const processedArray = Object.values(processedData)

  // Sorting
  const sortedArray = [...processedArray].sort((a, b) => {
    const order = sorting.order === "asc" ? 1 : -1

    if (a[sorting.field] < b[sorting.field]) return -1 * order
    if (a[sorting.field] > b[sorting.field]) return 1 * order
    return 0
  })

  return (
    <main className="p-6 flex flex-col items-center w-full">
      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between mb-4">
        <h1 className="text-xl font-semibold">Attendance</h1>

        <button
          onClick={() => setShowEmployees(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Employees
        </button>
      </div>

      {/* Table */}
      <table className="min-w-full max-w-5xl divide-y divide-gray-200 border">
        <thead>
          <tr>
            <th
              className="border"
              onClick={() =>
                setSorting({
                  field: "id",
                  order:
                    sorting.field === "id" && sorting.order === "asc"
                      ? "desc"
                      : "asc",
                })
              }
            >
              ID
            </th>

            <th className="border">Name</th>

            <th className="border">Date</th>
            <th className="border">First</th>
            <th className="border">Last</th>
            <th className="border">Work</th>
          </tr>
        </thead>

        <tbody>
          {sortedArray.map((item, i) => (
            <tr key={i} className="border-t">
              <td className="border">{item.id}</td>
              <td className="border">{item.name}</td>
              <td className="border">{item.date}</td>
              <td className="border">{formatTime12Hour(item.firstCheckout)}</td>
              <td className="border">{formatTime12Hour(item.lastCheckout)}</td>
              <td className="border">
                {calculateTime(item.firstCheckout, item.lastCheckout)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {showEmployees && (
        <EmployeesModal
          employees={employees}
          saveEmployees={saveEmployees}
          onClose={() => setShowEmployees(false)}
        />
      )}
    </main>
  )
}
