// app/api/tuition-invoice/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin"; // Admin SDK (server) with Firestore

const resend = new Resend(process.env.RESEND_API_KEY);

// QR image URL
const QR_IMG: string =
  process.env.NEXT_PUBLIC_QR_IMAGE_URL ||
  "https://www.primeswimacademy.com/images/zelle_qr.jpeg";

// Team policy URL (fixed)
const POLICY_URL: string = "https://www.primeswimacademy.com/school-policy";

type Payload = {
  parentName: string;
  parentEmail: string;
  swimmerName: string;
  months: string[];       // e.g. ["September 2025"]
  practiceText: string;   // e.g. "Mon/Wed 7–8 PM at Mary Wayte Pool"
  dueDate: string;        // ISO or readable text
  amount: number;         // e.g. 360
  cc?: string[];
  bccAdmin?: boolean;

  // Extra note to show on its own line, styled like the main reminder paragraph
  afterFeeNote?: string;
};

function fmtDate(d: string) {
  if (!d) return "";

  // Case 1: pure date like "2025-08-31" -> construct as local date (no TZ shift)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) {
    const [, y, mo, day] = m;
    const dtLocal = new Date(Number(y), Number(mo) - 1, Number(day));
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dtLocal);
  }

  // Case 2: ISO with timezone or "Z": render in UTC to avoid shifting to prev day
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(dt);
  }

  // Fallback: return as-is
  return d;
}

function monthsLabel(ms: string[]) {
  if (!ms?.length) return "";
  if (ms.length === 1) return ms[0];
  return `${ms.slice(0, -1).join(", ")} and ${ms.slice(-1)[0]}`;
}
function monthsShort(ms: string[]) {
  return (ms || []).map((m) => m.split(" ")[0]).join("/");
}
function escapeHtml(input: unknown): string {
  const s = String(input ?? "");
  const map: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;", "=": "&#61;", "/": "&#47;",
  };
  return s.replace(/[&<>"'`=\/]/g, (ch) => map[ch] || ch);
}

// 🔒 Server-side Firestore admin check (supports "admin" or "admins" collections)
async function isInAdminsServer(email?: string | null, uid?: string | null) {
  const e = (email || "").trim().toLowerCase();
  const u = uid || undefined;
  const colNames = ["admin", "admins"];

  for (const col of colNames) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get();
      if (byEmail.exists) return true;
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get();
      if (byUid.exists) return true;
    }
  }
  for (const col of colNames) {
    if (e) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get();
      if (!snap.empty) return true;
    }
  }
  return false;
}

