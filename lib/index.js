// Function to format time in 12-hour format
export const formatTime12Hour = (time) => {
  const parsedTime = new Date(`2000-01-01T${time}`)
  return parsedTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

// Function to calculate time difference
export const calculateTime = (startTime, endTime) => {
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  const timeDiff = end - start
  const hours = Math.floor(timeDiff / 3600000)
  const minutes = Math.floor((timeDiff % 3600000) / 60000)
  return `${hours} hours ${minutes} minutes`
}

// Function to calculate total office hours in minutes
export const calculateTotalOfficeHours = (startTime, endTime) => {
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  return (end - start) / 60000 // return in minutes
}

// Function to check if check-in time is after 9 AM
export const isAfter9AM = (time) => {
  const checkInTime = new Date(`2000-01-01T${time}`)
  const nineAM = new Date(`2000-01-01T09:05:59`)
  return checkInTime > nineAM
}

// Function to parse the input data into an array of objects
export const parseInputData = (input) => {
  const lines = input.split("\n")
  const data = lines
    .map((line) => {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3) {
        const id = parseInt(parts[0])
        const date = parts[1]
        const checkout = parts.slice(2).slice(0, 1).join(" ") // Keep only the time part
        return { id, date, checkout }
      }
      return null // Invalid line
    })
    .filter(Boolean)

  return data
}
