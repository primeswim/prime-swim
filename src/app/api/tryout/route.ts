export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { describeTryoutExperience, normalizeTryout, validateTryout } from "@/lib/tryout-form";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_FORM", message: "Invalid form submission." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "INVALID_FORM", message: "Invalid form submission." }, { status: 400 });
  }
  const data = normalizeTryout(input as Record<string, unknown>);
  const message = validateTryout(data);
  if (message) return NextResponse.json({ error: "INVALID_FORM", message }, { status: 400 });

  // Scheduling is arranged manually. Every valid request gets its own record;
  // do not query availability or acquire the former program/date capacity lock.
  try {
    await adminDb.collection("tryouts").add({ ...data, submittedAt: Timestamp.now() });
  } catch (error) {
    console.error("Error saving tryout:", error);
    return NextResponse.json({ error: "FAILED_SAVE", message: "Failed to save tryout form." }, { status: 500 });
  }

  // Send independently: an admin notification failure must not block the family receipt.
  const fields = {
    "First Name": data.firstName, "Last Name": data.lastName,
    Email: data.email, Phone: data.phone, Age: data.age, Program: data.program,
    Experience: describeTryoutExperience(data), "Health Issues": data.healthIssues, Notes: data.notes,
  };
  const sendEmail = async (recipient: "admin" | "family") => {
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Prime Swim Academy <noreply@primeswimacademy.com>",
        to: recipient === "admin" ? "prime.swim.us@gmail.com" : data.email,
        replyTo: recipient === "admin" ? data.email : "prime.swim.us@gmail.com",
        subject: recipient === "admin" ? "*** New Tryout Submission ***" : "We received your tryout request — Prime Swim Academy",
        html: recipient === "admin"
          ? `<h2>New Tryout Submission</h2><p>Please contact the family to arrange their tryout.</p>${Object.entries(fields).map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join("")}`
          : `<h2>We received your tryout request</h2><p>Thank you for registering ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)} for a tryout with Prime Swim Academy.</p><p>Our coaching team will contact you to arrange the date, time and location. Your tryout appointment has not been scheduled yet.</p><p>Questions? Reply to this email or contact <a href="mailto:prime.swim.us@gmail.com">prime.swim.us@gmail.com</a>.</p><p>We look forward to meeting your swimmer!<br>Prime Swim Academy</p>`,
      });
      if (result.error) { console.error(`Tryout ${recipient} notification failed:`, result.error.name); return false; }
      return true;
    } catch {
      console.error(`Tryout ${recipient} notification failed.`);
      return false;
    }
  };
  const [, confirmationEmailSent] = await Promise.all([sendEmail("admin"), sendEmail("family")]);
  return NextResponse.json({ success: true, confirmationEmailSent });
}
