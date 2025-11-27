// src/app/api/makeup/send-reminder/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

// Check if user is admin
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

function buildReminderEmailHtml(params: {
  parentName?: string;
  parentEmail: string;
  swimmerName: string;
  eventText: string;
}) {
  const { parentName, swimmerName, eventText } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Make-up Class Reminder</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;color:#1e293b;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%);}
  .container{max-width:600px;margin:0 auto;background:#fff;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);border-radius:12px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 30px;text-align:center;color:#fff;position:relative;}
  .header h1{font-size:28px;font-weight:700;margin-bottom:8px;}
  .header p{font-size:16px;opacity:.9;font-weight:300;}
  .content{padding:40px 30px;}
  .welcome-message{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-left:4px solid #f59e0b;padding:24px;margin-bottom:30px;border-radius:0 12px 12px 0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
  .welcome-message h2{color:#92400e;font-size:24px;margin-bottom:12px;font-weight:700;}
  .event-info{background:linear-gradient(135deg,#f8fafc 0%,#fff 100%);padding:24px;border-radius:12px;margin:25px 0;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);}
  .event-info h3{color:#1e293b;font-size:18px;margin-bottom:16px;font-weight:700;}
  .event-text{font-size:16px;color:#475569;line-height:1.7;font-weight:500;}
  .cta-section{text-align:center;margin:35px 0;}
  .cta-button{display:inline-block;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;text-decoration:none;padding:16px 32px;border-radius:50px;font-weight:600;font-size:16px;box-shadow:0 20px 25px -5px rgba(30,41,59,.3),0 10px 10px -5px rgba(30,41,59,.1);transition:transform .2s,box-shadow .2s;}
  .cta-button:hover{transform:translateY(-2px);box-shadow:0 25px 30px -5px rgba(30,41,59,.4),0 15px 15px -5px rgba(30,41,59,.15);}
  .footer{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;padding:35px 30px;text-align:center;}
  .footer p{margin:8px 0;opacity:.9;}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Prime Swim Academy</h1>
      <p>Make-up Class Reminder</p>
    </div>
    <div class="content">
      <div class="welcome-message">
        <h2>📬 Friendly Reminder</h2>
        <p>Dear ${parentName || "Parent/Guardian"},</p>
      </div>
      <p style="font-size:16px;margin-bottom:24px;color:#475569;line-height:1.7;">
        This is a friendly reminder about the upcoming make-up class for <strong>${swimmerName}</strong>. 
        We haven't received your RSVP yet, and we'd love to know if you'll be attending!
      </p>
      <div class="event-info">
        <h3>📅 Make-up Class Details</h3>
        <div class="event-text">${eventText}</div>
      </div>
      <p style="font-size:16px;margin:25px 0;color:#475569;line-height:1.7;">
        Please log in to your Parent Portal to let us know if <strong>${swimmerName}</strong> will be attending this make-up class.
      </p>
      <div class="cta-section">
        <a href="https://www.primeswimacademy.com/login" class="cta-button">Go to Parent Portal</a>
      </div>
      <p style="font-size:16px;margin-top:25px;color:#64748b;">
        Thank you for your attention. We look forward to seeing ${swimmerName} in the pool! 🌊
      </p>
      <p style="font-size:16px;margin-top:25px;">
        <strong style="color:#1e293b;">Warm regards,</strong><br/>
        <span style="color:#1e293b;font-weight:600;">The Prime Swim Academy Team</span>
      </p>
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

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(idToken);
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { makeupId, eventText } = body;

    if (!makeupId || !eventText) {
      return NextResponse.json({ ok: false, error: "Missing makeupId or eventText" }, { status: 400 });
    }

    // Get all swimmers who haven't responded
    const swimmersSnapshot = await adminDb
      .collection("swimmers")
      .where("nextMakeupId", "==", makeupId)
      .get();

    const noResponseSwimmers: Array<{
      id: string;
      swimmerName: string;
      parentName: string;
      parentEmail: string;
    }> = [];

    for (const swimmerDoc of swimmersSnapshot.docs) {
      const swimmerData = swimmerDoc.data();
      const swimmerId = swimmerDoc.id;

      // Check if there's a response
      const responseDoc = await adminDb
        .collection("makeup_responses")
        .doc(`${swimmerId}_${makeupId}`)
        .get();

      if (!responseDoc.exists) {
        // No response - add to list
        const swimmerName = [
          swimmerData.childFirstName,
          swimmerData.childLastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || swimmerData.swimmerName || swimmerData.name || swimmerId;

        const parentName = [
          swimmerData.parentFirstName,
          swimmerData.parentLastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || swimmerData.parentName || "";

        const parentEmail =
          swimmerData.parentEmail ||
          (Array.isArray(swimmerData.parentEmails) ? swimmerData.parentEmails[0] : "") ||
          "";

        if (parentEmail && swimmerName) {
          noResponseSwimmers.push({
            id: swimmerId,
            swimmerName,
            parentName,
            parentEmail,
          });
        }
      }
    }

    if (noResponseSwimmers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: "No parents need reminders" });
    }

    // Send emails
    const results = await Promise.allSettled(
      noResponseSwimmers.map((swimmer) =>
        resend.emails.send({
          from: "Prime Swim Academy <noreply@primeswimacademy.com>",
          to: swimmer.parentEmail,
          subject: `📬 Reminder: Make-up Class RSVP for ${swimmer.swimmerName}`,
          html: buildReminderEmailHtml({
            parentName: swimmer.parentName,
            parentEmail: swimmer.parentEmail,
            swimmerName: swimmer.swimmerName,
            eventText,
          }),
        })
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      sent: successCount,
      failed: failureCount,
      total: noResponseSwimmers.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Send reminder error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

