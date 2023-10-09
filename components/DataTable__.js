'use client'

import { useState } from 'react'

export default function Home() {
  const [textInput, setTextInput] = useState('')
  const [jsonData, setJsonData] = useState([])
  const [sorting, setSorting] = useState({ field: 'date', order: 'asc' })
  const [nameFilter, setNameFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const idToNameMap = {
    1: 'Root',
    2: 'Numan Talukder',
    3: 'Abul Hossain',
    4: 'Alamgir Hossain',
    5: 'Md. Fariduzzaman',
    6: 'Jahan Talukder',
    7: 'Jisan Talukder',
    8: 'Maksud Alam Bhuiyan',
    9: 'Sabbir Alam Bhuiyan',
    11: 'Abul Kalam',
    12: 'Rajib Talukder',
    13: 'Masud Farvez Rony',
    14: 'Md Tajuddin Talukder',
    15: 'Md Saiful Islam',
    17: 'Shakhawat Hossain',
    18: 'Md Raeduzzaman',
    19: 'Harunur Rashid',
    20: 'Sharif Audit',
    21: 'Sumiya Amin Sharmeen',
    // Add more id-to-name mappings as needed
  }

  // Function to convert tab-separated input to JSON
  const convertToJSON = () => {
    const lines = textInput.split('\n')
    const jsonOutput = []

    for (const line of lines) {
      const [id, dateTime, ...checkout] = line.split('\t')
      const [date, time] = dateTime.split(' ')

      const entry = {
        id: parseInt(id),
        date,
      }

      if (checkout.length > 0) {
        entry.checkout = time
      } else {
        entry.checkin = time
      }

      jsonOutput.push(entry)
    }

    setJsonData(jsonOutput)
  }

  // Preprocess the data to get the first and last checkout data for each id for each day
  const processedData = jsonData.reduce((result, item) => {
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

  // Function to format time in 12-hour format
  const formatTime12Hour = (time) => {
    const parsedTime = new Date(`2000-01-01T${time}`)
    return parsedTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Sorting function
  const sortedArray = [...processedArray].sort((a, b) => {
    const fieldA = a[sorting.field]
    const fieldB = b[sorting.field]
    const order = sorting.order === 'asc' ? 1 : -1

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
      (nameFilter === '' ||
        item.name.toLowerCase().includes(nameFilter.toLowerCase())) &&
      (dateFilter === '' || item.date.includes(dateFilter))
  )

  // Calculate first and last checkout times for each ID for each day
  const calculateFirstLastCheckouts = (data) => {
    const idToDateToCheckouts = {}

    data.forEach((item) => {
      const { id, date, checkout } = item
      if (!idToDateToCheckouts[id]) {
        idToDateToCheckouts[id] = {}
      }
      if (!idToDateToCheckouts[id][date]) {
        idToDateToCheckouts[id][date] = {
          firstCheckout: checkout,
          lastCheckout: checkout,
        }
      } else {
        if (checkout < idToDateToCheckouts[id][date].firstCheckout) {
          idToDateToCheckouts[id][date].firstCheckout = checkout
        }
        if (checkout > idToDateToCheckouts[id][date].lastCheckout) {
          idToDateToCheckouts[id][date].lastCheckout = checkout
        }
      }
    })

    return idToDateToCheckouts
  }

  const idToDateToCheckouts = calculateFirstLastCheckouts(jsonData)

  return (
    <main className='flex flex-col items-center justify-center'>
      <h1 className='text-3xl my-3'>Attendance</h1>

      <div className='mb-4'>
        <input
          type='text'
          placeholder='Filter by name'
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className='px-3 py-1 border rounded'
        />
      </div>

      <div className='mb-4'>
        <input
          type='text'
          placeholder='Filter by date'
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className='px-3 py-1 border rounded'
        />
      </div>

      <table className='min-w-full divide-y divide-gray-200'>
        <thead>
          <tr>
            <th
              className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer'
              onClick={() =>
                setSorting({
                  field: 'id',
                  order:
                    sorting.field === 'id'
                      ? sorting.order === 'asc'
                        ? 'desc'
                        : 'asc'
                      : 'asc',
                })
              }
            >
              ID
              {sorting.field === 'id' && (
                <span
                  className={`ml-1 ${
                    sorting.order === 'asc' ? 'rotate-180' : ''
                  } inline-block`}
                >
                  ▲
                </span>
              )}
            </th>
            <th
              className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer'
              onClick={() =>
                setSorting({
                  field: 'name',
                  order:
                    sorting.field === 'name'
                      ? sorting.order === 'asc'
                        ? 'desc'
                        : 'asc'
                      : 'asc',
                })
              }
            >
              Name
              {sorting.field === 'name' && (
                <span
                  className={`ml-1 ${
                    sorting.order === 'asc' ? 'rotate-180' : ''
                  } inline-block`}
                >
                  ▲
                </span>
              )}
            </th>
            <th
              className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer'
              onClick={() =>
                setSorting({
                  field: 'date',
                  order:
                    sorting.field === 'date'
                      ? sorting.order === 'asc'
                        ? 'desc'
                        : 'asc'
                      : 'asc',
                })
              }
            >
              Date
              {sorting.field === 'date' && (
                <span
                  className={`ml-1 ${
                    sorting.order === 'asc' ? 'rotate-180' : ''
                  } inline-block`}
                >
                  ▲
                </span>
              )}
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              First Checkout
            </th>
            <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
              Last Checkout
            </th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {filteredArray.map((item, index) => (
            <tr key={index}>
              <td className='px-6 py-4 whitespace-nowrap'>{item.id}</td>
              <td className='px-6 py-4 whitespace-nowrap'>{item.name}</td>
              <td className='px-6 py-4 whitespace-nowrap'>{item.date}</td>
              <td className='px-6 py-4 whitespace-nowrap'>
                {formatTime12Hour(item.firstCheckout)}
              </td>
              <td className='px-6 py-4 whitespace-nowrap'>
                {formatTime12Hour(item.lastCheckout)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
