// app/dashboard/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Swimmer } from "@/types"
import Footer from "@/components/footer"
import { User, Users, Plus, LogOut, Settings, Waves, MoreHorizontal, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

// 会员：状态计算与工具
import {
  computeStatus,
  computeStatusWithPause,
  computeBadgeStatus,
  inRenewWindowWithPause,
  getEffectiveNowForMembership,
  fmt,
  diffInDays,
} from "@/lib/membership"
import type { ParentTuitionView } from "@/lib/tuition-v2/parent-tuition"
import type { ParentMeetCard } from "@/lib/meets/parent-view"
import { PnsMeetLink } from "@/components/pns-meet-link"

type SwimmerWithMakeup = Swimmer & {
  nextMakeupText?: string
  nextMakeupId?: string

  // 会员相关字段（从 swimmers 文档读取）
  nextDueDate?: FBTimestamp
  currentPeriodStart?: FBTimestamp
  currentPeriodEnd?: FBTimestamp
  registrationAnchorDate?: FBTimestamp

  // 新增：控制 UI 行为
  isFrozen?: boolean        // 被俱乐部冻结
  membershipPaused?: boolean
  membershipPausedAt?: string | FBTimestamp
  paymentStatus?: string    // ✅ 读取 swimmers.paymentStatus：'pending' | 'paid' | null/undefined
  tuition?: ParentTuitionView | null
  usaSwimmingId?: string
}

// ---------------- Firestore Timestamp 兼容 ----------------
type FBTimestamp = { toDate: () => Date } | Date | null | undefined
function tsToDate(v: FBTimestamp): Date | undefined {
  if (!v) return undefined
  // @ts-expect-error - Firestore Timestamp compatibility
  if (typeof v?.toDate === "function") return (v as { toDate: () => Date }).toDate()
  return v as Date
}

// ---------------- 日期 & 字符串工具 ----------------
function parseIsoSafe(s?: string | null): Date | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t) : null
}

