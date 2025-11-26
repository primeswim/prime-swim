import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Event } from "@/types/event"
import { FieldValue } from "firebase-admin/firestore"

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

// GET: 获取单个事件
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const publishedOnly = searchParams.get("publishedOnly") === "true"
    
    const eventDoc = await adminDb.collection("events").doc(id).get()

    if (!eventDoc.exists) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 })
    }

    const eventData = eventDoc.data()
    const event = {
      id: eventDoc.id,
      ...eventData,
    } as Event & { isPublished?: boolean }

    // 如果只获取已发布的事件，且事件未发布，返回404
    if (publishedOnly && !event.isPublished) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 })
    }

    // 如果是未发布的事件，需要admin权限
    if (!event.isPublished && !publishedOnly) {
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

    return NextResponse.json({ ok: true, event })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("GET event error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// PUT: 更新事件
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const { id } = await params
    const data = (await req.json()) as Partial<Event>

    // 检查事件是否存在
    const eventRef = adminDb.collection("events").doc(id)
    const eventDoc = await eventRef.get()
    
    if (!eventDoc.exists) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 })
    }

    // 更新事件
    await eventRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("PUT event error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// DELETE: 删除事件
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const { id } = await params

    // 检查事件是否存在
    const eventRef = adminDb.collection("events").doc(id)
    const eventDoc = await eventRef.get()
    
    if (!eventDoc.exists) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 })
    }

    // 删除事件
    await eventRef.delete()

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("DELETE event error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

