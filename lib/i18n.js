"use client"

import { useEffect, useState } from "react"

// Bilingual strings for the employee-facing screens (login + /app). Bengali is
// the default so staff who don't read English can use the app immediately.
const dict = {
  en: {
    tagline: "Attendance & Payroll",
    username: "Username",
    usernamePlaceholder: "Employee username",
    password: "Password",
    passwordPlaceholder: "Enter password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    ownerHint: "Owner: leave the username blank · Authorised personnel only",
    errIncorrect: "Incorrect username or password",

    logout: "Log out",
    checkedIn: "Checked in",
    inReview: "in review",
    since: "since",
    offsiteAwaiting: "Off-site — awaiting admin approval.",
    checkOut: "Check out",
    checkingOut: "Checking out…",
    switchProject: "Check out to switch project",
    outside: "Outside {name}",
    noGps: "We couldn't confirm your location.",
    awayDist: "You're about {distance}m away (fence is {radius}m).",
    fieldworkHelp:
      "You can still check in for approved field work — it goes to admin for review.",
    reasonPlaceholder: "Reason (e.g. client visit at Banani, material pickup)",
    cancel: "Cancel",
    submitReview: "Submit for review",
    submitting: "Submitting…",
    selectProject: "Select your project",
    noProjects: "No active projects. Ask your admin to add one.",
    checkIn: "Check in",
    gettingLocation: "Getting location…",
    checkingIn: "Checking in…",
    today: "Today",
    noSessionsToday: "No sessions yet today.",
    now: "now",
    msgCheckedIn: "Checked in ✓",
    msgSubmitted: "Submitted for admin review (off-site).",
    msgCheckedOut: "Checked out ✓",
    msgCheckoutReview: "Checked out — sent for admin review (off-site).",
    checkoutOffsiteHelp:
      "You are away from the site. Add a reason to check out — it goes to admin for review.",
    errFieldworkDisabled:
      "You're outside this site and off-site check-in is disabled here.",
    errCheckin: "Check-in failed",
    errCheckout: "Check-out failed",
    errNetwork: "Network error — try again",
    statusApproved: "Approved",
    statusPending: "In review",
    statusRejected: "Rejected",
    comingSoon: "Your check-in app is coming next",
    myMonth: "My attendance",
    present: "Present",
    late: "Late",
    absent: "Absent",
    overtime: "Overtime",
    earnedLeaveLeft: "Earned leave left",
    sickLeaveLeft: "Sick leave left",
    monthlyLeaveLeft: "Monthly leave left",
    days: "days",
    hrs: "hrs",
    notLinked: "Ask your admin to link your login to your employee record to see your stats.",
  },
  bn: {
    tagline: "উপস্থিতি ও বেতন",
    username: "ইউজারনেম",
    usernamePlaceholder: "কর্মীর ইউজারনেম",
    password: "পাসওয়ার্ড",
    passwordPlaceholder: "পাসওয়ার্ড দিন",
    signIn: "সাইন ইন",
    signingIn: "সাইন ইন হচ্ছে…",
    ownerHint: "মালিক: ইউজারনেম খালি রাখুন · শুধুমাত্র অনুমোদিত ব্যক্তি",
    errIncorrect: "ভুল ইউজারনেম বা পাসওয়ার্ড",

    logout: "লগ আউট",
    checkedIn: "চেক ইন করা আছে",
    inReview: "রিভিউতে",
    since: "থেকে",
    offsiteAwaiting: "সাইটের বাইরে — অ্যাডমিন অনুমোদনের অপেক্ষায়।",
    checkOut: "চেক আউট",
    checkingOut: "চেক আউট হচ্ছে…",
    switchProject: "প্রজেক্ট বদলাতে চেক আউট করুন",
    outside: "{name} এর বাইরে",
    noGps: "আপনার লোকেশন নিশ্চিত করা যায়নি।",
    awayDist: "আপনি প্রায় {distance} মিটার দূরে (সীমানা {radius} মিটার)।",
    fieldworkHelp:
      "অনুমোদিত ফিল্ড ওয়ার্কের জন্য এখনো চেক ইন করতে পারেন — এটি অ্যাডমিনের রিভিউতে যাবে।",
    reasonPlaceholder: "কারণ (যেমন: বনানীতে ক্লায়েন্ট ভিজিট, মালামাল আনা)",
    cancel: "বাতিল",
    submitReview: "রিভিউর জন্য জমা দিন",
    submitting: "জমা হচ্ছে…",
    selectProject: "আপনার প্রজেক্ট নির্বাচন করুন",
    noProjects: "কোনো সক্রিয় প্রজেক্ট নেই। অ্যাডমিনকে যোগ করতে বলুন।",
    checkIn: "চেক ইন",
    gettingLocation: "লোকেশন নেওয়া হচ্ছে…",
    checkingIn: "চেক ইন হচ্ছে…",
    today: "আজ",
    noSessionsToday: "আজ এখনো কোনো সেশন নেই।",
    now: "এখন",
    msgCheckedIn: "চেক ইন হয়েছে ✓",
    msgSubmitted: "অ্যাডমিন রিভিউয়ের জন্য জমা হয়েছে (সাইটের বাইরে)।",
    msgCheckedOut: "চেক আউট হয়েছে ✓",
    msgCheckoutReview: "চেক আউট হয়েছে — অ্যাডমিন রিভিউয়ের জন্য পাঠানো হয়েছে (সাইটের বাইরে)।",
    checkoutOffsiteHelp:
      "আপনি সাইট থেকে দূরে আছেন। চেক আউট করতে একটি কারণ দিন — এটি অ্যাডমিন রিভিউ করবে।",
    errFieldworkDisabled: "আপনি সাইটের বাইরে এবং এখানে বাইরে থেকে চেক ইন বন্ধ।",
    errCheckin: "চেক ইন ব্যর্থ হয়েছে",
    errCheckout: "চেক আউট ব্যর্থ হয়েছে",
    errNetwork: "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন",
    statusApproved: "অনুমোদিত",
    statusPending: "রিভিউতে",
    statusRejected: "বাতিল",
    comingSoon: "আপনার চেক-ইন অ্যাপ শীঘ্রই আসছে",
    myMonth: "আমার উপস্থিতি",
    present: "উপস্থিত",
    late: "দেরি",
    absent: "অনুপস্থিত",
    overtime: "ওভারটাইম",
    earnedLeaveLeft: "অর্জিত ছুটি বাকি",
    sickLeaveLeft: "অসুস্থতা ছুটি বাকি",
    monthlyLeaveLeft: "মাসিক ছুটি বাকি",
    days: "দিন",
    hrs: "ঘণ্টা",
    notLinked: "আপনার স্ট্যাটাস দেখতে লগইনটি কর্মী রেকর্ডের সাথে যুক্ত করতে অ্যাডমিনকে বলুন।",
  },
}

export function useLang() {
  const [lang, setLangState] = useState("bn")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gt_lang")
      if (saved === "en" || saved === "bn") setLangState(saved)
    } catch {}
  }, [])

  const setLang = (l) => {
    setLangState(l)
    try {
      localStorage.setItem("gt_lang", l)
    } catch {}
  }

  const t = (key, vars) => {
    let s = (dict[lang] && dict[lang][key]) ?? dict.en[key] ?? key
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k])
    return s
  }

  return { lang, setLang, t }
}

export function LangToggle({ lang, setLang, className = "" }) {
  return (
    <div
      className={`inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800 ${className}`}
    >
      {[
        ["en", "EN"],
        ["bn", "বাংলা"],
      ].map(([v, label]) => (
        <button
          key={v}
          onClick={() => setLang(v)}
          className={`rounded-md px-2.5 py-1 transition ${
            lang === v
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
