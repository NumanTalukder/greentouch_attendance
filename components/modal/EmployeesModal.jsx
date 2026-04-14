"use client"

import { useState } from "react"

export default function EmployeesModal({ employees, saveEmployees, onClose }) {
  const [newId, setNewId] = useState("")
  const [newName, setNewName] = useState("")

  const handleAdd = () => {
    if (!newId.trim()) {
      alert("ID is required")
      return
    }

    if (employees[newId]) {
      alert("ID already exists")
      return
    }

    saveEmployees({
      ...employees,
      [newId]: newName || "Unnamed",
    })

    setNewId("")
    setNewName("")
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg w-[420px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Manage Employees</h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Existing Employees */}
        <div className="max-h-[250px] overflow-y-auto pr-1">
          {Object.entries(employees).map(([id, name]) => (
            <div key={id} className="flex gap-2 mb-2 items-center">
              <span className="w-12 text-sm text-gray-500">{id}</span>

              <input
                value={name}
                onChange={(e) => {
                  const updated = {
                    ...employees,
                    [id]: e.target.value,
                  }
                  saveEmployees(updated)
                }}
                className="border px-2 py-1 flex-1 rounded"
              />

              <button
                onClick={() => {
                  const updated = { ...employees }
                  delete updated[id]
                  saveEmployees(updated)
                }}
                className="text-red-500 font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add New Employee */}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold mb-2">Add New Employee</h3>

          <div className="flex gap-2 mb-2">
            <input
              placeholder="ID"
              value={newId}
              onChange={
                (e) => setNewId(e.target.value.replace(/\D/g, "")) // only numbers
              }
              className="border px-2 py-1 w-24 rounded"
            />

            <input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="border px-2 py-1 flex-1 rounded"
            />
          </div>

          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
          >
            Add Employee
          </button>
        </div>

        {/* Bottom Close Button */}
        <button
          onClick={onClose}
          className="mt-5 w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  )
}
