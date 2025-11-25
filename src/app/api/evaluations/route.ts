import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Evaluation } from "@/types/evaluation"
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

// GET: 获取评估列表
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const swimmerId = searchParams.get("swimmerId")

    // 如果是查询特定 swimmer 的评估，允许公开访问（家长可以查看自己孩子的）
    // 注意：swimmerId 是随机的 Firestore ID，不容易被猜测，提供基本的安全
    if (swimmerId) {
      try {
        const evaluationsRef = adminDb.collection("evaluations")
        // 先尝试带 orderBy 的查询
        let snap
        try {
          const q = evaluationsRef.where("swimmerId", "==", swimmerId).orderBy("evaluatedAt", "desc")
          snap = await q.get()
        } catch (orderByError) {
          // 如果 orderBy 失败（可能缺少索引），则只使用 where
          console.warn("orderBy failed, using where only:", orderByError)
          const q = evaluationsRef.where("swimmerId", "==", swimmerId)
          snap = await q.get()
        }
        
        const evaluations = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        
        // 如果没有使用 orderBy，在内存中排序
        if (evaluations.length > 0 && evaluations[0].evaluatedAt) {
          evaluations.sort((a, b) => {
            const aDate = a.evaluatedAt?.toDate ? a.evaluatedAt.toDate().getTime() : new Date(a.evaluatedAt || 0).getTime()
            const bDate = b.evaluatedAt?.toDate ? b.evaluatedAt.toDate().getTime() : new Date(b.evaluatedAt || 0).getTime()
            return bDate - aDate // 降序
          })
        }
        
        return NextResponse.json({ ok: true, evaluations })
      } catch (err) {
        console.error("Error fetching evaluations for swimmer:", err)
        return NextResponse.json({ ok: false, error: "Failed to fetch evaluations" }, { status: 500 })
      }
    }

    // 获取所有评估需要 admin 权限
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const evaluationsRef = adminDb.collection("evaluations")
    const snap = await evaluationsRef.orderBy("evaluatedAt", "desc").limit(100).get()
    const evaluations = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))

    return NextResponse.json({ ok: true, evaluations })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("GET evaluations error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// POST: 创建新评估
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

    const data = (await req.json()) as Omit<Evaluation, "id" | "createdAt">
    
    // 验证必需字段
    if (!data.swimmerId || !data.templateId || !data.categoryScores || !data.overallComments) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const evaluationData = {
      ...data,
      // 使用前端传来的 evaluatedBy（教练名字），如果没有则使用邮箱
      evaluatedBy: data.evaluatedBy || decoded.email || decoded.uid,
      evaluatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection("evaluations").add(evaluationData)

    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("POST evaluation error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