function formatRegisteredOn(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") {
    const d = parseIsoSafe(value)
    return d ? d.toLocaleDateString() : null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value > 1e12 ? value : value * 1000)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString()
  }
  if (typeof value === "object" && value !== null) {
    const v = value as { seconds?: number; toDate?: () => Date }
    if (typeof v.toDate === "function") {
      const d = v.toDate()
      return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : null
    }
    if (typeof v.seconds === "number") {
      const d = new Date(v.seconds * 1000)
      return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString()
    }
  }
  return null
}
export default function DashboardPage() {
  const router = useRouter()
  const [parentEmail, setParentEmail] = useState<string>("")
  const [swimmers, setSwimmers] = useState<SwimmerWithMakeup[]>([])
  const [loading, setLoading] = useState(true)

  // Renew busy
  const [renewBusyMap] = useState<Record<string, boolean>>({})

  // 每个 swimmer 是否存在未完成付款（payments.status = 'pending'）
  const [pendingMap, setPendingMap] = useState<Record<string, { paymentId: string }>>({})
  const [meetsBySwimmer, setMeetsBySwimmer] = useState<Record<string, ParentMeetCard[]>>({})
  const [meetPayments, setMeetPayments] = useState<ParentMeetCard[]>([])
  const [omrUrl, setOmrUrl] = useState("")
  const [usaIdDraft, setUsaIdDraft] = useState<Record<string, string>>({})
  const [meetBusy, setMeetBusy] = useState("")

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      window.location.href = "/login"
    }
  }

  const handleDeleteSwimmer = async (swimmerId: string) => {
    if (!confirm("Are you sure you want to delete this swimmer?")) return
    try {
      const u = auth.currentUser
      if (!u) throw new Error("Not signed in")
      const idToken = await u.getIdToken(true)
      const res = await fetch(`/api/dashboard/swimmers/${encodeURIComponent(swimmerId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Delete failed")

      // local optimistic update
      setSwimmers((prev) => prev.filter((s) => s.id !== swimmerId))
    } catch (error) {
      console.error("Failed to delete swimmer:", error)
      alert("Failed to delete swimmer. Please try again.")
    }
  }

  // 登录 + 获取 dashboard 数据（通过 API，避免 Firestore rules 导致的权限错误）
  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null

    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login"
        return
      }
      setParentEmail(user.email || "")

      try {
        setLoading(true)
        const idToken = await user.getIdToken(true)
        const res = await fetch("/api/dashboard/swimmers", {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Load swimmers failed")
        const loaded = (data.swimmers || []) as SwimmerWithMakeup[]
        setSwimmers(loaded)
        setUsaIdDraft(Object.fromEntries(loaded.map((s) => [s.id, s.usaSwimmingId || ""])))
        setPendingMap((data.pendingMap || {}) as Record<string, { paymentId: string }>)
        try {
          const meetRes = await fetch("/api/meets/dashboard", {
            headers: { Authorization: `Bearer ${idToken}` },
          })
          const meetJson = await meetRes.json()
          if (meetRes.ok && meetJson?.ok) {
            setMeetsBySwimmer(meetJson.meetsBySwimmer || {})
            setMeetPayments(meetJson.payments || [])
            setOmrUrl(meetJson.settings?.usaSwimmingOmrUrl || "")
          }
        } catch (meetErr) {
          console.error("Load dashboard meets failed:", meetErr)
        }
      } catch (e) {
        console.error("Load dashboard swimmers failed:", e)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth?.()
    }
  }, [])

  const saveUsaSwimmingId = async (swimmerId: string) => {
    try {
      setMeetBusy(`usa-${swimmerId}`)
      const u = auth.currentUser
      if (!u) throw new Error("Not signed in")
      const idToken = await u.getIdToken(true)
      const res = await fetch("/api/meets/usa-swimming-id", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ swimmerId, usaSwimmingId: usaIdDraft[swimmerId] || "" }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Could not save USA Swimming ID")
      setSwimmers((prev) =>
        prev.map((s) => (s.id === swimmerId ? { ...s, usaSwimmingId: json.swimmer.usaSwimmingId } : s))
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save USA Swimming ID")
    } finally {
      setMeetBusy("")
    }
  }

  const reportMeetPayment = async (meetId: string, swimmerId: string) => {
    try {
      setMeetBusy(`pay-${meetId}-${swimmerId}`)
      const u = auth.currentUser
      if (!u) throw new Error("Not signed in")
      const idToken = await u.getIdToken(true)
      const res = await fetch(`/api/meets/${meetId}/payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ swimmerId }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Could not report payment")
      const patch = (card: ParentMeetCard) =>
        card.meetId === meetId && card.swimmerId === swimmerId
          ? { ...card, paymentStatus: "payment_reported" as const }
          : card
      setMeetPayments((prev) => prev.map(patch))
      setMeetsBySwimmer((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, cards]) => [id, cards.map(patch)]))
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not report payment")
    } finally {
      setMeetBusy("")
    }
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // ✅ Renew：只负责跳转到 renew 页面，不创建 payment
  const handleRenew = (swimmer: SwimmerWithMakeup) => {
    router.push(`/renew/${swimmer.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 text-lg">
        Loading your dashboard...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/images/psa-logo.png"
                alt="Prime Swim Academy Logo"
                width={50}
                height={50}
                className="rounded-full"
              />
              <div>
                <span className="text-lg font-bold text-slate-800">Prime Swim Academy</span>
                <p className="text-sm text-slate-600">Parent Dashboard</p>
              </div>
            </Link>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{parentEmail}</p>
                </div>
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 bg-transparent"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome back!</h1>
          <p className="text-slate-600">Manage your swimmers and stay updated with their progress.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Register New Swimmer</CardTitle>
              <CardDescription className="text-slate-600">Add another child to your account</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/register">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                  Start Registration
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">My Swimmers</CardTitle>
              <CardDescription className="text-slate-600">
                {swimmers.length} active swimmer{swimmers.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button
                onClick={() => document.getElementById("swimmers-section")?.scrollIntoView({ behavior: "smooth" })}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50 rounded-full px-6"
              >
                View Details
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Account Settings</CardTitle>
              <CardDescription className="text-slate-600">Update your profile and preferences</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/account">
                <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50 rounded-full px-6 bg-transparent">
                  Manage Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Swimmers Section */}
        <div id="swimmers-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">My Swimmers</h2>
            <Link href="/register">
              <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Swimmer
              </Button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {swimmers.map((swimmer) => {

              // —— 会员状态计算 —— //
              const hasPending = !!pendingMap[swimmer.id]
              const isFrozen = !!swimmer.isFrozen
              const isMembershipPaused = !!swimmer.membershipPaused
              const membershipPausedAt = swimmer.membershipPausedAt
                ? (typeof swimmer.membershipPausedAt === "string"
                    ? parseIsoSafe(swimmer.membershipPausedAt)
                    : tsToDate(swimmer.membershipPausedAt))
                : null
              const pauseState = {
                membershipPaused: isMembershipPaused,
                membershipPausedAt: membershipPausedAt ?? null,
              }
              const paymentStatus = swimmer.paymentStatus
              const isPaid = paymentStatus === 'paid'
              
              // 判断是否有待确认的付款（paymentStatus='pending' 或 payments 集合中有 pending 记录）
              // 但如果 paymentStatus 已经是 'paid'，说明管理员已经确认了，不应该显示 pending
              const isPaymentPending = paymentStatus === 'pending'
              const hasPendingPayment = paymentStatus !== 'paid' && (isPaymentPending || hasPending)
              
              const nextDue = swimmer.nextDueDate 
                ? (typeof swimmer.nextDueDate === "string" 
                    ? parseIsoSafe(swimmer.nextDueDate) 
                    : tsToDate(swimmer.nextDueDate))
                : null
              const baseStatus = computeStatusWithPause({ nextDueDate: nextDue }, pauseState)
              const effectiveNow = getEffectiveNowForMembership(pauseState)
              
              // 判断是否是老 swimmer（有会员期）
              const hasMembershipPeriod = !!nextDue

              // 优先级：frozen > 新注册+pending > 未付费 > 基于日期的状态
              // 对于老 swimmer：即使有 pending payment，badge 也基于实际会员期状态
              // 对于新注册：如果有 pending payment，显示 inactive
              let badgeKind: "frozen" | "paused" | "active" | "due_soon" | "grace" | "inactive"
              if (isFrozen) {
                badgeKind = "frozen"
              } else if (isMembershipPaused) {
                badgeKind = "paused"
              } else if (!isPaid && !hasMembershipPeriod && hasPendingPayment) {
                // 新注册 + pending payment：显示 inactive
                badgeKind = "inactive"
              } else if (!isPaid && !hasMembershipPeriod) {
                // 新注册 + 未付费：显示 inactive
                badgeKind = "inactive"
              } else if (!isPaid && hasMembershipPeriod) {
                // 老 swimmer + 未付费：基于实际会员期状态（即使有 pending payment，也显示实际状态）
                badgeKind = computeBadgeStatus(baseStatus)
              } else {
                // 已付费：基于实际会员期状态
                badgeKind = computeBadgeStatus(baseStatus)
              }

              const daysLeft = typeof nextDue === "number" ? null : (nextDue ? diffInDays(nextDue, effectiveNow) : null)

              const isInactiveByDate = baseStatus === "inactive" || !nextDue
              // Renew button 不应该在有 pending payment 或 membership paused 时显示
              const canShowRenew = !isFrozen && !isMembershipPaused && !hasPendingPayment && (inRenewWindowWithPause({ nextDueDate: nextDue }, pauseState) || isInactiveByDate)
              const renewBusy = !!renewBusyMap[swimmer.id]

              return (
                <Card key={swimmer.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                          <Waves className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-slate-800">
                            {swimmer.childFirstName} {swimmer.childLastName}
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Age {calculateAge(swimmer.childDateOfBirth)}
                            {swimmer.level && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {swimmer.level}
                              </span>
                            )}
                          </CardDescription>
                          {(() => {
                            const registeredOn = formatRegisteredOn(swimmer.createdAt)
                            return registeredOn ? (
                              <p className="text-sm text-slate-500 mt-1">
                                Registered on: {registeredOn}
                              </p>
                            ) : null
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            badgeKind === "frozen"
                              ? "bg-rose-100 text-rose-700"
                              : badgeKind === "paused"
                              ? "bg-teal-100 text-teal-700"
                              : badgeKind === "active"
                              ? "bg-green-100 text-green-700"
                              : badgeKind === "grace"
                              ? "bg-amber-100 text-amber-700"
                              : badgeKind === "due_soon"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                          title={nextDue ? `Next due ${fmt(nextDue)}` : "No due date"}
                        >
                          {badgeKind === "frozen"
                            ? "FROZEN"
                            : badgeKind === "paused"
                            ? "MEMBERSHIP PAUSED"
                            : badgeKind === "due_soon"
                            ? "DUE SOON"
                            : badgeKind.toUpperCase()}
                          {/* 只在非 inactive 和非 paused 状态时显示天数 */}
                          {badgeKind !== "inactive" && badgeKind !== "paused" && typeof daysLeft === "number" && nextDue ? (
                            <em className="ml-1 not-italic opacity-70">
                              {daysLeft >= 0 ? `in ${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`}
                            </em>
                          ) : null}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                              <MoreHorizontal className="w-5 h-5 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50"
                              onClick={() => handleDeleteSwimmer(swimmer.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Payment pending 提醒（仅当存在未完成付款单且未标记为已付费） */}
                    <div className="mb-3 p-3 rounded-lg border bg-white">
                      <div className="text-sm font-medium text-slate-800">USA Swimming ID</div>
                      {swimmer.usaSwimmingId ? (
                        <p className="text-sm text-slate-600 mt-1">{swimmer.usaSwimmingId}</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-slate-500">
                            Required to Attend a meet. Register Premium / year-round with the club link, then save the ID.
                          </p>
                          {omrUrl ? (
                            <a href={omrUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">
                              Open club USA Swimming registration
                            </a>
                          ) : (
                            <p className="text-xs text-amber-700">Club registration link is not set yet. Ask Prime admin.</p>
                          )}
                          <div className="flex gap-2">
                            <input
                              className="flex-1 border rounded-md px-2 py-1 text-sm"
                              value={usaIdDraft[swimmer.id] || ""}
                              onChange={(e) => setUsaIdDraft((prev) => ({ ...prev, [swimmer.id]: e.target.value }))}
                              placeholder="USA Swimming ID"
                            />
                            <Button
                              size="sm"
                              disabled={meetBusy === `usa-${swimmer.id}`}
                              onClick={() => saveUsaSwimmingId(swimmer.id)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {hasPendingPayment && (
                      <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 mb-3">
                        <div className="text-sm text-yellow-800">
                          <span className="font-medium">Payment pending </span> – waiting for admin confirmation.
                        </div>
                      </div>
                    )}

                    {/* Tuition: one current period; amount only after website publish/send */}
                    {swimmer.tuition && (
                      <div className="mt-3 p-3 rounded-lg border bg-white">
                        <div className="text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <span>Tuition · {swimmer.tuition.monthLabel}</span>
                            {swimmer.tuition.status === "calculating" ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                {swimmer.tuition.statusLabel}
                              </span>
                            ) : (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  swimmer.tuition.paid
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {swimmer.tuition.statusLabel}
                              </span>
                            )}
                          </div>
                          {swimmer.tuition.status === "calculating" ? (
                            <p className="text-xs text-slate-500 mt-1">Amount will appear after the academy finalizes this month.</p>
                          ) : (
                            <div className="mt-1">
                              <b className="text-slate-800">
                                ${swimmer.tuition.amount}
                              </b>
                              {swimmer.tuition.dueDate && (
                                <span className="text-slate-500 text-xs ml-2">Due {swimmer.tuition.dueDate}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(meetsBySwimmer[swimmer.id] || [])
                      .filter((meet) => meet.eventLabel !== "confirmed")
                      .slice(0, 3)
                      .map((meet) => (
                      <div key={meet.meetId} className="mt-3 p-3 rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-800">
                            Upcoming meet · {meet.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {meet.eventLabel === "pending_for_review"
                              ? "Pending for review"
                              : meet.attendance === "attend"
                              ? "Attending"
                              : meet.attendance === "decline"
                              ? "Declined"
                              : "No response"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {meet.startDate} · Prime deadline {meet.primeCommitmentDeadline || "TBD"}
                        </div>
                        {meet.eventLabel === "pending_for_review" && meet.estimatedFee != null && (
                          <div className="mt-1 text-xs text-slate-500">Estimated host fee ${meet.estimatedFee.toFixed(2)} (not confirmed)</div>
                        )}
                        <div className="flex flex-wrap gap-3 mt-1">
                          <Link href={`/meets/${meet.meetId}?swimmerId=${swimmer.id}`} className="text-xs text-blue-700 underline">
                            {meet.attendance === "no_response" ? "Respond" : "View events"}
                          </Link>
                          <PnsMeetLink sourceKey={meet.sourceKey} className="text-xs text-blue-700 underline" />
                        </div>
                      </div>
                    ))}

                    {(meetsBySwimmer[swimmer.id] || [])
                      .filter((meet) => meet.eventLabel === "confirmed" && (meet.finalFee || 0) > 0)
                      .map((meet) => (
                      <div key={`inv-${meet.meetId}`} className="mt-3 p-3 rounded-lg border bg-white">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-800">Meet · {meet.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            {meet.paymentStatus === "paid"
                              ? "Paid"
                              : meet.paymentStatus === "payment_reported"
                              ? "Payment reported"
                              : "Unpaid"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Host entry fees (pass-through) · pay Prime</div>
                        <div className="mt-1 text-sm"><b>${(meet.finalFee || 0).toFixed(2)}</b></div>
                        {meet.paymentDueAt && (
                          <div className="text-xs text-slate-500">Due {meet.paymentDueAt.slice(0, 10)}</div>
                        )}
                        <div className="flex gap-3 mt-2">
                          <Link href={`/meets/${meet.meetId}?swimmerId=${swimmer.id}`} className="text-xs text-blue-700 underline">
                            View events
                          </Link>
                          <PnsMeetLink sourceKey={meet.sourceKey} className="text-xs text-blue-700 underline" />
                          {meet.paymentStatus === "invoice_ready" && (
                            <button
                              className="text-xs text-slate-800 underline"
                              disabled={meetBusy === `pay-${meet.meetId}-${swimmer.id}`}
                              onClick={() => reportMeetPayment(meet.meetId, swimmer.id)}
                            >
                              I have sent payment
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {(canShowRenew || hasPendingPayment) && (
                    <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="text-sm font-medium text-amber-950">Membership payment</div>
                      <div className="text-sm text-amber-900 mt-1">
                        Due <b>{fmt(nextDue)}</b>{" "}
                        {typeof daysLeft === "number" && nextDue && (
                          <em className="text-amber-800 not-italic">
                            ({daysLeft >= 0 ? `in ${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`})
                          </em>
                        )}
                      </div>

                      <div className="mt-3">
                        {isFrozen ? (
                          <div className="text-xs text-rose-600">This account is frozen. Please contact us if you have questions.</div>
                        ) : isMembershipPaused ? (
                          <div className="text-xs text-teal-700">
                            Membership is paused while away. Your due date will be extended when you return — no time lost.
                          </div>
                        ) : hasPendingPayment ? (
                          <div className="text-xs text-slate-500">
                            Payment pending / awaiting admin review.
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleRenew(swimmer)}
                            disabled={renewBusy}
                            className="bg-slate-800 text-white"
                          >
                            {renewBusy ? "Processing..." : "Pay membership"}
                          </Button>
                        )}
                      </div>
                    </div>
                    )}

                  </CardContent>
                </Card>
              )
            })}
          </div>

          {meetPayments.length > 0 && (
            <Card className="mt-8 border-0 shadow-lg bg-white">
              <CardHeader>
                <CardTitle>Payments to Prime · Meet fees</CardTitle>
                <CardDescription>Separate from tuition. These are pass-through host entry fees.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {meetPayments.map((p) => (
                  <div key={`${p.meetId}-${p.swimmerId}`} className="flex items-center justify-between gap-3 text-sm border rounded-md px-3 py-2">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        Host entry fees · {p.paymentStatus === "paid" ? "Paid" : p.paymentStatus === "payment_reported" ? "Waiting for confirmation" : "Unpaid"}
                        {p.paymentDueAt ? ` · due ${p.paymentDueAt.slice(0, 10)}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${(p.finalFee || 0).toFixed(2)}</div>
                      {p.paymentStatus === "invoice_ready" && p.swimmerId && (
                        <button
                          className="text-xs text-blue-700 underline"
                          disabled={meetBusy === `pay-${p.meetId}-${p.swimmerId}`}
                          onClick={() => reportMeetPayment(p.meetId, p.swimmerId!)}
                        >
                          I have sent payment
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {swimmers.length === 0 && (
            <Card className="border-0 shadow-lg bg-white text-center py-12">
              <CardContent>
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No Swimmers Yet</h3>
                <p className="text-slate-600 mb-6">Get started by registering your first swimmer.</p>
                <Link href="/register">
                  <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full px-8">
                    <Plus className="w-4 h-4 mr-2" />
                    Register First Swimmer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
