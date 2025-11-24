'use client'

import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import {
  collection, getDocs, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, query, where
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'
import {
  computeStatus, deriveCoverageFromAnchor,
  toMidnightLocal, RENEWAL_WINDOW_DAYS, GRACE_DAYS,
  diffInDays, fmt, type MembershipStatus
} from '@/lib/membership'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

interface Swimmer {
  id: string
  childFirstName: string
  childLastName: string
  childDateOfBirth?: string
  childGender?: string
  parentFirstName?: string
  parentLastName?: string
  parentEmail?: string
  parentPhone?: string
  paymentName?: string
  paymentMemo?: string
  paymentStatus?: string

  registrationAnchorDate?: Date | { toDate: () => Date } | string | null
  currentPeriodStart?: Date | { toDate: () => Date } | string | null
  currentPeriodEnd?: Date | { toDate: () => Date } | string | null
  nextDueDate?: Date | { toDate: () => Date } | string | null
  renewalWindowDays?: number
  graceDays?: number
  lastPaymentId?: string | null
  lastRenewalAt?: Date | { toDate: () => Date } | string | null
  pilot?: boolean
  isFrozen?: boolean

  familyDoctorName?: string
  familyDoctorPhone?: string
  familyDoctorEmail?: string
  medicalNotes?: string
  allergies?: string
  medications?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}

type Row = Swimmer & {
  _status: MembershipStatus
  _coverage: string
  _nextDueLabel: string
  _dueDelta?: number
}

export default function AdminSwimmerPage() {
  const router = useRouter()
  const [swimmers, setSwimmers] = useState<Swimmer[]>([])
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | 'pending' | 'frozen' | null>(null)
  const [remindBusy, setRemindBusy] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      const adminDocRef = doc(db, 'admin', user.email ?? '')
      const adminSnap = await getDoc(adminDocRef)
      if (adminSnap.exists()) {
        setIsAdmin(true)
        fetchSwimmers()
      } else {
        router.push('/not-authorized')
      }
      setCheckedAuth(true)
    })
    return () => unsubscribe()
  }, [router])

  const fetchSwimmers = async () => {
    const snap = await getDocs(collection(db, 'swimmers'))
    const data = snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>

      // Helper function to safely access nested properties
      const getNested = (obj: unknown, path: string[]): unknown => {
        let current: unknown = obj
        for (const key of path) {
          if (current && typeof current === 'object' && key in current) {
            current = (current as Record<string, unknown>)[key]
          } else {
            return undefined
          }
        }
        return current
      }

      // —— 字段名兼容映射（确保 Family Doctor/Medical 能显示）
      const familyDoctorName =
        (raw.familyDoctorName as string | undefined) ??
        (raw.doctorName as string | undefined) ??
        (raw.physicianName as string | undefined) ??
        (getNested(raw, ['medical', 'doctor', 'name']) as string | undefined) ??
        (getNested(raw, ['medical', 'physician', 'name']) as string | undefined) ??
        null

      const familyDoctorPhone =
        (raw.familyDoctorPhone as string | undefined) ??
        (raw.doctorPhone as string | undefined) ??
        (raw.physicianPhone as string | undefined) ??
        (getNested(raw, ['medical', 'doctor', 'phone']) as string | undefined) ??
        (getNested(raw, ['medical', 'physician', 'phone']) as string | undefined) ??
        null

      const emergencyContactName =
        (raw.emergencyContactName as string | undefined) ??
        (getNested(raw, ['emergency', 'name']) as string | undefined) ??
        (raw.emergencyName as string | undefined) ??
        null

      const emergencyContactPhone =
        (raw.emergencyContactPhone as string | undefined) ??
        (getNested(raw, ['emergency', 'phone']) as string | undefined) ??
        (raw.emergencyPhone as string | undefined) ??
        null

      const allergies =
        (raw.allergies as string | undefined) ??
        (raw.medicalAllergies as string | undefined) ??
        (getNested(raw, ['medical', 'allergies']) as string | undefined) ??
        null

      const medications =
        (raw.medications as string | undefined) ??
        (raw.medicalMedications as string | undefined) ??
        (getNested(raw, ['medical', 'medications']) as string | undefined) ??
        null

      const medicalNotes =
        (raw.medicalNotes as string | undefined) ??
        (getNested(raw, ['medical', 'notes']) as string | undefined) ??
        null

      return {
        id: d.id,
        ...raw,
        familyDoctorName,
        familyDoctorPhone,
        emergencyContactName,
        emergencyContactPhone,
        allergies,
        medications,
        medicalNotes,
      } as Swimmer
    })
    setSwimmers(data)
    setSelectedIds(prev => new Set([...prev].filter(id => data.some(s => s.id === id))))
  }

  const toDate = (v: Date | { toDate: () => Date } | string | number | null | undefined) => {
    if (!v) return undefined
    if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
      return (v as { toDate: () => Date }).toDate() as Date
    }
    if (typeof v === "string" || typeof v === "number") return new Date(v)
    if (v instanceof Date) return v
    return undefined
  }

  // 基于起点生成一整年周期：start → end(含)；nextDue = end+1d
  const makePeriodFromStart = (start: Date) => {
    const startMid = toMidnightLocal(start)
    const end = new Date(startMid.getFullYear() + 1, startMid.getMonth(), startMid.getDate())
    end.setDate(end.getDate() - 1)
    const endMid = toMidnightLocal(end)
    const next = new Date(endMid); next.setDate(next.getDate() + 1)
    const nextMid = toMidnightLocal(next)
    return { start: startMid, end: endMid, nextDue: nextMid }
  }

  // 先计算所有未过滤的 rows（用于 KPI 统计和后续过滤）
  const allRows: Row[] = useMemo(() => {
    const now = new Date()
    return swimmers
      .filter(s => {
        const hay = [
          `${s.childFirstName} ${s.childLastName}`,
          s.parentFirstName ?? '',
          s.parentLastName ?? '',
          s.parentEmail ?? '',
          s.parentPhone ?? ''
        ].join(' ').toLowerCase()
        return hay.includes(search.toLowerCase())
      })
      .map(s => {
        const anchor = toDate(s.registrationAnchorDate)
        let cps = toDate(s.currentPeriodStart)
        let cpe = toDate(s.currentPeriodEnd)
        let due = toDate(s.nextDueDate)

        if (!anchor && cps && cpe && due) {
          // 已有周期快照
        } else if (anchor && (!cps || !cpe || !due)) {
          const x = deriveCoverageFromAnchor(anchor)
          cps = x.currentPeriodStart as Date | undefined
          cpe = x.currentPeriodEnd as Date | undefined
          due = x.nextDueDate as Date | undefined
        }

        const st = computeStatus({ registrationAnchorDate: anchor, currentPeriodStart: cps, currentPeriodEnd: cpe, nextDueDate: due }, now)

        let dueLabel = '-'
        let dueDelta: number | undefined
        if (due) {
          const delta = diffInDays(due, now)
          dueDelta = delta
          if (delta > 0) dueLabel = `in ${delta}d`
          else if (delta === 0) dueLabel = 'today'
          else dueLabel = `${Math.abs(delta)}d overdue`
        }

        // 状态计算逻辑：与 dashboard 保持一致
        // 对于老 swimmer：即使有 pending payment，也显示实际会员期状态
        // 对于新注册：如果有 pending payment，显示 inactive
        const isPending = s.paymentStatus === 'pending'
        const hasMembershipPeriod = !!due
        const isPaid = s.paymentStatus === 'paid'
        
        let finalStatus: MembershipStatus
        if (s.isFrozen) {
          finalStatus = 'inactive'
        } else if (isPending && !hasMembershipPeriod) {
          // 新注册 + pending：显示 inactive
          finalStatus = 'inactive'
        } else if (!isPaid && !hasMembershipPeriod) {
          // 新注册 + 未付费：显示 inactive
          finalStatus = 'inactive'
        } else {
          // 老 swimmer 或已付费：基于实际会员期状态（即使有 pending，也显示实际状态）
          finalStatus = st
        }

        return {
          ...s,
          _status: finalStatus,
          _coverage: cps && cpe ? `${fmt(cps)} – ${fmt(cpe)}` : '-',
          _nextDueLabel: due ? `${fmt(due)} (${dueLabel})` : '-',
          _dueDelta: dueDelta
        }
      })
      .sort((a, b) => {
        const rank = (x: MembershipStatus) => ({ grace: 0, due_soon: 1, inactive: 2, active: 3 }[x])
        const r = rank(a._status) - rank(b._status)
        if (r !== 0) return r
        const ad = toDate(a.nextDueDate)?.getTime() ?? Infinity
        const bd = toDate(b.nextDueDate)?.getTime() ?? Infinity
        return ad - bd
      })
  }, [swimmers, search])

  // 基于 allRows 应用状态过滤
  const rows: Row[] = useMemo(() => {
    return allRows.filter(r => {
      // 应用状态过滤
      if (statusFilter === null) return true
      if (statusFilter === 'pending') return r.paymentStatus === 'pending'
      if (statusFilter === 'frozen') return r.isFrozen === true
      return r._status === statusFilter
    })
  }, [allRows, statusFilter])

  // 基于 allRows 计算 KPI（不受过滤影响）
  const kpi = useMemo(() => {
    const c = { active: 0, due_soon: 0, grace: 0, inactive: 0, pending: 0, frozen: 0 }
    allRows.forEach(r => {
      c[r._status]++
      if (r.paymentStatus === 'pending') c.pending++
      if (r.isFrozen) c.frozen++
    })
    return c
  }, [allRows])


  const StatusBadge = ({ status }: { status: MembershipStatus }) => {
    const cls = {
      active: 'bg-emerald-100 text-emerald-700',
      due_soon: 'bg-amber-100 text-amber-700',
      grace: 'bg-red-100 text-red-700',
      inactive: 'bg-slate-200 text-slate-700'
    }[status]
    const label = { active: 'Active', due_soon: 'Due Soon', grace: 'Grace', inactive: 'Inactive' }[status]
    return <span className={cn('px-2 py-1 text-xs rounded-full font-medium', cls)}>{label}</span>
  }

  // —— Mark as Paid（首付/重返 / 续期 / 幂等 / 窗口保护）
  const markPaid = useCallback(async (id: string) => {
    const s = swimmers.find(x => x.id === id)
    if (!s) return

    // 更新相关的 pending payment 文档状态为 'paid'
    try {
      const pendingPayments = await getDocs(
        query(
          collection(db, 'payments'),
          where('swimmerId', '==', id),
          where('status', '==', 'pending')
        )
      )
      await Promise.all(
        pendingPayments.docs.map((payDoc) =>
          updateDoc(doc(db, 'payments', payDoc.id), {
            status: 'paid',
            updatedAt: serverTimestamp()
          })
        )
      )
    } catch (err) {
      console.error('Failed to update payment status:', err)
      // 继续执行，即使更新 payment 失败也不影响标记 swimmer 为已付费
    }

    const nowMid = toMidnightLocal(new Date())

    const toDateLocal = (v: Date | { toDate: () => Date } | string | number | null | undefined) => {
      if (!v) return undefined
      if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
        return (v as { toDate: () => Date }).toDate() as Date
      }
      if (typeof v === "string" || typeof v === "number") return new Date(v)
      if (v instanceof Date) return v
      return undefined
    }

    const anchor = toDateLocal(s.registrationAnchorDate)
    const cps = toDateLocal(s.currentPeriodStart)
    const cpe = toDateLocal(s.currentPeriodEnd)
    const nextDue = toDateLocal(s.nextDueDate)

    const MS = 24*60*60*1000
    const inRenewOrGraceWindow = !!nextDue && (() => {
      const today = nowMid.getTime()
      const due = toMidnightLocal(nextDue!).getTime()
      const earlyStart = due - RENEWAL_WINDOW_DAYS * MS
      const graceEnd  = due + GRACE_DAYS * MS
      return today >= earlyStart && today <= graceEnd
    })()

    // —— 判定“首付/重返”
    const isNewRegistration =
      s.isFrozen === true || !anchor || !cps || !cpe || !nextDue

    // —— 计算这次应该使用的起算日 baseStart
    // 1) 首付/重返：今天
    // 2) 续期：必须在"续期/宽限窗"内，起算=nextDue
    // 3) 已过期（超过 grace period）：按重返处理，从今天起算
    // 4) 其他情况（不在窗口内且未过期）：不滚动，仅标记 paid
    let baseStart: Date | null = null
    let isRejoin = false // 标记是否为重返（已过期后的重新加入）
    
    if (isNewRegistration) {
      baseStart = nowMid
    } else if (inRenewOrGraceWindow) {
      baseStart = nextDue ? toMidnightLocal(nextDue) : nowMid
    } else if (nextDue) {
      // 不在窗口：检查是否已过期（超过 grace period）
      const graceEnd = toMidnightLocal(nextDue).getTime() + GRACE_DAYS * MS
      const todayTime = nowMid.getTime()
      
      if (todayTime > graceEnd) {
        // 已过期：按重返处理，从今天起算
        isRejoin = true
        baseStart = nowMid
      } else {
        // 未过期但不在窗口：只标记 paid，不改任何日期
        await updateDoc(doc(db, 'swimmers', id), {
          paymentStatus: 'paid',
          lastRenewalAt: serverTimestamp()
        })
        await fetchSwimmers()
        return
      }
    } else {
      // 没有 nextDue：按重返处理
      isRejoin = true
      baseStart = nowMid
    }

    // —— 幂等：如果这次应当滚动，但 baseStart 与现有 cps 相同，则不滚动，只更新 paid
    if (!isNewRegistration && cps && toMidnightLocal(cps).getTime() === baseStart.getTime()) {
      await updateDoc(doc(db, 'swimmers', id), {
        paymentStatus: 'paid',
        lastRenewalAt: serverTimestamp()
      })
      await fetchSwimmers()
      return
    }

    // —— 按 baseStart 建一整年周期
    const { start: newStart, end: newEnd, nextDue: newNextDue } = makePeriodFromStart(baseStart)

    const patch: Record<string, unknown> = {
      paymentStatus: 'paid',
      currentPeriodStart: newStart,
      currentPeriodEnd: newEnd,
      nextDueDate: newNextDue,
      lastRenewalAt: serverTimestamp(),
      renewalWindowDays: RENEWAL_WINDOW_DAYS,
      graceDays: GRACE_DAYS,
    }
    if (isNewRegistration || isRejoin) {
      // 首付/重返：更新 anchor date，并解冻
      patch.registrationAnchorDate = newStart
      patch.isFrozen = false          // 首付/重返自动解冻
    }

    await updateDoc(doc(db, 'swimmers', id), patch)

    if (s.parentEmail && s.childFirstName) {
      // Calculate age from date of birth
      const calculateAge = (dateOfBirth?: string): number | null => {
        if (!dateOfBirth) return null
        const birthDate = new Date(dateOfBirth)
        if (isNaN(birthDate.getTime())) return null
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--
        }
        return age
      }

      const age = calculateAge(s.childDateOfBirth)
      
      await fetch('/api/registration-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentEmail: s.parentEmail,
          parentName: `${s.parentFirstName ?? ''} ${s.parentLastName ?? ''}`.trim(),
          swimmerName: `${s.childFirstName} ${s.childLastName}`,
          phone: s.parentPhone || undefined,
          age: age !== null ? age : undefined,
          period: `${fmt(newStart)} – ${fmt(newEnd)}`
        })
      })
    }
    await fetchSwimmers()
  }, [swimmers])


  // —— 顶部批量操作
  const sendReminderOne = async (s: Row): Promise<{ success: boolean; error?: string }> => {
    if (!s.parentEmail) {
      return { success: false, error: 'No parent email' }
    }
    try {
      const authToken = await auth.currentUser?.getIdToken()
      if (!authToken) {
        return { success: false, error: 'Not authenticated' }
      }
      const res = await fetch('/api/admin/send-renewal-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parentEmail: s.parentEmail,
          parentName: `${s.parentFirstName ?? ''} ${s.parentLastName ?? ''}`.trim(),
          swimmerName: `${s.childFirstName} ${s.childLastName}`,
          status: s._status,
          nextDueDate: (s.nextDueDate && typeof s.nextDueDate === 'object' && 'toDate' in s.nextDueDate) ? s.nextDueDate.toDate() : s.nextDueDate,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        return { success: false, error: data.error || 'Failed to send email' }
      }
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  const remindSelected = async () => {
    const targets = rows.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) {
      alert('Please select at least one swimmer.')
      return
    }
    
    setRemindBusy(true)
    try {
      const results = await Promise.all(targets.map(sendReminderOne))
      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length
      
      if (failureCount === 0) {
        alert(`Successfully sent ${successCount} reminder(s).`)
      } else {
        alert(`Sent ${successCount} reminder(s), ${failureCount} failed. Check console for details.`)
        console.error('Failed reminders:', results.filter(r => !r.success))
      }
    } catch (error) {
      alert('An error occurred while sending reminders.')
      console.error(error)
    } finally {
      setRemindBusy(false)
    }
  }

  // Migrate existing swimmers - set proper membership dates and status
  const migrateExistingSwimmers = async (selectedOnly: boolean = false) => {
    const targetSwimmers = selectedOnly && selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : null
    
    const confirmMessage = selectedOnly && targetSwimmers
      ? `This will migrate ${targetSwimmers.length} selected swimmer(s) with missing membership dates and status. Continue?`
      : 'This will update all existing swimmers with missing membership dates and status. Continue?'
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setMigrating(true)
    try {
      const authToken = await auth.currentUser?.getIdToken()
      if (!authToken) {
        alert('Not authenticated')
        return
      }

      const body = targetSwimmers ? { swimmerIds: targetSwimmers } : {}
      
      const res = await fetch('/api/admin/migrate-existing-swimmers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok && data.ok) {
        const { results } = data
        const message = `Migration completed!\n` +
          `Total processed: ${results.total}\n` +
          `Migrated: ${results.migrated}\n` +
          `Skipped: ${results.skipped}\n` +
          (results.errors.length > 0 ? `Errors: ${results.errors.length}` : '')
        alert(message)
        if (results.errors.length > 0) {
          console.error('Migration errors:', results.errors)
        }
        // Refresh swimmers list
        await fetchSwimmers()
        // Clear selection after migration
        if (selectedOnly) {
          setSelectedIds(new Set())
        }
      } else {
        alert(`Migration failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert('An error occurred during migration.')
      console.error(error)
    } finally {
      setMigrating(false)
    }
  }

  // Send test email to admin
  const sendTestEmail = async () => {
    setRemindBusy(true)
    try {
      const authToken = await auth.currentUser?.getIdToken()
      if (!authToken) {
        alert('Not authenticated')
        return
      }

      // Get first due_soon or grace swimmer for test
      const testSwimmer = allRows.find(r => (r._status === 'due_soon' || r._status === 'grace') && r.parentEmail)
      if (!testSwimmer) {
        alert('No swimmers with due_soon or grace status found for test.')
        return
      }

      const res = await fetch('/api/admin/send-renewal-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parentEmail: testSwimmer.parentEmail,
          parentName: `${testSwimmer.parentFirstName ?? ''} ${testSwimmer.parentLastName ?? ''}`.trim(),
          swimmerName: `${testSwimmer.childFirstName} ${testSwimmer.childLastName}`,
          status: testSwimmer._status,
          nextDueDate: (testSwimmer.nextDueDate && typeof testSwimmer.nextDueDate === 'object' && 'toDate' in testSwimmer.nextDueDate) ? testSwimmer.nextDueDate.toDate() : testSwimmer.nextDueDate,
          testMode: true, // Send test email to admin
        })
      })

      const data = await res.json()
      if (res.ok && data.ok) {
        alert(`Test email sent! Check your email (${auth.currentUser?.email}) to see the format.`)
      } else {
        alert(`Failed to send test email: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert('An error occurred while sending test email.')
      console.error(error)
    } finally {
      setRemindBusy(false)
    }
  }

  const freezeSelected = async (freeze: boolean) => {
    const targets = rows.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) { alert('Please select at least one swimmer.'); return }
    await Promise.all(targets.map(r => updateDoc(doc(db, 'swimmers', r.id), { isFrozen: freeze })))
    await fetchSwimmers()
  }

  const deleteSelected = async () => {
    const targets = rows.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) { alert('Please select at least one swimmer.'); return }
    if (!confirm(`Delete ${targets.length} swimmer(s)? This cannot be undone.`)) return
    await Promise.all(targets.map(r => deleteDoc(doc(db, 'swimmers', r.id))))
    await fetchSwimmers()
  }

  // 仅改支付状态，**不**改任何周期字段
  const markPendingSelected = async () => {
    const targets = rows.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) { alert('Please select at least one swimmer.'); return }
    await Promise.all(targets.map(r => updateDoc(doc(db, 'swimmers', r.id), {
      paymentStatus: 'pending'
    })))
    await fetchSwimmers()
    alert(`Marked ${targets.length} swimmer(s) as PENDING.`)
  }

  const markPaidSelected = async () => {
    const targets = rows.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) { alert('Please select at least one swimmer.'); return }
    for (const r of targets) {
      await markPaid(r.id)
    }
    alert(`Marked ${targets.length} swimmer(s) as PAID.`)
  }

  // 选择 & 分页
  const currentPageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return rows.slice(start, end)
  }, [rows, page])

  const allVisibleSelected = currentPageRows.length > 0 && currentPageRows.every(r => selectedIds.has(r.id))
  const someVisibleSelected = currentPageRows.some(r => selectedIds.has(r.id))

  if (!checkedAuth) return <p className="text-center mt-10">Checking access...</p>
  if (!isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Header />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Swimmer Management</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            variant={statusFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(null); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === null && "bg-slate-700 text-white"
            )}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'active' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('active'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'active' ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            )}
          >
            Active {kpi.active}
          </Button>
          <Button
            variant={statusFilter === 'due_soon' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('due_soon'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'due_soon' ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            )}
          >
            Due Soon {kpi.due_soon}
          </Button>
          <Button
            variant={statusFilter === 'grace' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('grace'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'grace' ? "bg-red-600 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"
            )}
          >
            Grace {kpi.grace}
          </Button>
          <Button
            variant={statusFilter === 'inactive' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('inactive'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'inactive' ? "bg-slate-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            )}
          >
            Inactive {kpi.inactive}
          </Button>
          <Button
            variant={statusFilter === 'pending' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('pending'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'pending' ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            )}
          >
            Pending {kpi.pending}
          </Button>
          <Button
            variant={statusFilter === 'frozen' ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter('frozen'); setPage(1) }}
            className={cn(
              "px-2 py-1 h-auto text-xs",
              statusFilter === 'frozen' ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            Frozen {kpi.frozen}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search swimmers / parents / email / phone"
          className="w-80"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => migrateExistingSwimmers(true)} 
            disabled={migrating || selectedIds.size === 0}
            className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            {migrating ? 'Migrating...' : `Migrate Selected (${selectedIds.size})`}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => migrateExistingSwimmers(false)} 
            disabled={migrating}
            className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            {migrating ? 'Migrating...' : 'Migrate All Swimmers'}
          </Button>
          <Button 
            variant="outline" 
            onClick={sendTestEmail} 
            disabled={remindBusy}
            className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
          >
            {remindBusy ? 'Sending...' : 'Send Test Email'}
          </Button>
          <Button 
            variant="outline" 
            onClick={remindSelected} 
            disabled={selectedIds.size === 0 || remindBusy}
          >
            Remind Selected
          </Button>
          <Button variant="outline" onClick={() => freezeSelected(true)} disabled={selectedIds.size === 0}>
            Freeze
          </Button>
          <Button variant="outline" onClick={() => freezeSelected(false)} disabled={selectedIds.size === 0}>
            Unfreeze
          </Button>
          <Button variant="outline" onClick={markPendingSelected} disabled={selectedIds.size === 0}>
            Mark as Pending
          </Button>
          <Button className="bg-green-600 text-white" onClick={markPaidSelected} disabled={selectedIds.size === 0}>
            Mark as Paid
          </Button>
          <Button className="bg-red-600 text-white" onClick={deleteSelected} disabled={selectedIds.size === 0}>
            Delete
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={
                    currentPageRows.length === 0
                      ? false
                      : allVisibleSelected
                      ? true
                      : someVisibleSelected
                      ? 'indeterminate'
                      : false
                  }
                  onCheckedChange={(v) => {
                    const checked = v === true
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      if (checked) {
                        currentPageRows.forEach(r => next.add(r.id))
                      } else {
                        currentPageRows.forEach(r => next.delete(r.id))
                      }
                      return next
                    })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Coverage</TableHead>
            <TableHead>Next Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {currentPageRows.map((s) => {
            const selected = selectedIds.has(s.id)
            const isExpanded = expandedId === s.id
            return (
              <Fragment key={s.id}>
                <TableRow
                  className={cn('cursor-pointer', selected ? 'bg-slate-50' : '')}
                  onClick={() => setExpandedId(prev => (prev === s.id ? null : s.id))}
                >
                  <TableCell onClick={(e) => { e.stopPropagation() }}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(v) => {
                          const checked = v === true
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (checked) next.add(s.id)
                            else next.delete(s.id)
                            return next
                          })
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-medium">{s.childFirstName} {s.childLastName}</div>
                    <div className="text-xs text-slate-500">{s.childGender ?? '-'}</div>
                  </TableCell>

                  <TableCell>
                    <div>{(s.parentFirstName || s.parentLastName) ? `${s.parentFirstName ?? ''} ${s.parentLastName ?? ''}`.trim() : '-'}</div>
                    <div className="text-xs text-slate-500">{s.parentEmail ?? '-'}</div>
                  </TableCell>

                  <TableCell>{s._coverage}</TableCell>
                  <TableCell>{s._nextDueLabel}</TableCell>
                  <TableCell><StatusBadge status={s._status} /></TableCell>
                  <TableCell className="text-sm">{s.paymentStatus ?? '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {s.isFrozen ? 'Frozen' : '-'}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow key={`${s.id}-details`}>
                    <TableCell colSpan={8} className="bg-slate-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {/* Family Doctor */}
                        <div className="p-3 rounded-lg border bg-white">
                          <div className="font-semibold mb-2">Family Doctor</div>
                          <div>
                            <span className="text-slate-500">Name:</span>{" "}
                            {s.familyDoctorName || "-"}
                          </div>
                          <div>
                            <span className="text-slate-500">Phone:</span>{" "}
                            {s.familyDoctorPhone || "-"}
                          </div>
                        </div>

                        {/* Parent + Emergency Contact */}
                        <div className="p-3 rounded-lg border bg-white">
                          <div className="font-semibold mb-2">Parent & Emergency Contact</div>

                          <div className="mb-1">
                            <span className="text-slate-500">Parent:</span>{" "}
                            {(s.parentFirstName || s.parentLastName)
                              ? `${s.parentFirstName ?? ""} ${s.parentLastName ?? ""}`.trim()
                              : "-"}
                          </div>
                          <div className="mb-2">
                            <span className="text-slate-500">Parent Phone:</span>{" "}
                            {s.parentPhone || "-"}
                          </div>

                          <div>
                            <span className="text-slate-500">Emergency Name:</span>{" "}
                            {s.emergencyContactName || "-"}
                          </div>
                          <div>
                            <span className="text-slate-500">Emergency Phone:</span>{" "}
                            {s.emergencyContactPhone || "-"}
                          </div>
                        </div>

                        {/* Medical */}
                        <div className="p-3 rounded-lg border bg-white md:col-span-1">
                          <div className="font-semibold mb-2">Medical</div>
                          <div>
                            <span className="text-slate-500">Allergies:</span>{" "}
                            {s.allergies || "-"}
                          </div>
                          <div>
                            <span className="text-slate-500">Medications:</span>{" "}
                            {s.medications || "-"}
                          </div>
                          <div className="mt-2">
                            <span className="text-slate-500">Notes:</span>{" "}
                            {s.medicalNotes || "-"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

              </Fragment>
            )
          })}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Window: early {RENEWAL_WINDOW_DAYS}d / grace {GRACE_DAYS}d. Freeze/Unfreeze does not change coverage dates. Status is computed from dates (and frozen), not paymentStatus.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Button>
          <span className="text-sm">Page {page} / {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
          <Button variant="outline" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(rows.length / pageSize)), p + 1))} disabled={page >= Math.max(1, Math.ceil(rows.length / pageSize))}>Next</Button>
        </div>
      </div>
    </div>
  )
}
