// app/api/clinic/register/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "prime.swim.us@gmail.com";

/** 安全：允许的来源 */
const ORIGIN_ALLOWLIST = [
  "https://primeswimacademy.com",
  "https://www.primeswimacademy.com",
  "http://localhost:3000",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StrokeTime {
  stroke: string;
  distance: string;
  time: string;
}

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

  // Stroke Times
  strokeTimes?: StrokeTime[];

  // Additional Information
  hasCompetitionExperience?: boolean;
  competitionDetails?: string;
  goals?: string;
  specialNeeds?: string;

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

    // Validate and clean stroke times
    const strokeTimes: StrokeTime[] = [];
    if (Array.isArray(payload.strokeTimes)) {
      for (const st of payload.strokeTimes) {
        if (st.stroke && st.distance && st.time && st.time.trim()) {
          strokeTimes.push({
            stroke: norm(st.stroke, 50),
            distance: norm(st.distance, 20),
            time: norm(st.time, 20),
          });
        }
      }
    }

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

      // Stroke Times
      strokeTimes,

      // Additional Information
      hasCompetitionExperience,
      competitionDetails,
      goals,
      specialNeeds,

      // Metadata
      submittedAt: Timestamp.now(),
      status: "pending", // pending, reviewed, accepted, rejected
    };

    await adminDb.collection("clinicRegistrations").doc(docId).set(registrationData, { merge: true });

    // 5) 发送确认邮件给家长（同时CC到admin邮箱）
    try {
      const childFullName = `${childFirstName} ${childLastName}`;
      const parentFullName = `${parentFirstName} ${parentLastName}`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Prime Swim Academy</h1>
          </div>
          
          <div style="background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #334155; margin-top: 0;">
              Dear ${parentFullName},
            </p>
            
            <p style="font-size: 16px; color: #334155; line-height: 1.6;">
              Thank you for registering <strong>${childFullName}</strong> for our Clinic program. We have received your registration and will review it carefully.
            </p>
            
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 15px; color: #1e40af; font-weight: 600;">
                Important: Spots are limited and will be filled on a first-come, first-served basis.
              </p>
            </div>
            
            <p style="font-size: 16px; color: #334155; line-height: 1.6;">
              Our team will review your registration and notify you of the result as soon as possible. Please note that due to high demand, we recommend responding promptly if you receive an acceptance notification.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 14px; color: #64748b; margin: 0;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              <p style="font-size: 14px; color: #64748b; margin: 10px 0 0 0;">
                Best regards,<br>
                <strong>Prime Swim Academy Team</strong>
              </p>
            </div>
          </div>
        </div>
      `;

      await resend.emails.send({
        from: "Prime Swim Academy <noreply@primeswimacademy.com>",
        to: parentEmail,
        cc: [ADMIN_EMAIL],
        subject: `Clinic Registration Received - ${childFullName}`,
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

