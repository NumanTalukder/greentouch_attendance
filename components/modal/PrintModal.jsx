"use client"

import { useState } from "react"

export default function PrintModal({ data, onClose, onPrint }) {
  const [selectedIds, setSelectedIds] = useState([])

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Select Employees</h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="max-h-[300px] overflow-y-auto border rounded p-2">
          {data.map((item) => (
            <label key={item.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onPrint(selectedIds)}
            className="bg-green-600 text-white px-3 py-2 rounded flex-1"
          >
            Print
          </button>

          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-3 py-2 rounded flex-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
