// app/api/clinic/register/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "prime.swim.us@gmail.com";
const FROM_EMAIL =
  process.env.SEND_FROM_EMAIL || "Prime Swim Academy <noreply@primeswimacademy.com>";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapWithTemplate(subject: string, htmlContent: string) {
  // Use the same header style as tuition email template with logo
  const wechatQrUrl = "https://www.primeswimacademy.com/images/wechatlogo.JPG";
  const contactEmail = "prime.swim.us@gmail.com";
  
  const footer = `
    <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
      <div style="color:#475569;font-size:14px;line-height:1.8;">
        <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">Questions? We're here to help!</p>
        <p style="margin:0 0 8px 0;">
          📧 Email us at: <a href="mailto:${contactEmail}" style="color:#1e40af;text-decoration:none;font-weight:500;">${contactEmail}</a>
        </p>
        <p style="margin:0 0 16px 0;">
          💬 Or scan our WeChat QR code:
        </p>
        <div style="text-align:center;margin:16px 0;">
          <img src="${wechatQrUrl}" alt="WeChat QR Code" style="width:120px;height:120px;border:2px solid #e2e8f0;border-radius:8px;display:block;margin:0 auto;" />
        </div>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#1e293b;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%)}
    .container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border-radius:12px;overflow:hidden}
    .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 30px;text-align:center;color:#fff}
    .logo{width:80px;height:80px;background:rgba(255,255,255,.15);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:36px}
    .content{padding:40px 30px}
    .footer-section{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;padding:35px 30px;text-align:center}
    .footer-section p{margin:8px 0;opacity:.9}
    .footer-section strong{font-size:18px;font-weight:700}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width: 100%; height: 100%; border-radius: 50%;" />
      </div>
      <h1 style="font-size:28px;font-weight:700;margin-bottom:8px;">Prime Swim Academy</h1>
      <p style="font-size:16px;opacity:.9;font-weight:300;">Excellence in Aquatic Education</p>
    </div>
    <div class="content">
      ${htmlContent}
      ${footer}
    </div>
    <div class="footer-section">
      <p><strong>Prime Swim Academy</strong></p>
      <p style="font-size:12px;opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/** 安全：允许的来源 */
const ORIGIN_ALLOWLIST = [
  "https://primeswimacademy.com",
  "https://www.primeswimacademy.com",
  "http://localhost:3000",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ClinicRegistrationPayload {
  // Basic Information
  childFirstName?: string;
  childLastName?: string;
  dateOfBirth?: string;
  gender?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;

  // Swimming Background
  currentTeam?: string;
  yearsOfSwimming?: number;
  currentLevel?: string;
  hasReferral?: boolean;
  referralSource?: string;

  // Additional Information
  hasCompetitionExperience?: boolean;
  competitionDetails?: string;
  goals?: string;
  specialNeeds?: string;

  clinicId?: string;
  submittedAt?: string;
}

/** --------- 小工具 --------- */
function norm(s: unknown, max = 200) {
  return String(s ?? "").trim().slice(0, max);
}

function normalizePhone(p?: string) {
  const digits = String(p ?? "").replace(/[^\d]/g, "");
  return digits;
}

function generateId(email: string, childFirstName: string, childLastName: string) {
  const timestamp = Date.now();
  const k = `${email.toLowerCase()}__${childFirstName.toLowerCase()}__${childLastName.toLowerCase()}__${timestamp}`;
  return k.replace(/[^a-z0-9_\-:@.]/gi, "_").slice(0, 300);
}

/** --------- 主处理 --------- */
export async function POST(request: Request) {
  try {
    // 1) 来源校验（防 CSRF）
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const okOrigin =
      (origin && ORIGIN_ALLOWLIST.some((o) => origin.includes(o))) ||
      (referer && ORIGIN_ALLOWLIST.some((o) => referer.includes(o)));
    
    // Allow localhost for development
    if (!okOrigin && !origin?.includes("localhost")) {
      console.warn("Origin check failed:", { origin, referer });
      // Still allow in development, but log warning
    }

    // 2) 解析数据
    const payload = (await request.json()) as ClinicRegistrationPayload;

    // 3) 字段验证
    const childFirstName = norm(payload.childFirstName, 100);
    const childLastName = norm(payload.childLastName, 100);
    const dateOfBirth = norm(payload.dateOfBirth);
    const gender = norm(payload.gender, 50);
    const parentFirstName = norm(payload.parentFirstName, 100);
    const parentLastName = norm(payload.parentLastName, 100);
    const parentEmail = norm(payload.parentEmail).toLowerCase();
    const parentPhoneRaw = normalizePhone(payload.parentPhone);
    const currentTeam = norm(payload.currentTeam, 200);
    const yearsOfSwimming = typeof payload.yearsOfSwimming === "number" ? payload.yearsOfSwimming : 0;
    const currentLevel = norm(payload.currentLevel, 100);
    const hasReferral = payload.hasReferral === true;
    const referralSource = hasReferral ? norm(payload.referralSource, 200) : "";
    const hasCompetitionExperience = payload.hasCompetitionExperience === true;
    const competitionDetails = norm(payload.competitionDetails, 1000);
    const goals = norm(payload.goals, 1000);
    const specialNeeds = norm(payload.specialNeeds, 1000);

    // Validate required fields
    if (!childFirstName || !childLastName || !dateOfBirth || !gender) {
      return NextResponse.json({ error: "Missing required child information" }, { status: 400 });
    }

    if (!parentFirstName || !parentLastName || !parentEmail || !parentPhoneRaw) {
      return NextResponse.json({ error: "Missing required parent information" }, { status: 400 });
    }

    if (!EMAIL_RE.test(parentEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (parentPhoneRaw.length < 10 || parentPhoneRaw.length > 15) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    if (!currentTeam || !currentLevel) {
      return NextResponse.json({ error: "Missing required swimming background information" }, { status: 400 });
    }

    // Validate level is from advanced levels (not beginner levels)
    const validLevels = ["Intermediate", "Advanced", "Competitive", "Elite/National Level", "College/University"];
    if (!validLevels.includes(currentLevel)) {
      return NextResponse.json({ error: "Invalid level. Clinic is for intermediate to advanced swimmers only." }, { status: 400 });
    }

    if (hasReferral && !referralSource) {
      return NextResponse.json({ error: "Referral source required when hasReferral is true" }, { status: 400 });
    }

    const clinicId = norm(payload.clinicId, 100);

    // 4) 保存到数据库
    const docId = generateId(parentEmail, childFirstName, childLastName);
    const registrationData: Record<string, unknown> = {
      // Basic Information
      childFirstName,
      childLastName,
      dateOfBirth,
      gender,
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone: parentPhoneRaw,

      // Swimming Background
      currentTeam,
      yearsOfSwimming,
      currentLevel,
      hasReferral,
      referralSource,

      // Additional Information
      hasCompetitionExperience,
      competitionDetails,
      goals,
      specialNeeds,

      // Metadata
      clinicId: clinicId || null,
      submittedAt: Timestamp.now(),
      status: "pending", // pending, reviewed, accepted, rejected
    };

    await adminDb.collection("clinicRegistrations").doc(docId).set(registrationData, { merge: true });

    // 5) 发送确认邮件给家长（同时CC到admin邮箱）
    try {
      const childFullName = `${childFirstName} ${childLastName}`;
      const parentFullName = `${parentFirstName} ${parentLastName}`;

      const subject = `Clinic Registration Received - ${childFullName}`;
      const bodyHtml = `
        <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#0f172a;">
          Dear ${escapeHtml(parentFullName)},
        </p>
        <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#0f172a;">
          Thank you for registering <strong>${escapeHtml(childFullName)}</strong> for our Clinic program. We've received your registration and will review it carefully.
        </p>
        <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:16px 18px;margin:16px 0;">
          <p style="margin:0 0 10px 0;font-size:15px;font-weight:600;color:#92400e;">
            ⚠️ Important: This email does not confirm placement.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#78350f;">
            Clinic spots are <strong>very limited</strong> and placement is based on availability (first-come, first-served) and <strong>level matching</strong>. We group swimmers of similar skill levels together to ensure effective training. If we cannot place <strong>${escapeHtml(childFullName)}</strong> due to limited spots or level requirements, we appreciate your understanding.
          </p>
        </div>
        <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#0f172a;">
          We'll notify you of the result after our review. Thank you for your interest and patience.
        </p>
        <p style="margin:0;font-size:16px;line-height:1.6;color:#0f172a;">
          Best regards,<br/>
          <strong>Prime Swim Academy Team</strong>
        </p>
      `;
      const emailHtml = wrapWithTemplate(subject, bodyHtml);

      await resend.emails.send({
        from: FROM_EMAIL,
        to: parentEmail,
        cc: [ADMIN_EMAIL],
        subject,
        html: emailHtml,
      });
    } catch (emailError) {
      // 邮件发送失败不影响注册流程，只记录错误
      console.error("Failed to send confirmation email:", emailError);
    }

    // 6) 返回成功
    return NextResponse.json({
      success: true,
      id: docId,
      message: "Registration submitted successfully",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Clinic registration error:", err);
    return NextResponse.json({ error: msg || "Failed to submit registration" }, { status: 500 });
  }
}


