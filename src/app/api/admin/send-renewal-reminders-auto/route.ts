// src/app/api/admin/send-renewal-reminders-auto/route.ts
// Automatic renewal reminder sender for due_soon and grace swimmers
// Can be called manually or scheduled via Vercel Cron Jobs

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  computeStatus,
  deriveCoverageFromAnchor,
} from "@/lib/membership";

// ===== Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// ===== Admin SDK init
const projectId = process.env.FIREBASE_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}
const adminAuth = getAuth();
const adminDb = getFirestore();

// ===== Helpers (reuse from send-renewal-reminder)
function fmtDate(d?: string | Date | null) {
  if (!d) return "-";
  const dd = typeof d === "string" ? new Date(d) : d;
  return dd.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

type TemplateKind = "due_soon" | "grace" | "inactive";

function subjectFor(kind: TemplateKind, swimmerName: string, nextDueDate?: string | Date | null) {
  const dateStr = nextDueDate ? fmtDate(nextDueDate) : "";
  if (kind === "due_soon") return `⏰ Action needed: ${swimmerName}'s membership is due by ${dateStr}`;
  if (kind === "grace") return `⚠️ Past due: ${swimmerName}'s membership (grace period in effect)`;
  return `👋 Rejoin Prime Swim Academy for ${swimmerName}`;
}

// Build email HTML (same template as send-renewal-reminder)
function buildEmailHtml(params: {
  parentName?: string;
  parentEmail: string;
  swimmerName: string;
  nextDueDate?: string | Date | null;
  kind: TemplateKind;
}) {
  const { parentName, parentEmail, swimmerName, nextDueDate, kind } = params;
  const headline =
    kind === "due_soon"
      ? "Membership Renewal Reminder"
      : kind === "grace"
      ? "Membership Past Due – Grace Period"
      : "We'd Love to See You Back!";
  const intro =
    kind === "due_soon"
      ? `This is a friendly reminder that <strong>${swimmerName}</strong>'s annual membership is approaching the due date.`
      : kind === "grace"
      ? `Our records show that <strong>${swimmerName}</strong>'s membership is now past due and currently in the <strong>grace period</strong>.`
      : `It's been a while! If <strong>${swimmerName}</strong> is ready to return, you can rejoin with just a few clicks.`;

  const dueLine =
    kind === "inactive"
      ? ""
      : `<div class="info-row"><span class="info-label">Next Due Date:</span><span class="info-value">${fmtDate(nextDueDate)}</span></div>`;

  const guarantee =
    kind === "inactive"
      ? `Please note that since the membership is inactive, previous time slots / group placement may no longer be guaranteed.`
      : `Please note that <strong>we cannot guarantee your swimmer's spot after the due date</strong>. Renewing on time helps us hold your slot and plan staffing.`;

  const isRejoin = kind === "inactive";
  const ctaText = isRejoin ? "Rejoin via Parent Portal" : "Renew via Parent Portal";
  const stepsTitle = isRejoin ? "How to Rejoin" : "How to Renew";
  const steps = isRejoin
    ? [
        "Log in to the Parent Portal",
        "Go to your Swimmer list and find the swimmer you want to rejoin",
        "Click the <strong>Rejoin</strong> button",
        "Review and re-check the required policies (Liability, MAAPP, Codes of Conduct)",
        "Complete the membership payment",
      ]
    : [
        "Log in to the Parent Portal",
        "Go to your Swimmer list and find the swimmer you want to renew",
        "Click the <strong>Renew</strong> button",
        "Re-confirm required policies (Liability, MAAPP, Codes of Conduct)",
        "Complete the membership payment",
      ];

  const portalUrl = "https://www.primeswimacademy.com/login";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Prime Swim Academy</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#1e293b;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%);}
  .container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border-radius:12px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 30px;text-align:center;color:#fff;position:relative;}
  .header::before{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(248,250,252,.1) 0%,transparent 100%);}
  .logo{width:80px;height:80px;background:rgba(255,255,255,.15);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:36px;position:relative;z-index:1;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);}
  .header h1{font-size:28px;font-weight:700;margin-bottom:8px;position:relative;z-index:1;}
  .header p{font-size:16px;opacity:.9;position:relative;z-index:1;font-weight:300;}
  .content{padding:40px 30px;}
  .welcome-message{background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-left:4px solid #1e293b;padding:24px;margin-bottom:30px;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
  .welcome-message h2{color:#1e293b;font-size:24px;margin-bottom:12px;font-weight:700;}
  .welcome-message p{color:#475569;font-size:16px;}
  .swimmer-info{background:linear-gradient(135deg,#f8fafc 0%,#fff 100%);padding:24px;border-radius:12px;margin:25px 0;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
  .swimmer-info h3{color:#1e293b;font-size:18px;margin-bottom:20px;display:flex;align-items:center;font-weight:700;}
  .info-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e2e8f0;}
  .info-row:last-child{border-bottom:none;}
  .info-label{font-weight:600;color:#64748b;}
  .info-value{color:#1e293b;font-weight:500;}
  .next-steps{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:1px solid #f59e0b;border-radius:12px;padding:24px;margin:25px 0;box-shadow:0 4px 6px -1px rgba(245,158,11,.1);}
  .next-steps h3{color:#92400e;font-size:18px;margin-bottom:16px;font-weight:700;}
  .next-steps ul{list-style:none;padding:0;}
  .next-steps li{padding:10px 0 10px 30px;position:relative;color:#78350f;font-weight:500;}
  .next-steps li:before{content:"✓";position:absolute;left:0;color:#16a34a;font-weight:bold;font-size:18px;}
  .cta-section{text-align:center;margin:35px 0;}
  .cta-button{display:inline-block;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;text-decoration:none;padding:16px 32px;border-radius:50px;font-weight:600;font-size:16px;box-shadow:0 20px 25px -5px rgba(30,41,59,.3),0 10px 10px -5px rgba(30,41,59,.1);transition:transform .2s,box-shadow .2s;}
  .cta-button:hover{transform:translateY(-2px);box-shadow:0 25px 30px -5px rgba(30,41,59,.4),0 15px 15px -5px rgba(30,41,59,.15);}
  .contact-info{background:linear-gradient(135deg,#f1f5f9 0%,#e2e8f0 100%);padding:24px;border-radius:12px;margin:25px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
  .contact-info h3{color:#1e293b;font-size:18px;margin-bottom:16px;font-weight:700;}
  .contact-item{display:flex;align-items:center;margin:12px 0;color:#475569;font-weight:500;}
  .contact-icon{width:20px;height:20px;margin-right:12px;color:#1e293b;font-size:16px;}
  .footer{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;padding:35px 30px;text-align:center;}
  .footer p{margin:8px 0;opacity:.9;}
  .footer strong{font-size:18px;font-weight:700;}
  .social-links{margin:25px 0;}
  .social-links a{display:inline-block;margin:0 15px;color:#94a3b8;text-decoration:none;font-weight:500;transition:color .2s;}
  .social-links a:hover{color:#fff;}
  .signature{background:linear-gradient(135deg,rgba(248,250,252,.05) 0%,rgba(241,245,249,.05) 100%);padding:20px;border-radius:8px;margin-top:30px;border-top:1px solid #e2e8f0;}
  @media (max-width: 600px) {
    .container{margin:10px;border-radius:8px;}
    .header,.content,.footer{padding:25px 20px;}
    .header h1{font-size:24px;}
    .info-row{flex-direction:column;gap:8px;}
    .cta-button{padding:14px 28px;font-size:15px;}
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width:100%;height:100%;border-radius:50%;" />
      </div>
      <h1>Prime Swim Academy</h1>
      <p>Excellence in Aquatic Education</p>
    </div>
    <div class="content">
      <div class="welcome-message">
        <h2>📬 ${headline}</h2>
        <p>Dear ${parentName || "Parent/Guardian"},</p>
      </div>
      <p style="font-size:16px;margin-bottom:24px;color:#475569;line-height:1.7;">${intro}</p>
      <div class="swimmer-info">
        <h3>📋 Membership Details</h3>
        <div class="info-row">
          <span class="info-label">Swimmer Name:</span>
          <span class="info-value">${swimmerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Parent Email:</span>
          <span class="info-value">${parentEmail}</span>
        </div>
        ${dueLine}
      </div>
      <div class="next-steps">
        <h3>🧭 ${stepsTitle}</h3>
        <ul>${steps.map((s) => `<li>${s}</li>`).join("")}</ul>
      </div>
      <p style="font-size:16px;margin:25px 0;color:#475569;line-height:1.7;">${guarantee}</p>
      <div class="cta-section">
        <a href="${portalUrl}" class="cta-button">${ctaText}</a>
      </div>
      <div class="contact-info">
        <h3>📞 Questions? We're Here to Help!</h3>
        <div class="contact-item"><span class="contact-icon">📧</span><span>Email: prime.swim.us@gmail.com</span></div>
        <div class="contact-item"><span class="contact-icon">📱</span><span>Phone: (401) 402-0052</span></div>
        <div class="contact-item"><span class="contact-icon">📍</span><span>Location: Bellevue, Washington</span></div>
      </div>
      <div class="signature">
        <p style="font-size:16px;color:#64748b;margin-bottom:20px;">Thank you for supporting our program. We look forward to seeing ${swimmerName} in the pool! 🌊</p>
        <p style="font-size:16px;margin-top:25px;">
          <strong style="color:#1e293b;">Warm regards,</strong><br/>
          <span style="color:#1e293b;font-weight:600;">The Prime Swim Academy Team</span><br/>
          <span style="color:#64748b;font-size:14px;font-style:italic;">Building Champions, One Stroke at a Time</span>
        </p>
      </div>
    </div>
    <div class="footer">
      <p><strong>Prime Swim Academy</strong></p>
      <p style="font-size:14px;margin-bottom:5px;">Excellence in Swimming Instruction</p>
      <p style="font-size:14px;opacity:.8;">Bellevue, Washington</p>
      <p style="font-size:12px;margin-top:25px;opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendReminderEmail(params: {
  parentEmail: string;
  parentName?: string;
  swimmerName: string;
  status: "due_soon" | "grace" | "inactive";
  nextDueDate?: Date | null;
}) {
  const { parentEmail, parentName, swimmerName, status, nextDueDate } = params;

  const kind: TemplateKind = status === "grace" ? "grace" : status === "inactive" ? "inactive" : "due_soon";
  const subject = subjectFor(kind, swimmerName, nextDueDate);
  const html = buildEmailHtml({ parentName, parentEmail, swimmerName, nextDueDate, kind });

  await resend.emails.send({
    from: "Prime Swim Academy <noreply@primeswimacademy.com>",
    to: parentEmail,
    subject,
    html,
  });
}

// Shared handler for both GET (Vercel Cron) and POST (manual)
async function handleRequest(req: NextRequest) {
  try {
    // Verify authorization
    // Vercel Cron Jobs send GET requests with an Authorization header containing a secret
    // The secret is set by Vercel and can be verified via CRON_SECRET env var (optional)
    const authHeader = req.headers.get("authorization") || "";
    const isVercelCron = req.method === "GET";
    
    // If it's a GET request (likely from Vercel Cron), verify the secret if configured
    if (isVercelCron) {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && authHeader !== cronSecret) {
        // If CRON_SECRET is set but doesn't match, reject
        return NextResponse.json({ ok: false, error: "Invalid cron secret" }, { status: 401 });
      }
      // If CRON_SECRET is not set, allow all GET requests (less secure but simpler)
      console.log(`[Auto Reminders] Running from Vercel Cron at ${new Date().toISOString()}`);
    } else {
      // For POST requests (manual calls), require admin authentication
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) {
        return NextResponse.json({ ok: false, error: "Missing authorization. This endpoint can only be called by Vercel Cron (GET) or by authenticated admins (POST)." }, { status: 401 });
      }
      
      const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
      if (!decoded?.email) {
        return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
      }
      
      const adminDoc = await adminDb.doc(`admin/${decoded.email}`).get();
      if (!adminDoc.exists) {
        return NextResponse.json({ ok: false, error: "Not authorized. Admin access required." }, { status: 403 });
      }
      console.log(`[Auto Reminders] Running manually by admin ${decoded.email} at ${new Date().toISOString()}`);
    }

    const now = new Date();
    const swimmersSnapshot = await adminDb.collection("swimmers").get();
    const swimmers = swimmersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter swimmers with due_soon or grace status
    const toNotify: Array<{
      id: string;
      parentEmail: string;
      parentName: string;
      swimmerName: string;
      status: "due_soon" | "grace";
      nextDueDate?: Date | null;
    }> = [];

    for (const swimmer of swimmers) {
      // Skip if frozen or no email
      if (swimmer.isFrozen || !swimmer.parentEmail) continue;

      // Compute dates
      let nextDue: Date | undefined;
      if (swimmer.nextDueDate) {
        nextDue = swimmer.nextDueDate.toDate ? swimmer.nextDueDate.toDate() : new Date(swimmer.nextDueDate);
      } else if (swimmer.registrationAnchorDate) {
        const anchor = swimmer.registrationAnchorDate.toDate 
          ? swimmer.registrationAnchorDate.toDate() 
          : new Date(swimmer.registrationAnchorDate);
        const coverage = deriveCoverageFromAnchor(anchor);
        nextDue = coverage.nextDueDate as Date;
      }

      if (!nextDue) continue;

      // Compute status
      const status = computeStatus(
        {
          registrationAnchorDate: swimmer.registrationAnchorDate?.toDate 
            ? swimmer.registrationAnchorDate.toDate() 
            : swimmer.registrationAnchorDate,
          currentPeriodStart: swimmer.currentPeriodStart?.toDate 
            ? swimmer.currentPeriodStart.toDate() 
            : swimmer.currentPeriodStart,
          currentPeriodEnd: swimmer.currentPeriodEnd?.toDate 
            ? swimmer.currentPeriodEnd.toDate() 
            : swimmer.currentPeriodEnd,
          nextDueDate: nextDue,
        },
        now
      );

      // Only send to due_soon or grace
      if (status === "due_soon" || status === "grace") {
        toNotify.push({
          id: swimmer.id,
          parentEmail: swimmer.parentEmail,
          parentName: `${swimmer.parentFirstName || ""} ${swimmer.parentLastName || ""}`.trim(),
          swimmerName: `${swimmer.childFirstName || ""} ${swimmer.childLastName || ""}`.trim(),
          status,
          nextDueDate: nextDue,
        });
      }
    }

    // Send emails
    const results = await Promise.allSettled(
      toNotify.map(swimmer =>
        sendReminderEmail({
          parentEmail: swimmer.parentEmail,
          parentName: swimmer.parentName,
          swimmerName: swimmer.swimmerName,
          status: swimmer.status,
          nextDueDate: swimmer.nextDueDate,
        })
      )
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failureCount = results.filter(r => r.status === "rejected").length;

    const response = {
      ok: true,
      sent: successCount,
      failed: failureCount,
      total: toNotify.length,
      timestamp: new Date().toISOString(),
      details: results.map((r, i) => ({
        swimmer: toNotify[i].swimmerName,
        email: toNotify[i].parentEmail,
        status: toNotify[i].status,
        success: r.status === "fulfilled",
        error: r.status === "rejected" ? (r.reason as Error)?.message : undefined,
      })),
    };

    console.log(`[Auto Reminders] Completed: ${successCount} sent, ${failureCount} failed out of ${toNotify.length} total`);
    
    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("Auto reminder error:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// Vercel Cron Jobs use GET requests
export async function GET(req: NextRequest) {
  return handleRequest(req);
}

// Manual calls use POST requests
export async function POST(req: NextRequest) {
  return handleRequest(req);
}

