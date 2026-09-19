/** @type {import('next').NextConfig} */

// Keep the dev cache and the production build in SEPARATE folders so that
// running `next build` (or a second process) can never corrupt a running
// `next dev` server — a recurring "__webpack_modules__ is not a function"
// crash we hit when both shared one dir.
//   next dev   → NODE_ENV=development → .next   (dev/HMR cache)
//   next build → NODE_ENV=production  → build   (deploy output; unchanged)
//   next start → NODE_ENV=production  → build   (reads what build wrote)
const isProd = process.env.NODE_ENV === "production"

const nextConfig = {
  distDir: isProd ? "build" : ".next",
}

module.exports = nextConfig
