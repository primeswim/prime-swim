// app/api/membership/create-payment/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getApps, initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { DEFAULT_AMOUNT_CENTS } from "@/lib/membership"

// —— 初始化 Admin SDK（按你的项目实际方式来）
if (!getApps().length) {
  initializeApp({
    // 如果你用环境变量 SA，则省略 cert；否则按需配置
  } as any)
}
const fauth = getAuth()
const fdb = getFirestore()

type Body = {
  swimmerId: string
  flow: "renew" // 家长端只走 renew
  method: "zelle"
}

export async function POST(req: NextRequest) {
  try {
    // 1) 认证：必须有 Bearer
    const authz = req.headers.get("authorization") || ""
    const m = authz.match(/^Bearer\s+(.+)$/i)
    if (!m) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 })
    const idToken = m[1]
    const decoded = await fauth.verifyIdToken(idToken)
    const uid = decoded.uid
    const isAdmin = decoded.email ? await isAdminEmail(decoded.email) : false

    // 2) 参数
    const body: Body = await req.json()
    const { swimmerId, flow, method } = body || {}
    if (!swimmerId || flow !== "renew" || method !== "zelle") {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 })
    }

    // 3) 读取 swimmer，做**归属校验**
    const sref = fdb.collection("swimmers").doc(swimmerId)
    const ssnap = await sref.get()
    if (!ssnap.exists) return NextResponse.json({ ok: false, error: "SWIMMER_NOT_FOUND" }, { status: 404 })
    const sdata = ssnap.data() || {}

    // 只有本人或管理员允许创建续费
    if (!isAdmin && sdata.parentUID !== uid) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 })
    }

    // 4) 业务限制：冻结禁止续费；有 pending 则复用/拒绝新建
    if (sdata.isFrozen) {
      return NextResponse.json({ ok: false, error: "FROZEN_ACCOUNT" }, { status: 400 })
    }

    const pendingQs = await fdb
      .collection("payments")
      .where("swimmerId", "==", swimmerId)
      .where("status", "==", "pending")
      .limit(1)
      .get()

    if (!pendingQs.empty) {
      const doc0 = pendingQs.docs[0]
      // 也可以直接返回 pending 的 payment 让前端跳转
      return NextResponse.json({
        ok: true,
        paymentId: doc0.id,
        redirectUrl: `/zelle-payment?paymentId=${encodeURIComponent(doc0.id)}`
      })
    }

    // 5) 创建新的 payment（pending）
    const amountCents = Number.isFinite(sdata.amountCents) ? sdata.amountCents : DEFAULT_AMOUNT_CENTS
    const pref = await fdb.collection("payments").add({
      swimmerId,
      parentUID: sdata.parentUID,
      method,            // "zelle"
      flow,              // "renew"
      status: "pending",
      amountCents,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    })

    // 6) 返回跳转目标（前端优先用 redirectUrl）
    return NextResponse.json({
      ok: true,
      paymentId: pref.id,
      redirectUrl: `/zelle-payment?paymentId=${encodeURIComponent(pref.id)}`
    })
  } catch (e: any) {
    console.error("create-payment failed:", e)
    return NextResponse.json({ ok: false, error: "INTERNAL" }, { status: 500 })
  }
}

// 简单的“是否 admin”判定：看 admin 集合里是否有该邮箱（与 admin/swimmers 页一致）
async function isAdminEmail(email: string): Promise<boolean> {
  try {
    const snap = await getFirestore().collection("admin").doc(email).get()
    return snap.exists
  } catch {
    return false
  }
}
