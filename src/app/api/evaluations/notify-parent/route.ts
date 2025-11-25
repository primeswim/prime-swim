import { NextResponse } from "next/server"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebaseAdmin"
import { Resend } from "resend"

export const runtime = "nodejs"

const resend = new Resend(process.env.RESEND_API_KEY)

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

function escapeHtml(input: unknown): string {
  const s = String(input ?? "")
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return s.replace(/[&<>"']/g, (ch) => map[ch] || ch)
}

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

    const { evaluationId, swimmerId, parentEmail, swimmerName } = await req.json()

    if (!evaluationId || !swimmerId || !parentEmail || !swimmerName) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    // 获取评估详情
    const evalDoc = await adminDb.collection("evaluations").doc(evaluationId).get()
    if (!evalDoc.exists) {
      return NextResponse.json({ ok: false, error: "Evaluation not found" }, { status: 404 })
    }

    const evaluation = evalDoc.data()
    const evaluationUrl = `https://www.primeswimacademy.com/evaluations/${swimmerId}`

    // 构建邮件 HTML
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>New Evaluation Available - Prime Swim Academy</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#1e293b;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%)}
    .container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border-radius:12px;overflow:hidden}
    .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 30px;text-align:center;color:#fff}
    .logo{width:80px;height:80px;background:rgba(255,255,255,.15);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:36px}
    .content{padding:40px 30px}
    .greeting-message{background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-left:4px solid #1e293b;padding:24px;margin-bottom:30px;border-radius:0 12px 12px 0}
    .cta-button{display:inline-block;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;margin:20px 0;transition:transform 0.2s}
    .cta-button:hover{transform:translateY(-2px)}
    .info-box{background:linear-gradient(135deg,#eef2ff 0%,#ffffff 100%);padding:24px;border-radius:12px;border:1px solid #c7d2fe;margin:25px 0}
    .footer{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;padding:35px 30px;text-align:center}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width: 100%; height: 100%; border-radius: 50%;" />
      </div>
      <h1>Prime Swim Academy</h1>
      <p>New Evaluation Available</p>
    </div>

    <div class="content">
      <div class="greeting-message">
        <h2>📊 New Evaluation Ready</h2>
        <p>Hi there,</p>
      </div>

      <p style="font-size:16px;margin-bottom:24px;color:#475569;">
        We're excited to share that a new evaluation for <strong>${escapeHtml(swimmerName)}</strong> is now available!
      </p>

      <div class="info-box">
        <p style="margin-bottom:12px;"><strong>Evaluation Details:</strong></p>
        <p style="margin-bottom:8px;">• <strong>Swimmer:</strong> ${escapeHtml(swimmerName)}</p>
        <p style="margin-bottom:8px;">• <strong>Level:</strong> ${escapeHtml(evaluation?.level || "N/A")}</p>
        <p style="margin-bottom:8px;">• <strong>Date:</strong> ${new Date(evaluation?.evaluatedAt?.toDate?.() || evaluation?.evaluatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${evaluation?.coachRecommendation?.levelUp ? `<p style="margin-bottom:8px;color:#059669;font-weight:600;">• 🎉 <strong>Level Up Recommended!</strong> ${evaluation.coachRecommendation.recommendedLevel ? `Recommended for: ${escapeHtml(evaluation.coachRecommendation.recommendedLevel)}` : ''}</p>` : ''}
      </div>

      <p style="font-size:16px;margin:25px 0;color:#475569;">
        You can now view the complete evaluation, including detailed skill assessments, coach comments, and progress tracking, on your dashboard.
      </p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${evaluationUrl}" class="cta-button">View Evaluation</a>
      </div>

      <p style="font-size:14px;margin-top:30px;color:#64748b;">
        If you have any questions about the evaluation, please don't hesitate to reach out to us.
      </p>
    </div>

    <div class="footer">
      <p><strong>Prime Swim Academy</strong></p>
      <p style="font-size:12px;opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `

    // 发送邮件
    const emailResponse = await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: parentEmail,
      subject: `📊 New Evaluation Available for ${swimmerName} - Prime Swim Academy`,
      html: emailHtml,
    })

    return NextResponse.json({ ok: true, data: emailResponse })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("Notify parent error:", err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

