// app/api/sendemail/route.ts

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

const FROM_EMAIL =
  process.env.SEND_FROM_EMAIL || "Prime Swim Academy <noreply@primeswimacademy.com>";
const ADMIN_BCC = process.env.ADMIN_BCC || "prime.swim.us@gmail.com";

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Minimal shape for the email payload (compatible with Resend)
type EmailPayload = {
  from: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
};

function wrapWithTemplate(subject: string, content: string, contentType: "text" | "html") {
  // logo + footer 模板
  const header = `
    <div style="text-align:center;padding:20px;background:#1e293b;color:#fff;">
      <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width:80px;height:80px;border-radius:50%;" />
      <h1 style="margin:10px 0;font-size:24px;">Prime Swim Academy</h1>
    </div>
  `;

  const footer = `
    <div style="background:#1e293b;color:#fff;text-align:center;padding:20px;font-size:12px;">
      <p><strong>Prime Swim Academy</strong></p>
      <p>Bellevue, Washington</p>
      <p style="opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  `;

  if (contentType === "html") {
    return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;background:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        ${header}
        <div style="padding:20px;">${content}</div>
        ${footer}
      </div>
    </body></html>`;
  } else {
    // plain text -> escape and wrap in <pre>
    const safe = escapeHtml(content);
    return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;background:#f8fafc;color:#1e293b;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        ${header}
        <div style="padding:20px;"><pre style="white-space:pre-wrap;">${safe}</pre></div>
        ${footer}
      </div>
    </body></html>`;
  }
}

export async function POST(req: Request) {
  try {
    // Verify Firebase ID token
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });

    const decoded: DecodedIdToken = await getAuth().verifyIdToken(idToken);
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

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // Parse body
    const body = await req.json();
    const {
      toEmails,
      subject,
      content,
      contentType = "text",
      bccAdmin = false,
    }: {
      toEmails: string[];
      subject: string;
      content: string;
      contentType?: "text" | "html";
      bccAdmin?: boolean;
    } = body || {};

    if (!toEmails?.length || !subject || !content) {
      return NextResponse.json(
        { ok: false, error: "toEmails, subject, and content are required" },
        { status: 400 }
      );
    }

    // Build Resend payload (hide recipients by using BCC)
    const html = wrapWithTemplate(subject, content, contentType);

    // Merge BCCs: real recipients + optional admin
    const bccList: string[] = bccAdmin ? [...toEmails, ADMIN_BCC] : [...toEmails];

    const payload: EmailPayload = {
      from: FROM_EMAIL,
      to: FROM_EMAIL,      // visible To: only your noreply
      bcc: bccList,        // real recipients hidden in BCC
      subject,
      html,
      text:
        contentType === "html"
          ? content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : content,
    };

    // Resend typings vary by version but accept this shape at runtime.
    const sent = await resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0]);

    return NextResponse.json({ ok: true, data: sent });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
    console.error("/api/sendemail error", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// utils
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
