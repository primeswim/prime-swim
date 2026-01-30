import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Timestamp, FieldValue } from "firebase-admin/firestore"

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

// DELETE: 删除评估
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

    const { id: evaluationId } = await params
    if (!evaluationId) {
      return NextResponse.json({ ok: false, error: "Missing evaluation ID" }, { status: 400 })
    }

    // 检查评估是否存在
    const evaluationRef = adminDb.collection("evaluations").doc(evaluationId)
    const evaluationDoc = await evaluationRef.get()
    
    if (!evaluationDoc.exists) {
      return NextResponse.json({ ok: false, error: "Evaluation not found" }, { status: 404 })
    }

    // 删除评估
    await evaluationRef.delete()

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("DELETE evaluation error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// PUT: 更新评估（仅管理员，主要用于修复日期）
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

    const { id: evaluationId } = await params
    if (!evaluationId) {
      return NextResponse.json({ ok: false, error: "Missing evaluation ID" }, { status: 400 })
    }

    const body = await req.json()
    const updateData: Record<string, unknown> = {}

    // 允许更新 evaluatedAt 日期
    if (body.evaluatedAt !== undefined) {
      let evaluatedAt: Timestamp
      if (body.evaluatedAt instanceof Date) {
        evaluatedAt = Timestamp.fromDate(body.evaluatedAt)
      } else if (typeof body.evaluatedAt === 'string') {
        evaluatedAt = Timestamp.fromDate(new Date(body.evaluatedAt))
      } else if (typeof body.evaluatedAt === 'number') {
        evaluatedAt = Timestamp.fromMillis(body.evaluatedAt)
      } else {
        return NextResponse.json({ ok: false, error: "Invalid evaluatedAt format" }, { status: 400 })
      }
      updateData.evaluatedAt = evaluatedAt
    }

    // 检查评估是否存在
    const evaluationRef = adminDb.collection("evaluations").doc(evaluationId)
    const evaluationDoc = await evaluationRef.get()
    
    if (!evaluationDoc.exists) {
      return NextResponse.json({ ok: false, error: "Evaluation not found" }, { status: 404 })
    }

    // 更新评估
    if (Object.keys(updateData).length > 0) {
      await evaluationRef.update(updateData)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("PUT evaluation error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

