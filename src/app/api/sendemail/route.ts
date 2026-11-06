// app/api/sendemail/route.ts

export const runtime = "nodejs";
export const maxDuration = 60;

import { wrapBrandedEmail } from "@/lib/branded-email";
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

// Format inline text (bold, italic, links, etc.)
function formatInlineText(text: string): string {
  let result = escapeHtml(text);
  
  // Convert **bold** or __bold__ to <strong>
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 700; color: #1e293b;">$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong style="font-weight: 700; color: #1e293b;">$1</strong>');
  
  // Convert *italic* or _italic_ to <em> (but not if it's part of **bold**)
  result = result.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
  result = result.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em style="font-style: italic;">$1</em>');
  
  // Convert [text](url) to links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4338ca; text-decoration: underline;">$1</a>');
  
  // Auto-detect URLs and convert to links
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  result = result.replace(urlRegex, '<a href="$1" style="color: #4338ca; text-decoration: underline;">$1</a>');
  
  // Convert single newlines to <br/>
  result = result.replace(/\n/g, "<br/>");
  
  return result;
}

// Convert plain text to formatted HTML with rich formatting support
function textToHtml(text: string): string {
  if (!text.trim()) return "<p>(empty)</p>";
  
  // Split by double newlines to create paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length === 0) return "<p>(empty)</p>";
  
  return paragraphs
    .map(para => {
      const trimmed = para.trim();
      
      // Check for headings (lines starting with #)
      if (/^#{1,3}\s+/.test(trimmed)) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const content = trimmed.replace(/^#+\s+/, "");
        const size = level === 1 ? "24px" : level === 2 ? "20px" : "18px";
        const formatted = formatInlineText(content);
        return `<h${Math.min(level, 3)} style="font-size: ${size}; font-weight: 700; color: #1e293b; margin: 24px 0 16px; line-height: 1.3;">${formatted}</h${Math.min(level, 3)}>`;
      }
      
      // Check for list items (starting with -, *, or numbers)
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        const formatted = formatInlineText(content);
        return `<li style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 8px; padding-left: 8px;">${formatted}</li>`;
      }
      
      // Check if it's a list block (multiple list items)
      const lines = trimmed.split(/\n/);
      if (lines.length > 1 && lines.every(line => /^[-*•]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim()))) {
        const listItems = lines
          .map(line => {
            const content = line.trim().replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
            const formatted = formatInlineText(content);
            return `<li style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 8px; padding-left: 8px;">${formatted}</li>`;
          })
          .join("");
        return `<ul style="margin: 16px 0; padding-left: 24px; list-style: none;">${listItems}</ul>`;
      }
      
      // Regular paragraph with inline formatting
      const formatted = formatInlineText(trimmed);
      return `<p style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 16px;">${formatted}</p>`;
    })
    .join("");
}

function wrapWithTemplate(subject: string, content: string, contentType: "text" | "html") {
  return wrapBrandedEmail(subject, contentType === "html" ? content : textToHtml(content));
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

    const uniqueEmails = [...new Set(toEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
    if (!uniqueEmails.length) {
      return NextResponse.json({ ok: false, error: "No valid recipient emails" }, { status: 400 });
    }

    // One email per parent. Sending everyone in a single BCC is what triggered
    // Gmail rate-limiting (421 4.7.28) on send.primeswimacademy.com.
    const MAX_PER_REQUEST = 8;
    if (uniqueEmails.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { ok: false, error: `Send at most ${MAX_PER_REQUEST} recipients per request` },
        { status: 400 }
      );
    }

    const html = wrapWithTemplate(subject, content, contentType);
    const text =
      contentType === "html"
        ? content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : content;

    const results: Array<{ email: string; ok: boolean; id?: string; error?: string }> = [];

    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i];
      const payload: EmailPayload = {
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
        text,
      };
      // One admin copy for the whole job (first recipient only), not 20 BCC copies.
      if (bccAdmin && i === 0) {
        payload.bcc = [ADMIN_BCC];
      }

      const sent = await resend.emails.send(
        payload as unknown as Parameters<typeof resend.emails.send>[0]
      );
      const errMsg =
        sent && typeof sent === "object" && "error" in sent && sent.error
          ? (sent.error as { message?: string }).message || String(sent.error)
          : null;
      const id =
        sent && typeof sent === "object" && "data" in sent && sent.data && typeof sent.data === "object"
          ? (sent.data as { id?: string }).id
          : sent && typeof sent === "object" && "id" in sent
            ? (sent as { id?: string }).id
            : undefined;

      if (errMsg) {
        results.push({ email, ok: false, error: errMsg });
      } else {
        results.push({ email, ok: true, id });
      }

      if (i < uniqueEmails.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({
      ok: failed.length === 0,
      sentCount: results.filter((r) => r.ok).length,
      failedCount: failed.length,
      failedEmails: failed.map((r) => r.email),
      results,
    });
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
