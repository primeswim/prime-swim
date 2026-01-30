import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Evaluation } from "@/types/evaluation"
import { FieldValue, Timestamp } from "firebase-admin/firestore"

// Helper function to convert Firestore Timestamp to milliseconds
function timestampToMillis(ts: unknown): number | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  if (typeof ts === 'object' && ts !== null) {
    // Firestore Timestamp object
    if ('toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
      return (ts as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().getTime();
    }
    // Serialized format: {_seconds, _nanoseconds}
    if ('_seconds' in ts && typeof (ts as { _seconds: number })._seconds === 'number') {
      return (ts as { _seconds: number })._seconds * 1000;
    }
  }
  return null;
}

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
        // 先尝试带 orderBy 的查询（升序，最早的在前）
        let snap
        try {
          const q = evaluationsRef.where("swimmerId", "==", swimmerId).orderBy("evaluatedAt", "asc")
          snap = await q.get()
        } catch (orderByError) {
          // 如果 orderBy 失败（可能缺少索引），则只使用 where
          console.warn("orderBy failed, using where only:", orderByError)
          const q = evaluationsRef.where("swimmerId", "==", swimmerId)
          snap = await q.get()
        }
        
        const evaluations = snap.docs.map((d) => {
          const data = d.data();
          // Convert Firestore Timestamps to milliseconds for JSON serialization
          const evaluatedAtMillis = timestampToMillis(data.evaluatedAt);
          const createdAtMillis = timestampToMillis(data.createdAt);
          
          return {
            id: d.id,
            ...data,
            evaluatedAt: evaluatedAtMillis || createdAtMillis, // Use createdAt as fallback
            createdAt: createdAtMillis,
          };
        }) as Array<{ id: string; evaluatedAt?: number | null; createdAt?: number | null; [key: string]: unknown }>
        
        // 如果没有使用 orderBy，在内存中排序（升序，最早的在前）
        if (evaluations.length > 0) {
          evaluations.sort((a, b) => {
            const aDate = (a.evaluatedAt as number) || (a.createdAt as number) || 0;
            const bDate = (b.evaluatedAt as number) || (b.createdAt as number) || 0;
            return aDate - bDate; // 升序（最早的在前）
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
    let snap
    try {
      const q = evaluationsRef.orderBy("evaluatedAt", "desc").limit(100)
      snap = await q.get()
    } catch (orderByError) {
      // If orderBy fails, get all and sort in memory
      console.warn("orderBy failed, using memory sort:", orderByError)
      snap = await evaluationsRef.limit(100).get()
    }
    
    const evaluations = snap.docs.map((d) => {
      const data = d.data();
      // Convert Firestore Timestamps to milliseconds for JSON serialization
      const evaluatedAtMillis = timestampToMillis(data.evaluatedAt);
      const createdAtMillis = timestampToMillis(data.createdAt);
      
      return {
        id: d.id,
        ...data,
        evaluatedAt: evaluatedAtMillis || createdAtMillis, // Use createdAt as fallback
        createdAt: createdAtMillis,
      };
    }) as Array<{ id: string; evaluatedAt?: number | null; createdAt?: number | null; [key: string]: unknown }>
    
    // Sort in memory if orderBy failed
    if (evaluations.length > 0) {
      evaluations.sort((a, b) => {
        const aDate = (a.evaluatedAt as number) || (a.createdAt as number) || 0;
        const bDate = (b.evaluatedAt as number) || (b.createdAt as number) || 0;
        return bDate - aDate; // Descending for admin view
      })
    }

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

    // 直接使用 createdAt 作为 evaluatedAt（不覆盖）
    const createdAt = FieldValue.serverTimestamp()
    
    const evaluationData = {
      ...data,
      // 使用前端传来的 evaluatedBy（教练名字），如果没有则使用邮箱
      evaluatedBy: data.evaluatedBy || decoded.email || decoded.uid,
      // evaluatedAt 直接使用 createdAt（在读取时会自动使用 createdAt 作为后备）
      evaluatedAt: createdAt,
      createdAt,
    }

    const docRef = await adminDb.collection("evaluations").add(evaluationData)

    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("POST evaluation error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

