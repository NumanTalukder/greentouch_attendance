import { useState } from "react"
import { idToNameMap } from "@/constant/idToNameMap"
import {
  formatTime12Hour,
  calculateTime,
  calculateTotalOfficeHours,
  isAfter9AM,
} from "@/lib"

export default function AttendanceSummary({ data }) {
  const [sorting, setSorting] = useState({ field: "date", order: "asc" })
  const [nameFilter, setNameFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")

  // Preprocess the data to get the first and last checkout data for each id for each day
  const processedData = data.reduce((result, item) => {
    const key = `${item.id}-${item.date}`
    if (!result[key]) {
      result[key] = {
        id: item.id,
        name: idToNameMap[item.id], // Get the name based on id
        date: item.date,
        firstCheckout: item.checkout,
        lastCheckout: item.checkout,
      }
    } else {
      const existingItem = result[key]
      if (item.checkout < existingItem.firstCheckout) {
        existingItem.firstCheckout = item.checkout
      }
      if (item.checkout > existingItem.lastCheckout) {
        existingItem.lastCheckout = item.checkout
      }
    }
    return result
  }, {})

  const processedArray = Object.values(processedData)

  // Aggregate data to calculate total office hours, late check-ins, and attendance days
  const aggregateData = processedArray.reduce((result, item) => {
    if (!result[item.id]) {
      result[item.id] = {
        name: item.name,
        totalOfficeHours: 0,
        lateCheckIns: 0,
        attendanceDays: new Set(), // Use Set to track unique dates
      }
    }

    result[item.id].totalOfficeHours += calculateTotalOfficeHours(
      item.firstCheckout,
      item.lastCheckout
    )
    if (isAfter9AM(item.firstCheckout)) {
      result[item.id].lateCheckIns += 1
    }
    result[item.id].attendanceDays.add(item.date) // Add the date to the set

    return result
  }, {})

  // Convert Set to array of unique dates and count the length
  Object.values(aggregateData).forEach((item) => {
    item.attendanceDays = Array.from(item.attendanceDays).length
  })

  const aggregateArray = Object.entries(aggregateData).map(([id, data]) => ({
    id,
    ...data,
    totalOfficeHours: `${Math.floor(data.totalOfficeHours / 60)} hours ${
      data.totalOfficeHours % 60
    } minutes`,
  }))

  // Sorting function
  const sortedArray = [...aggregateArray].sort((a, b) => {
    const fieldA = a[sorting.field]
    const fieldB = b[sorting.field]
    const order = sorting.order === "asc" ? 1 : -1

    if (fieldA < fieldB) {
      return -1 * order
    }
    if (fieldA > fieldB) {
      return 1 * order
    }
    return 0
  })

  // Filtering function
  const filteredArray = sortedArray.filter(
    (item) =>
      (nameFilter === "" ||
        item.name.toLowerCase().includes(nameFilter.toLowerCase())) &&
      (dateFilter === "" || item.date.includes(dateFilter))
  )

  return (
    <main className="flex flex-col items-center justify-center">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() =>
                setSorting({
                  field: "id",
                  order:
                    sorting.field === "id"
                      ? sorting.order === "asc"
                        ? "desc"
                        : "asc"
                      : "asc",
                })
              }
            >
              ID
              {sorting.field === "id" && (
                <span
                  className={`ml-1 ${
                    sorting.order === "asc" ? "rotate-180" : ""
                  } inline-block`}
                >
                  ▲
                </span>
              )}
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() =>
                setSorting({
                  field: "name",
                  order:
                    sorting.field === "name"
                      ? sorting.order === "asc"
                        ? "desc"
                        : "asc"
                      : "asc",
                })
              }
            >
              Name
              {sorting.field === "name" && (
                <span
                  className={`ml-1 ${
                    sorting.order === "asc" ? "rotate-180" : ""
                  } inline-block`}
                >
                  ▲
                </span>
              )}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Office Hours
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Late Check-Ins (After 9:05 AM)
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Attendance Days
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredArray.map((item, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">{item.id}</td>
              <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                {item.totalOfficeHours}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {item.lateCheckIns}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {item.attendanceDays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
