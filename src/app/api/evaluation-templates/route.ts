import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { EvaluationTemplate } from "@/types/evaluation"
import { FieldValue } from "firebase-admin/firestore"

export const runtime = "nodejs"

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

// GET: 获取所有模板
export async function GET() {
  try {
    const templatesRef = adminDb.collection("evaluationTemplates")
    const snap = await templatesRef.orderBy("level").get()
    const templates = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
    return NextResponse.json({ ok: true, templates })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("GET templates error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// POST: 创建新模板
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

    const data = (await req.json()) as Omit<EvaluationTemplate, "id" | "createdAt" | "updatedAt" | "createdBy">
    
    // 详细的验证和错误信息
    if (!data.level) {
      return NextResponse.json({ ok: false, error: "Missing required field: level" }, { status: 400 })
    }
    if (!data.name) {
      return NextResponse.json({ ok: false, error: "Missing required field: name" }, { status: 400 })
    }
    if (!data.categories) {
      return NextResponse.json({ ok: false, error: "Missing required field: categories" }, { status: 400 })
    }
    if (data.categories.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one category is required" }, { status: 400 })
    }
    
    // 验证每个 category 至少有一个 subcategory
    for (let i = 0; i < data.categories.length; i++) {
      const category = data.categories[i]
      if (!category.name) {
        return NextResponse.json({ ok: false, error: `Category ${i + 1} is missing a name` }, { status: 400 })
      }
      if (!category.subcategories) {
        return NextResponse.json({ ok: false, error: `Category "${category.name}" is missing subcategories` }, { status: 400 })
      }
      if (category.subcategories.length === 0) {
        return NextResponse.json({ ok: false, error: `Category "${category.name}" must have at least one subcategory` }, { status: 400 })
      }
      for (let j = 0; j < category.subcategories.length; j++) {
        const subcategory = category.subcategories[j]
        if (!subcategory.name) {
          return NextResponse.json({ ok: false, error: `Subcategory ${j + 1} in category "${category.name}" is missing a name` }, { status: 400 })
        }
      }
    }

    const templateData = {
      ...data,
      createdBy: decoded.email || decoded.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminDb.collection("evaluationTemplates").add(templateData)

    return NextResponse.json({ ok: true, id: docRef.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("POST template error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// PUT: 更新模板
export async function PUT(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const data = (await req.json()) as { id: string } & Partial<EvaluationTemplate>
    
    if (!data.id) {
      return NextResponse.json({ ok: false, error: "Missing template id" }, { status: 400 })
    }

    const { id, ...updateData } = data
    const templateRef = adminDb.collection("evaluationTemplates").doc(id)
    
    await templateRef.update({
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("PUT template error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// DELETE: 删除模板
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid)
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing template id" }, { status: 400 })
    }

    await adminDb.collection("evaluationTemplates").doc(id).delete()

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("DELETE template error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

