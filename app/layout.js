import "./globals.css"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "GreenTouch · Attendance & Payroll",
  description:
    "Paste raw ZKTeco machine logs and instantly get attendance, overtime and payroll — dashboard, daily, summary and payslips.",
}

// Apply the saved theme before paint to avoid a flash of the wrong colors.
const themeScript = `
try {
  var t = localStorage.getItem('gt_theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
