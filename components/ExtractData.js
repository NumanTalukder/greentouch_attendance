'use client'

import DataTable from './DataTable'
import { useState } from 'react'

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: '20px',
}

const textareaStyle = {
  width: '100%',
  height: '200px',
  padding: '10px',
  fontSize: '16px',
}

const dataStyle = {
  width: '100%',
  margin: '10px 0',
  padding: '10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
}

// Function to parse the input data into an array of objects
const parseInputData = (input) => {
  const lines = input.split('\n')
  const data = lines
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        const id = parseInt(parts[0])
        const date = parts[1]
        const checkout = parts.slice(2).slice(0, 1).join(' ') // Keep only the time part
        return { id, date, checkout }
      }
      return null // Invalid line
    })
    .filter(Boolean)

  return data
}

// JSX function to display the parsed data
function ExtractData() {
  const [inputData, setInputData] = useState('')
  const [data, setData] = useState([])

  // Handle textarea input changes and update parsed data
  const handleTextareaChange = (event) => {
    const newData = event.target.value
    setInputData(newData)
    const parsed = parseInputData(newData)
    setData(parsed)
  }

  return (
    <div style={containerStyle}>
      <h2>Attendance Data</h2>
      <textarea
        style={textareaStyle}
        value={inputData}
        onChange={handleTextareaChange}
        placeholder='Paste your data here'
      />
      {/* {data.length > 0 && (
        <div style={dataStyle}>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )} */}
      <DataTable data={data} />
    </div>
  )
}

export default ExtractData
