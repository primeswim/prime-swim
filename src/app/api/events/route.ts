import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Event } from "@/types/event"
import { FieldValue, Timestamp } from "firebase-admin/firestore"

export const runtime = "nodejs"

// 检查是否为 admin
async function isInAdminsServer(email?: string | null, uid?: string | null) {
  const e = (email || "").trim().toLowerCase()
  const u = uid || undefined
  const colNames = ["admin", "admins"]

  for (const col of colNames) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get()
      if (byEmail.exists) return true
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get()
      if (byUid.exists) return true
    }
  }
  for (const col of colNames) {
    if (e) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get()
      if (!snap.empty) return true
    }
  }
  return false
}

// GET: 获取事件列表
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status") // "upcoming" | "past" | "all"
    const publishedOnly = searchParams.get("publishedOnly") === "true"

    const eventsRef = adminDb.collection("events")
    let query: FirebaseFirestore.Query = eventsRef

    // 如果只获取已发布的，需要admin权限验证
    if (publishedOnly) {
      // 公开访问，只返回已发布且未归档的事件
      query = eventsRef.where("isPublished", "==", true).where("isArchived", "==", false)
    } else {
      // 获取所有事件需要admin权限
      const authHeader = req.headers.get("authorization") || ""
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
      if (!idToken) {
        return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 })
      }

      const decoded = await getAuth().verifyIdToken(idToken)
      const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
      if (!isAdmin) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
      }
    }

    // 按类别筛选
    if (category) {
      query = query.where("category", "==", category) as FirebaseFirestore.Query
    }

    // 获取数据
    let snap
    try {
      snap = await query.orderBy("startDate", "asc").get()
    } catch (orderByError) {
      // 如果orderBy失败，使用where查询然后内存排序
      console.warn("orderBy failed, using in-memory sort:", orderByError)
      snap = await query.get()
    }

    let events = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Array<Event & { startDate?: string | Date; endDate?: string | Date; createdAt?: Timestamp | Date | { toDate?: () => Date }; updatedAt?: Timestamp | Date | { toDate?: () => Date } }>

    // 如果没有使用orderBy，在内存中排序
    if (events.length > 0) {
      events.sort((a, b) => {
        const aDate = new Date(a.startDate || 0).getTime()
        const bDate = new Date(b.startDate || 0).getTime()
        return aDate - bDate
      })
    }

    // 按状态筛选（如果指定）
    if (status && status !== "all") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      events = events.filter((event) => {
        if (event.isArchived) {
          return status === "past"
        }

        const startDate = new Date(event.startDate || 0)
        startDate.setHours(0, 0, 0, 0)
        const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate || 0)
        endDate.setHours(23, 59, 59, 999)

        if (status === "upcoming") {
          // Include both current and upcoming events
          return endDate >= today
        } else if (status === "past") {
          return endDate < today
        }
        return true
      })
    }

    return NextResponse.json({ ok: true, events })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("GET events error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// POST: 创建新事件
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const data = (await req.json()) as Omit<Event, "id" | "createdAt" | "updatedAt">

    // 验证必需字段
    if (!data.title || !data.category || !data.startDate || !data.description) {
      return NextResponse.json({ ok: false, error: "Missing required fields: title, category, startDate, description" }, { status: 400 })
    }

    const eventData = {
      ...data,
      createdBy: decoded.email || decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection("events").add(eventData)

    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("POST event error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

