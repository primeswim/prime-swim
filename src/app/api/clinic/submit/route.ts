// app/api/clinic/submit/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

/** 邮件通知（可选） */
const resend = new Resend(process.env.RESEND_API_KEY);

/** 安全：允许的来源 */
const ORIGIN_ALLOWLIST = [
  "https://primeswimacademy.com",
  "https://www.primeswimacademy.com",
  "http://localhost:3000",
];

import { SWIMMER_LEVELS, type SwimmerLevel } from "@/lib/swimmer-levels";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVELS = new Set<SwimmerLevel>(SWIMMER_LEVELS);

type Preference = { location: string; selections: string[] };

interface ClinicPayload {
  parentEmail?: string;
  parentPhone?: string;                 // ✅ 接收家长电话
  swimmerName?: string;
  level?: string;                       // in LEVELS
  preferences?: Preference[];
  season?: string;
  website?: string;                     // honeypot
  swimmerId?: string;                   // Optional: ID of registered swimmer
}

/** --------- 小工具 --------- */
function norm(s: unknown, max = 200) {
  return String(s ?? "").trim().slice(0, max);
}
function normalizePhone(p?: string) {
  const digits = String(p ?? "").replace(/[^\d]/g, "");
  return digits; // 存库用纯数字，也可考虑加国家码
}
function deterministicId(season: string, email: string, swimmer: string) {
  const k = `${season}__${email.toLowerCase()}__${swimmer.toLowerCase()}`;
  return k.replace(/[^a-z0-9_\-:@.]/gi, "_").slice(0, 300);
}

/** --------- 简易频率限制（内存） --------- */
const BUCKET: Record<string, { count: number; resetAt: number }> = {};
const WINDOW_MS = 60_000;
const LIMIT = 20;
function rateLimit(key: string) {
  const now = Date.now();
  const b = BUCKET[key];
  if (!b || b.resetAt < now) {
    BUCKET[key] = { count: 1, resetAt: now + WINDOW_MS };
    return true;
  }
  if (b.count >= LIMIT) return false;
  b.count += 1;
  return true;
}

/** --------- 主处理 --------- */
export async function POST(request: Request) {
  try {
    // 1) 来源校验（防 CSRF）
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const okOrigin =
      (origin && ORIGIN_ALLOWLIST.includes(origin)) ||
      (referer && ORIGIN_ALLOWLIST.some((o) => referer.startsWith(o)));
    if (!okOrigin) {
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    }

    // 2) 解析与限流
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null;
    const payload = (await request.json()) as ClinicPayload;
    const rlKey = `clinic:${ip || "noip"}:${payload.parentEmail || "noemail"}`;
    if (!rateLimit(rlKey)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 3) Honeypot
    if (payload.website) {
      return NextResponse.json({ success: true });
    }

    // 4) 字段严校验（✅ 包含 phone）
    const parentEmail = norm(payload.parentEmail);
    const parentPhoneRaw = normalizePhone(payload.parentPhone);
    const swimmerName = norm(payload.swimmerName, 120);
    const level = norm(payload.level, 80);
    const season = norm(payload.season || "Winter Break 2025–26", 80);
    const preferences = Array.isArray(payload.preferences) ? payload.preferences : [];

    if (!EMAIL_RE.test(parentEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!parentPhoneRaw || parentPhoneRaw.length < 10 || parentPhoneRaw.length > 15) {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    }
    if (!LEVELS.has(level as SwimmerLevel)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    if (!swimmerName) {
      return NextResponse.json({ error: "Invalid swimmerName" }, { status: 400 });
    }
    if (preferences.length === 0) {
      return NextResponse.json({ error: "No preferences" }, { status: 400 });
    }

    // 统一清洗后的 preferences（避免超长/非法字符）
    const safePrefs = preferences.slice(0, 100).map((p) => ({
      location: norm(p.location, 120),
      selections: Array.isArray(p.selections)
        ? p.selections.slice(0, 200).map((s) => norm(s, 160))
        : [],
    }));

    // 5) 幂等写库（✅ 保存 parentPhone 和 swimmerId）
    const docId = deterministicId(season, parentEmail, swimmerName);
    const submissionData: Record<string, unknown> = {
      parentEmail,
      parentPhone: parentPhoneRaw,    // ✅ 关键：写入 phone 字段
      swimmerName,
      level,
      preferences: safePrefs,
      season,
      submittedAt: Timestamp.now(),
    };
    
    // Add swimmerId if provided (for registered swimmers)
    if (payload.swimmerId) {
      submissionData.swimmerId = payload.swimmerId;
    }
    
    await adminDb.collection("clinicSubmissions").doc(docId).set(
      submissionData,
      { merge: true }
    );

    // 6) 邮件通知（可选）
    try {
      await resend.emails.send({
        from: "Prime Swim Academy <noreply@primeswimacademy.com>",
        to: "prime.swim.us@gmail.com",
        subject: "*** New Activity Submission ***",
        html: `
          <h2>New Activity Submission</h2>
          <p><strong>Parent Email:</strong> ${parentEmail}</p>
          <p><strong>Parent Phone:</strong> ${parentPhoneRaw}</p>
          <p><strong>Swimmer:</strong> ${swimmerName}</p>
          <p><strong>Level:</strong> ${level}</p>
          <p><strong>Season:</strong> ${season}</p>
          <hr/>
          <p><strong>Preferences:</strong></p>
          <ul>
            ${safePrefs
              .map(
                (p) =>
                  `<li><b>${p.location}</b>: ${
                    p.selections.map((s) => s).join(", ")
                  }</li>`
              )
              .join("")}
          </ul>
        `,
      });
    } catch {
      // 邮件失败不影响主流程
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Clinic submit error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
