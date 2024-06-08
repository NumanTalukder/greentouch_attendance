"use client"

import AttendanceSummary from "./AttendanceSummary"
import { useState } from "react"
import DetailAttendance from "./DetailAttendance"
import { parseInputData } from "@/lib"

// JSX function to display the parsed data
function ExtractData() {
  const [inputData, setInputData] = useState("")
  const [data, setData] = useState([])
  const [tab, setTab] = useState("detail")

  // Handle textarea input changes and update parsed data
  const handleTextareaChange = (event) => {
    const newData = event.target.value
    setInputData(newData)
    const parsed = parseInputData(newData)
    setData(parsed)
  }

  return (
    <div className="flex flex-col items-center px-4 md:px-20">
      <h2 className="text-4xl font-semibold my-5">Attendance Data</h2>
      <textarea
        className="w-full h-[200px] p-4 text-md border border-dashed rounded-xl"
        value={inputData}
        onChange={handleTextareaChange}
        placeholder="Paste your data here"
      />

      <h1 className="text-3xl my-3">Attendance</h1>

      <div className="flex border border-gray-300 rounded-md mb-2">
        <button
          className={`py-2 px-2  transition duration-300 ${
            tab === "detail"
              ? "bg-green-500 text-black"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          onClick={() => setTab("detail")}
        >
          Detail
        </button>
        <button
          className={`py-2 px-2  transition duration-300 ${
            tab === "summary"
              ? "bg-green-500 text-black"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
          onClick={() => setTab("summary")}
        >
          Summary
        </button>
      </div>

      {tab === "detail" ? (
        <DetailAttendance data={data} />
      ) : (
        <AttendanceSummary data={data} />
      )}
    </div>
  )
}

export default ExtractData