async function renderEmailHTML(data: Payload) {
  const shortLabel = monthsShort(data.months || []);
  const safe = {
    parentName: escapeHtml(data.parentName || "Parent/Guardian"),
    parentEmail: escapeHtml(data.parentEmail),
    swimmerName: escapeHtml(data.swimmerName),
    // practiceText: handled separately to support <br/>
    dueDate: escapeHtml(fmtDate(data.dueDate)),
    amount: escapeHtml(String(data.amount)),
    months: escapeHtml(monthsLabel(data.months || [])),
    monthsShort: escapeHtml(shortLabel),
  };

  // ✅ Escape first, then convert newline(s) to <br/> for proper line breaks
  const practiceHtml = escapeHtml(data.practiceText || "Please check with your coach").replace(/\r?\n/g, "<br/>");

  // NEW: sanitize and format extra note; allow line breaks; styled same as main paragraph
  const afterFeeNoteHtml = data.afterFeeNote
    ? escapeHtml(data.afterFeeNote).replace(/\r?\n/g, "<br/>")
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Tuition Reminder - Prime Swim Academy</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#1e293b;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%)}
  .container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border-radius:12px;overflow:hidden}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 30px;text-align:center;color:#fff}
  .logo{width:80px;height:80px;background:rgba(255,255,255,.15);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:36px}
  .content{padding:40px 30px}
  .greeting-message{background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-left:4px solid #1e293b;padding:24px;margin-bottom:30px;border-radius:0 12px 12px 0}
  .tuition-details{background:linear-gradient(135deg,#f8fafc 0%,#fff 100%);padding:24px;border-radius:12px;margin:25px 0;border:1px solid #e2e8f0}
  .detail-row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid #e2e8f0}
  .detail-row:last-child{border-bottom:none}
  .amount-highlight{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:1px solid #f59e0b;border-radius:12px;padding:20px;margin:25px 0;text-align:center}
  .payment-methods{background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%);padding:24px;border-radius:12px;margin:25px 0}
  .qr-section{text-align:center;margin:30px 0;padding:20px;background:linear-gradient(135deg,rgba(248,250,252,.8) 0%,rgba(241,245,249,.8) 100%);border-radius:12px;border:1px solid #e2e8f0}
  .qr-img{width:150px;height:150px;background:#fff;border:2px solid #e2e8f0;border-radius:8px;display:block;margin:0 auto;object-fit:contain}
  .footer{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;padding:35px 30px;text-align:center}

  /* Policy highlight block */
  .policy-box{background:linear-gradient(135deg,#eef2ff 0%,#ffffff 100%);padding:24px;border-radius:12px;border:1px solid #c7d2fe;margin:25px 0}
  .policy-box a{color:#4338ca;text-decoration:underline}
  .policy-list{margin:10px 0 0 18px}
  .policy-list li{margin-bottom:8px}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width: 100%; height: 100%; border-radius: 50%;" />
      </div>
      <h1>Prime Swim Academy</h1>
      <p>Tuition Reminder</p>
    </div>

    <div class="content">
      <div class="greeting-message">
        <h2>💳 Tuition Payment Due</h2>
        <p>Hi ${safe.parentName},</p>
      </div>

      <p style="font-size:16px;margin-bottom:24px;color:#475569;">
        This is a friendly reminder that tuition for <strong>${safe.swimmerName}</strong>'s training${safe.months ? ` in <strong>${safe.months}</strong>` : ''} is now due. Please submit payment by <strong>${safe.dueDate}</strong>
        to keep ${safe.swimmerName}'s spot and avoid any interruption in attendance.
        <span style="color:#b91c1c;">
          ⚠️ A $35 late fee will be applied if tuition is not paid by the due date via Zelle, or at the first practice for cash payments.
        </span>
      </p>

      ${
        afterFeeNoteHtml
          // same style & color as the reminder paragraph; separate line
          ? `<p style="font-size:16px;margin:0 0 24px;color:#475569;">${afterFeeNoteHtml}</p>`
          : ""
      }

      <div class="tuition-details">
        <div class="detail-row"><span>Swimmer:</span><span><strong>${safe.swimmerName}</strong></span></div>
        <div class="detail-row"><span>Due Date:</span><span>${safe.dueDate}</span></div>
        <div class="detail-row"><span>Practice Schedule:</span><span>${practiceHtml}</span></div>
        <div class="detail-row"><span>Amount:</span><span><strong>$${safe.amount}</strong></span></div>
      </div>

      <div class="payment-methods">
        <p><strong>How to Pay</strong></p>
        <p>• Scan the QR code below to complete payment.</p>
        <p>• Zelle: <strong>prime.swim.us@gmail.com</strong><br/>
           <em>Memo: “${safe.swimmerName} ${safe.monthsShort} tuition”</em>
        </p>
        <p>• Cash: you may hand it to a coach before practice.</p>
      </div>

      <div class="qr-section">
        <img class="qr-img" src="${QR_IMG}" alt="Payment QR Code" />
        <p style="font-size:12px;color:#64748b;margin-top:8px;">Scan with your phone's camera or payment app</p>
      </div>

      <p style="font-size:16px;margin:25px 0;color:#475569;">
        Once paid, please reply with a quick confirmation (a screenshot is perfect).
        If payment is not received by <strong>${safe.dueDate}</strong>, participation may be paused until the balance is cleared.
      </p>

      <!-- Policy Highlights -->
      <div class="policy-box">
        <p><strong>Make-up & Cancellation Highlights</strong></p>
        <ul class="policy-list">
          <li><strong>Group lessons:</strong> one make-up class is offered each calendar month for missed group lessons. The make-up schedule is posted monthly; advance sign-up is required, space is limited, and make-ups do not roll over or transfer.</li>
          <li><strong>Private lessons:</strong> cancel at least <strong>7 days</strong> in advance (Mary Wayte requires <strong>14 days</strong>). Late cancellations forfeit the session; documented medical emergencies may still incur the lane rental fee.</li>
        </ul>
        <p style="margin-top:12px;">
          Full details: <a href="${POLICY_URL}" target="_blank" rel="noopener noreferrer">Prime Swim Academy Team Policy</a>.
        </p>
      </div>
      <!-- END Policy Highlights -->

    </div>

    <div class="footer">
      <p><strong>Prime Swim Academy</strong></p>
      <p style="font-size:12px;opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  </div>
</body></html>`;
}

export async function POST(req: Request) {
  try {
    // Require Firebase ID token
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded: DecodedIdToken = await getAuth().verifyIdToken(idToken);
    const emailLower = (decoded.email ?? "").toLowerCase();

    // Read custom claim "role" safely (TS doesn't know it exists)
    const rawRole = (decoded as Record<string, unknown>)["role"];
    const hasAdminRole = typeof rawRole === "string" && rawRole.toLowerCase() === "admin";

    // Accept any of: custom claim role=admin, allowlist, or Firestore admins
    const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      hasAdminRole ||
      (emailLower !== "" && allow.includes(emailLower)) ||
      (await isInAdminsServer(decoded.email ?? null, decoded.uid));

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const data = (await req.json()) as Payload;

    const html = await renderEmailHTML(data);
    // 修复标题格式：如果months为空，使用dueDate的月份
    let monthLabel = monthsLabel(data.months);
    if (!monthLabel && data.dueDate) {
      const dueDate = new Date(data.dueDate);
      if (!isNaN(dueDate.getTime())) {
        monthLabel = dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }
    const subject = `Prime Swim Academy - Tuition for ${monthLabel || 'Training'} (Due ${fmtDate(data.dueDate)})`;

    const resp = await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: data.parentEmail,
      cc: data.cc?.length ? data.cc : undefined,
      bcc: data.bccAdmin ? ["prime.swim.us@gmail.com"] : undefined,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, data: resp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tuition-invoice error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
