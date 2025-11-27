// app/api/makeup/publish/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

// ✅ 必须在 Node.js runtime（Admin SDK 不支持 Edge）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 复用你的服务端管理员检查
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

type Body = {
  makeupText: string;
  swimmerIds: string[];
  date?: string;
  time?: string;
  endTime?: string;
  location?: string;
};

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8); // 简易请求标记
  try {
    // 1) AuthN
    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";

    console.log(`[publish:${reqId}] headers.authorization exists=`, !!authHeader);

    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!idToken) {
      console.error(`[publish:${reqId}] missing bearer token`);
      return NextResponse.json({ ok: false, stage: "auth", error: "Missing token" }, { status: 401 });
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e: unknown) {
      console.error(`[publish:${reqId}] verifyIdToken error:`, e);
      return NextResponse.json({ ok: false, stage: "auth", error: "Invalid token" }, { status: 401 });
    }

    const emailLower = (decoded.email ?? "").toLowerCase();
    const rawRole = (decoded as Record<string, unknown>)["role"];
    const hasAdminRole = typeof rawRole === "string" && rawRole.toLowerCase() === "admin";
    const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      hasAdminRole ||
      (emailLower !== "" && allow.includes(emailLower)) ||
      (await isInAdminsServer(decoded.email ?? null, decoded.uid));

    console.log(`[publish:${reqId}] decoded.uid=`, decoded.uid, " email=", decoded.email, " isAdmin=", isAdmin);

    if (!isAdmin) {
      console.error(`[publish:${reqId}] not authorized`);
      return NextResponse.json({ ok: false, stage: "authz", error: "Not authorized" }, { status: 403 });
    }

    // 2) Parse body
    let body: Body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[publish:${reqId}] JSON parse error:`, e);
      return NextResponse.json({ ok: false, stage: "parse", error: "Invalid JSON body" }, { status: 400 });
    }

    const { makeupText, swimmerIds } = body || ({} as Body);
    console.log(`[publish:${reqId}] body=`, body);

    if (!makeupText?.trim() || !Array.isArray(swimmerIds) || swimmerIds.length === 0) {
      return NextResponse.json(
        { ok: false, stage: "validate", error: "makeupText and swimmerIds are required" },
        { status: 400 }
      );
    }

    // 校验 doc id 合法性（最常见的触发该错误的原因就是 id 里有 `/` 或为空）
    const invalidIds = swimmerIds.filter((sid) => !isValidDocId(sid));
    if (invalidIds.length) {
      console.error(`[publish:${reqId}] invalid swimmerIds:`, invalidIds);
      return NextResponse.json(
        {
          ok: false,
          stage: "validate",
          error: "Invalid swimmerIds (must be non-empty and must not contain '/')",
          details: { invalidIds },
        },
        { status: 400 }
      );
    }
    console.log(`[publish:${reqId}] swimmerIds count=`, swimmerIds.length, " sample=", swimmerIds.slice(0, 5));

    // 3) Create event & batch update
    const eventRef = adminDb.collection("makeup_events").doc(); // pre-generate ID
    const eventId = eventRef.id;

    console.log(`[publish:${reqId}] eventId=`, eventId);

    const batch = adminDb.batch();
    batch.set(eventRef, {
      text: makeupText.trim(),
      date: body.date || null,
      time: body.time || null,
      endTime: body.endTime || null,
      location: body.location || null,
      createdAt: new Date(),
      createdBy: decoded.email || decoded.uid || "admin",
      active: true,
    });

    // 单独 try/catch，定位是哪个 swimmerId 触发了错误
    for (const sid of swimmerIds) {
      try {
        const sref = adminDb.collection("swimmers").doc(sid);
        batch.set(
          sref,
          {
            nextMakeupText: makeupText.trim(),
            nextMakeupId: eventId,
          },
          { merge: true }
        );
      } catch (e) {
        console.error(`[publish:${reqId}] batch.set failed for swimmerId=`, sid, " error=", e);
        return NextResponse.json(
          { ok: false, stage: "batch-set", error: "Failed to prepare batch for swimmer", details: { sid } },
          { status: 500 }
        );
      }
    }

    try {
      await batch.commit();
    } catch (e) {
      console.error(`[publish:${reqId}] batch.commit error:`, e);
      return NextResponse.json(
        { ok: false, stage: "commit", error: "Batch commit failed", details: String(e) },
        { status: 500 }
      );
    }

    // Send notification emails to parents
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Get swimmers and send emails
      const emailResults = await Promise.allSettled(
        swimmerIds.map(async (swimmerId: string) => {
          const swimmerDoc = await adminDb.collection("swimmers").doc(swimmerId).get();
          if (!swimmerDoc.exists) return { swimmerId, success: false };

          const swimmerData = swimmerDoc.data() || {};
          const swimmerName =
            [swimmerData.childFirstName, swimmerData.childLastName].filter(Boolean).join(" ").trim() ||
            swimmerData.swimmerName ||
            swimmerData.name ||
            swimmerId;

          const parentName =
            [swimmerData.parentFirstName, swimmerData.parentLastName].filter(Boolean).join(" ").trim() ||
            swimmerData.parentName ||
            "";

          const parentEmail =
            swimmerData.parentEmail ||
            (Array.isArray(swimmerData.parentEmails) ? swimmerData.parentEmails[0] : "") ||
            "";

          if (!parentEmail) return { swimmerId, success: false };

          // Build email HTML
          let dateStr = "";
          if (body.date) {
            try {
              // date is in YYYY-MM-DD format, add time to avoid timezone issues
              const dateObj = new Date(body.date + "T00:00:00");
              if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                });
              }
            } catch {
              dateStr = body.date;
            }
          }

          let timeStr = "";
          if (body.time) {
            const [hours, minutes] = body.time.split(":");
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? "PM" : "AM";
            const hour12 = hour % 12 || 12;
            timeStr = `${hour12}:${minutes} ${ampm}`;
            if (body.endTime) {
              const [endHours, endMinutes] = body.endTime.split(":");
              const endHour = parseInt(endHours);
              const endAmpm = endHour >= 12 ? "PM" : "AM";
              const endHour12 = endHour % 12 || 12;
              timeStr += ` - ${endHour12}:${endMinutes} ${endAmpm}`;
            }
          }

          const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background:#f8fafc;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:30px;text-align:center;color:#fff;">
<h1 style="margin:0;font-size:24px;">Prime Swim Academy</h1>
<p style="margin:8px 0 0;opacity:.9;">Make-up Class Notification</p>
</div>
<div style="padding:30px;">
<div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:20px;margin-bottom:20px;border-radius:4px;">
<h2 style="color:#1e40af;margin:0 0 8px;font-size:20px;">🏊 Make-up Class Available</h2>
<p style="margin:0;color:#1e40af;">Dear ${parentName || "Parent/Guardian"},</p>
</div>
<p style="font-size:16px;color:#475569;margin-bottom:20px;">A make-up class has been scheduled for <strong>${swimmerName}</strong>. Please review the details below and let us know if you'll be attending.</p>
<div style="background:#f8fafc;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e2e8f0;">
<h3 style="color:#1e293b;margin:0 0 16px;font-size:18px;">📅 Make-up Class Details</h3>
${dateStr ? `<p style="margin:8px 0;color:#475569;"><strong>Date:</strong> ${dateStr}</p>` : ""}
${timeStr ? `<p style="margin:8px 0;color:#475569;"><strong>Time:</strong> ${timeStr}</p>` : ""}
${body.location ? `<p style="margin:8px 0;color:#475569;"><strong>Location:</strong> ${body.location}</p>` : ""}
${makeupText.trim() ? `<p style="margin:16px 0 8px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569;"><strong>Additional Information:</strong><br/>${makeupText.trim()}</p>` : ""}
</div>
<div style="text-align:center;margin:30px 0;">
<a href="https://www.primeswimacademy.com/login" style="display:inline-block;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:600;font-size:16px;">Go to Parent Portal</a>
</div>
<p style="font-size:16px;color:#64748b;margin-top:20px;">Thank you for your attention. We look forward to seeing ${swimmerName} in the pool! 🌊</p>
<p style="font-size:16px;margin-top:20px;"><strong>Warm regards,</strong><br/>The Prime Swim Academy Team</p>
</div>
<div style="background:#1e293b;color:#fff;padding:25px;text-align:center;">
<p style="margin:4px 0;"><strong>Prime Swim Academy</strong></p>
<p style="margin:4px 0;font-size:14px;opacity:.9;">Excellence in Swimming Instruction</p>
<p style="margin:4px 0;font-size:14px;opacity:.8;">Bellevue, Washington</p>
</div>
</div>
</body>
</html>`;

          await resend.emails.send({
            from: "Prime Swim Academy <noreply@primeswimacademy.com>",
            to: parentEmail,
            subject: `🏊 Make-up Class Available for ${swimmerName}`,
            html: emailHtml,
          });

          return { swimmerId, success: true };
        })
      );

      const emailSuccessCount = emailResults.filter((r) => r.status === "fulfilled" && r.value?.success).length;
      console.log(`[publish:${reqId}] sent ${emailSuccessCount}/${swimmerIds.length} notification emails`);
    } catch (emailErr) {
      // Don't fail the publish if email fails, just log it
      console.error(`[publish:${reqId}] email notification error:`, emailErr);
    }

    console.log(`[publish:${reqId}] success: updated`, swimmerIds.length, "swimmer(s)");
    return NextResponse.json({ ok: true, eventId, count: swimmerIds.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publish:${reqId}] unhandled error:`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
