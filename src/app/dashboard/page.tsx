// app/dashboard/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Swimmer } from "@/types"
import Footer from "@/components/footer"
import { User, Users, Plus, LogOut, Settings, Waves, MoreHorizontal, Trash2, TrendingUp, Calendar, CheckCircle2, XCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

// 会员：状态计算与工具
import {
  computeStatus,
  computeBadgeStatus,
  inRenewWindow,
  fmt,
  diffInDays,
  RENEWAL_WINDOW_DAYS,
} from "@/lib/membership"

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
  paymentStatus?: string    // ✅ 读取 swimmers.paymentStatus：'pending' | 'paid' | null/undefined
}

type RSVPStatus = "yes" | "no" | "none"

type EventLite = {
  id: string
  text?: string
  startsAt?: string | null // ISO
  active?: boolean
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
function startOfTodayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
function parseIsoSafe(s?: string | null): Date | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t) : null
}
function isUpcomingOrToday(evDate: Date) {
  const eventDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate())
  return eventDay.getTime() >= startOfTodayLocal().getTime()
}
function isLocked1h(evDate: Date) {
  const now = Date.now()
  const diffMs = evDate.getTime() - now
  return diffMs <= 60 * 60 * 1000
}
function formatStartsAt(d?: Date | null) {
  if (!d) return ""
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
function normalizeId(s?: string | null) {
  return (s || "").trim()
}

// 将 /api/makeup/events 结果做成索引
type EventIndexEntry = {
  startsAt?: string | null
  isUpcoming: boolean
  isLocked: boolean
  text?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [parentEmail, setParentEmail] = useState<string>("")
  const [swimmers, setSwimmers] = useState<SwimmerWithMakeup[]>([])
  const [loading, setLoading] = useState(true)

  // RSVP
  const [rsvpMap, setRsvpMap] = useState<Record<string, RSVPStatus>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  // Renew busy
  const [renewBusyMap] = useState<Record<string, boolean>>({})

  // 事件索引 + 加载状态
  const [eventsIndex, setEventsIndex] = useState<Record<string, EventIndexEntry>>({})
  const [eventsLoaded, setEventsLoaded] = useState(false)

  // 每个 swimmer 是否存在未完成付款（payments.status = 'pending'）
  const [pendingMap, setPendingMap] = useState<Record<string, { paymentId: string }>>({})

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
        setSwimmers((data.swimmers || []) as SwimmerWithMakeup[])
        setPendingMap((data.pendingMap || {}) as Record<string, { paymentId: string }>)
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

  // 拉取 events 索引
  useEffect(() => {
    ;(async () => {
      try {
        const u = auth.currentUser
        if (!u) return
        const idToken = await u.getIdToken(true)
        const res = await fetch("/api/makeup/events", {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Load events failed")

        const idx: Record<string, EventIndexEntry> = {}
        ;(data.events as EventLite[]).forEach((ev) => {
          const d = parseIsoSafe(ev.startsAt ?? null)
          if (d) {
            idx[ev.id] = {
              startsAt: ev.startsAt,
              isUpcoming: isUpcomingOrToday(d),
              isLocked: isLocked1h(d),
              text: ev.text && ev.text.trim().length ? ev.text : formatStartsAt(d),
            }
          } else {
            idx[ev.id] = {
              startsAt: null,
              isUpcoming: ev.active === true,
              isLocked: false,
              text: (ev.text || "").trim() || undefined,
            }
          }
        })

        setEventsIndex(idx)
      } catch (e) {
        console.error("Load events index failed:", e)
        setEventsIndex({})
      } finally {
        setEventsLoaded(true)
      }
    })()
  }, [])

  // 批量加载 RSVP 回显
  useEffect(() => {
    ;(async () => {
      const pairs = swimmers
        .filter((s) => s.id && s.nextMakeupId)
        .map((s) => ({
          swimmerId: s.id!,
          makeupId: normalizeId(s.nextMakeupId),
        }))

      if (!pairs.length) return

      try {
        const u = auth.currentUser
        if (!u) return
        const idToken = await u.getIdToken(true)

        const res = await fetch("/api/makeup/rsvp", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ pairs }),
        })

        const payload = await res.json()
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || `status load failed (${res.status})`)
        }

        const map: Record<string, RSVPStatus> = payload.map || {}
        setRsvpMap((prev) => ({ ...prev, ...map }))
      } catch (err) {
        console.error("Load RSVP status failed:", err)
      }
    })()
  }, [swimmers])

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

  // 提交 RSVP
  const handleRSVP = async (swimmer: SwimmerWithMakeup, status: RSVPStatus) => {
    if (!swimmer.nextMakeupId) return
    const makeupId = normalizeId(swimmer.nextMakeupId)
    const key = `${swimmer.id}_${makeupId}`
    try {
      setBusy((b) => ({ ...b, [key]: true }))

      const u = auth.currentUser
      if (!u) throw new Error("Not signed in")
      const idToken = await u.getIdToken(true)

      const res = await fetch("/api/makeup/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          swimmerId: swimmer.id,
          makeupId,
          status,
        }),
      })

      const ctype = res.headers.get("content-type") || ""
      const payload = ctype.includes("application/json") ? await res.json() : { ok: false, error: await res.text() }

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `RSVP failed (${res.status})`)
      }

      setRsvpMap((m) => ({ ...m, [key]: status }))
    } catch (e) {
      console.error("RSVP update failed:", e)
      alert(e instanceof Error ? e.message : "Failed to update RSVP.")
    } finally {
      setBusy((b) => ({ ...b, [key]: false }))
    }
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
              // —— Make-up —— //
              const nextText = swimmer.nextMakeupText || ""
              const rawNextId = swimmer.nextMakeupId || ""
              const nextId = normalizeId(rawNextId)
              const rsvpKey = nextId ? `${swimmer.id}_${nextId}` : ""
              const rsvp = rsvpKey ? (rsvpMap[rsvpKey] || "none") : "none"
              const isBusy = rsvpKey ? !!busy[rsvpKey] : false
              const evt = nextId ? eventsIndex[nextId] : undefined
              const showMakeup =
                !!nextId && (
                  !eventsLoaded ||
                  !evt ||
                  evt.isUpcoming
                )
              const displayText =
                nextText ||
                evt?.text ||
                (evt?.startsAt ? formatStartsAt(parseIsoSafe(evt.startsAt)) : "")
              const locked = evt?.isLocked ?? false

              // —— 会员状态计算 —— //
              const hasPending = !!pendingMap[swimmer.id]
              const isFrozen = !!swimmer.isFrozen
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
              const baseStatus = computeStatus({ nextDueDate: nextDue })
              
              // 判断是否是老 swimmer（有会员期）
              const hasMembershipPeriod = !!nextDue

              // 优先级：frozen > 新注册+pending > 未付费 > 基于日期的状态
              // 对于老 swimmer：即使有 pending payment，badge 也基于实际会员期状态
              // 对于新注册：如果有 pending payment，显示 inactive
              let badgeKind: "frozen" | "active" | "due_soon" | "grace" | "inactive"
              if (isFrozen) {
                badgeKind = "frozen"
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

              const daysLeft = typeof nextDue === "number" ? null : (nextDue ? diffInDays(nextDue, new Date()) : null)

              const isInactiveByDate = baseStatus === "inactive" || !nextDue
              // Renew button 不应该在有 pending payment 时显示
              const canShowRenew = !isFrozen && !hasPendingPayment && (inRenewWindow({ nextDueDate: nextDue }) || isInactiveByDate)
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
                          <p className="text-sm text-slate-500 mt-1">
                            Registered on: {new Date(swimmer.createdAt?.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            badgeKind === "frozen"
                              ? "bg-rose-100 text-rose-700"
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
                          {badgeKind === "frozen" ? "FROZEN" : badgeKind === "due_soon" ? "DUE SOON" : badgeKind.toUpperCase()}
                          {/* 只在非 inactive 和非 pending 状态时显示天数 */}
                          {badgeKind !== "inactive" && typeof daysLeft === "number" && nextDue ? (
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
                    {hasPendingPayment && (
                      <div className="flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 mb-3">
                        <div className="text-sm text-yellow-800">
                          <span className="font-medium">Payment pending </span> – waiting for admin confirmation.
                        </div>
                      </div>
                    )}

                    {/* Membership info + Action */}
                    <div className="mt-3 p-3 rounded-lg border bg-slate-50">
                      <div className="text-sm text-slate-600">
                        <div>
                          Membership Due: <b>{fmt(nextDue)}</b>{" "}
                          {typeof daysLeft === "number" && nextDue && (
                            <em className="text-slate-500">
                              ({daysLeft >= 0 ? `in ${daysLeft}d` : `${Math.abs(daysLeft)}d overdue`})
                            </em>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Renewal window: {RENEWAL_WINDOW_DAYS} days before expiration
                        </div>
                      </div>

                      <div className="mt-3">
                        {isFrozen ? (
                          <div className="text-xs text-rose-600">This account is frozen. Please contact us if you have questions.</div>
                        ) : hasPendingPayment ? (
                          <div className="text-xs text-slate-500">
                            Payment pending / awaiting admin review.
                          </div>
                        ) : canShowRenew ? (
                          <Button
                            onClick={() => handleRenew(swimmer)}
                            disabled={renewBusy}
                            className="bg-slate-800 text-white"
                          >
                            {renewBusy ? "Processing..." : "Renew"}
                          </Button>
                        ) : (
                          <div className="text-xs text-slate-500">
                            Membership is active. No action needed.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Next make-up class + RSVP */}
                    <div className="mt-4 p-4 rounded-lg border-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          Make-up Class
                        </h3>
                        {rsvp !== "none" && (
                          <Badge
                            className={
                              rsvp === "yes"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            }
                          >
                            {rsvp === "yes" ? "✅ Going" : "❌ Not going"}
                          </Badge>
                        )}
                      </div>
                      {showMakeup && displayText ? (
                        <>
                          <div className="font-medium text-slate-800 mb-4 text-base leading-relaxed">{displayText}</div>
                          <div className="flex gap-2">
                            <Button
                              disabled={!nextId || isBusy || locked}
                              onClick={() => handleRSVP(swimmer, "yes")}
                              className={`flex-1 rounded-lg transition-all ${
                                rsvp === "yes"
                                  ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md"
                                  : "bg-white hover:bg-green-50 text-green-600 border-2 border-green-200 hover:border-green-300"
                              }`}
                            >
                              {isBusy && rsvp !== "yes" ? (
                                "Saving..."
                              ) : rsvp === "yes" ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Going
                                </>
                              ) : (
                                "I'm going"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={!nextId || isBusy || locked}
                              onClick={() => handleRSVP(swimmer, "no")}
                              className={`flex-1 rounded-lg transition-all ${
                                rsvp === "no"
                                  ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white border-0 shadow-md"
                                  : "bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 hover:border-red-300"
                              }`}
                            >
                              {isBusy && rsvp !== "no" ? (
                                "Saving..."
                              ) : rsvp === "no" ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Not going
                                </>
                              ) : (
                                "Not going"
                              )}
                            </Button>
                          </div>
                          {locked ? (
                            <div className="text-xs text-slate-500 mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                              ⚠️ Changes are locked within 1 hour of class.
                            </div>
                          ) : rsvp !== "none" ? (
                            <div className="text-xs text-slate-600 mt-3">
                              ✓ Your selection has been recorded.
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 mt-3">
                              Please let us know if you&apos;ll be attending.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 text-sm text-center py-2">No make-up class announced yet.</div>
                      )}
                    </div>

                    {/* Evaluation History */}
                    <div className="mt-4 p-3 rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                          <span className="text-sm font-medium text-slate-800">Evaluation History</span>
                        </div>
                        <Link href={`/evaluations/${swimmer.id}`}>
                          <Button variant="outline" size="sm" className="rounded-full">
                            View Progress
                          </Button>
                        </Link>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        Track your child&apos;s swimming skills and progress over time
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

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
