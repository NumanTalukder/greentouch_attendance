'use client'

import { data } from '@/constant/data'
import { useState } from 'react'

// Assuming you have a data structure that maps id to names
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

// Function to format time in 12-hour format
const formatTime12Hour = (time) => {
  const parsedTime = new Date(`2000-01-01T${time}`)
  return parsedTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function Home() {
  const [sorting, setSorting] = useState({ field: 'date', order: 'asc' })
  const [nameFilter, setNameFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

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

  return (
    <main className='flex flex-col items-center justify-center'>
      <h1 className='text-3xl my-3'>Attendance</h1>

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
