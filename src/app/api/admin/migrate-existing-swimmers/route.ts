// app/api/admin/migrate-existing-swimmers/route.ts
// 为已有学员设置正确的会员期日期和状态

import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore"
import { cert, getApps, initializeApp } from "firebase-admin/app"

// Admin SDK init
const projectId = process.env.FIREBASE_PROJECT_ID!
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId })
}
const adminAuth = getAuth()
const fdb = getFirestore()

// Check if user is admin
async function isAdminEmail(email: string): Promise<boolean> {
  try {
    const snap = await fdb.collection("admin").doc(email).get()
    return snap.exists
  } catch {
    return false
  }
}

const toMidnight = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const addYearsMinusOneDay = (start: Date, years = 1) => {
  const end = new Date(start)
  end.setFullYear(end.getFullYear() + years)
  end.setDate(end.getDate() - 1)
  return end
}

const nextDueFromAnchor = (anchor: Date) => {
  return toMidnight(new Date(anchor.getFullYear() + 1, anchor.getMonth(), anchor.getDate()))
}

// 推断是否已付费
async function inferPaid(swimmerId: string, data: Record<string, unknown>): Promise<boolean> {
  // 优先使用 paymentStatus（新的标准字段）
  if (data?.paymentStatus === "paid") return true
  // 向后兼容：检查旧的 isPaid 字段
  if (typeof data?.isPaid === "boolean") return data.isPaid
  // 如果有会员期日期，假设已付费
  if (data?.registrationAnchorDate || data?.currentPeriodStart || data?.nextDueDate) return true
  
  // 检查 payments 集合中是否有已支付的记录
  const paymentsQuery = await fdb
    .collection("payments")
    .where("swimmerId", "==", swimmerId)
    .where("status", "==", "paid")
    .limit(1)
    .get()
  
  return !paymentsQuery.empty
}

// 从已有数据中选择锚定日期
function pickAnchorDate(data: Record<string, unknown>): Date {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate()
    }
    if (v instanceof Date) return v
    return null
  }
  const dates = [
    toDate(data?.currentPeriodStart),
    toDate(data?.registrationAnchorDate),
    toDate(data?.createdAt),
  ].filter((d): d is Date => d !== null)
  
  if (dates.length > 0) {
    return toMidnight(dates[0])
  }
  
  // 如果都没有，使用今天（但这不应该发生）
  return toMidnight(new Date())
}

// 构建会员期覆盖
function buildCoverageFromAnchor(anchor: Date) {
  const start = toMidnight(anchor)
  const end = addYearsMinusOneDay(start, 1)
  const due = nextDueFromAnchor(start)
  return {
    registrationAnchorDate: Timestamp.fromDate(start),
    currentPeriodStart: Timestamp.fromDate(start),
    currentPeriodEnd: Timestamp.fromDate(end),
    nextDueDate: Timestamp.fromDate(due),
    renewalWindowDays: 30,
    graceDays: 30,
  }
}

export async function POST(req: NextRequest) {
  try {
    // 认证：必须是管理员
    const authz = req.headers.get("authorization") || ""
    const m = authz.match(/^Bearer\s+(.+)$/i)
    if (!m) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 })
    }
    
    const idToken = m[1]
    const decoded = await adminAuth.verifyIdToken(idToken)
    const isAdmin = decoded.email ? await isAdminEmail(decoded.email) : false
    
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    // 获取请求体（可选：指定要迁移的学员 ID 列表）
    let swimmerIds: string[] | undefined
    try {
      const body = await req.json()
      swimmerIds = body.swimmerIds
    } catch {
      // 如果没有请求体，则迁移所有学员
      swimmerIds = undefined
    }

    // 获取要迁移的学员
    let docs: Array<{ id: string; data: () => Record<string, unknown> }>
    if (swimmerIds && swimmerIds.length > 0) {
      // 迁移指定的学员
      const fetchedDocs = await Promise.all(
        swimmerIds.map(async (id) => {
          const docSnap = await fdb.collection("swimmers").doc(id).get()
          if (!docSnap.exists) return null
          // 创建一个类似 QueryDocumentSnapshot 的对象
          return {
            id: docSnap.id,
            data: () => docSnap.data() || {},
          }
        })
      )
      docs = fetchedDocs.filter((d): d is { id: string; data: () => Record<string, unknown> } => d !== null)
    } else {
      // 获取所有学员
      const swimmersSnapshot = await fdb.collection("swimmers").get()
      docs = swimmersSnapshot.docs.map(doc => ({
        id: doc.id,
        data: () => doc.data() || {},
      }))
    }
    
    const results = {
      total: docs.length,
      migrated: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; error: string }>,
    }

    // 批量处理（控制并发）
    const batchSize = 50
    
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (docSnap: { id: string; data: () => Record<string, unknown> }) => {
          try {
            const id = docSnap.id
            const data = docSnap.data() || {}
            
            // 检查是否需要迁移（缺少必要字段）
            const needsMigration =
              !data.registrationAnchorDate ||
              !data.currentPeriodStart ||
              !data.currentPeriodEnd ||
              !data.nextDueDate
            
            // 检查是否需要设置 paymentStatus
            const needsPaymentStatus = !data.paymentStatus
            
            if (!needsMigration && !needsPaymentStatus) {
              results.skipped++
              return
            }
            
            // 推断是否已付费
            const isPaid = await inferPaid(id, data)
            
            // 选择锚定日期并构建会员期
            const anchor = pickAnchorDate(data)
            const coverage = buildCoverageFromAnchor(anchor)
            
            // 构建更新补丁
            const patch: Record<string, unknown> = {
              updatedAt: FieldValue.serverTimestamp(),
            }
            
            // 如果需要迁移日期字段
            if (needsMigration) {
              Object.assign(patch, coverage)
            }
            
            // 如果需要设置付费状态
            if (needsPaymentStatus) {
              patch.paymentStatus = isPaid ? "paid" : "pending"
            }
            
            // 更新文档
            await fdb.collection("swimmers").doc(id).update(patch)
            results.migrated++
          } catch (error: unknown) {
            results.errors.push({
              id: docSnap.id,
              error: error instanceof Error ? error.message : "Unknown error",
            })
          }
        })
      )
    }

    return NextResponse.json({
      ok: true,
      results,
    })
  } catch (error: unknown) {
    console.error("Migration error:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    )
  }
}
