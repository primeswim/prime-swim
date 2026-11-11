export const runtime = "nodejs";

import { adminTryoutEmailSubject, buildAdminTryoutEmail, buildTryoutReceipt, tryoutEmailSubject } from "@/lib/tryout-email";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkSwimmerBirthDate } from "@/lib/swimmer-age";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeTryout, tryoutWaiverVersion, validateTryout } from "@/lib/tryout-form";

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_FORM", message: "Invalid form submission." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "INVALID_FORM", message: "Invalid form submission." }, { status: 400 });
  }
  const payload = input as Record<string, unknown>;
  if (payload.waiverVersion !== tryoutWaiverVersion) {
    return NextResponse.json({ error: "WAIVER_VERSION_MISMATCH", message: "Please reload the form and review the current tryout terms before submitting." }, { status: 409 });
  }
  const data = normalizeTryout(payload);
  const today = new Date();
  const message = validateTryout(data, today);
  if (message) return NextResponse.json({ error: "INVALID_FORM", message }, { status: 400 });

  const age = String(checkSwimmerBirthDate(data.birthDate, today).age);

  // Scheduling is arranged manually. Every valid request gets its own record;
  // do not query availability or acquire the former program/date capacity lock.
  try {
    const submittedAt = Timestamp.now();
    await adminDb.collection("tryouts").add({ ...data, age, waiverVersion: tryoutWaiverVersion, submittedAt });
  } catch (error) {
    console.error("Error saving tryout:", error);
    return NextResponse.json({ error: "FAILED_SAVE", message: "Failed to save tryout form." }, { status: 500 });
  }

  // Send independently: an admin notification failure must not block the family receipt.
  const sendEmail = async (recipient: "admin" | "family") => {
    try {
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Prime Swim Academy <noreply@primeswimacademy.com>",
        to: recipient === "admin" ? "prime.swim.us@gmail.com" : data.email,
        ...(recipient === "admin" ? { replyTo: data.email } : {}),
        subject: recipient === "admin" ? adminTryoutEmailSubject : tryoutEmailSubject,
        html: recipient === "admin"
          ? buildAdminTryoutEmail(data, age)
          : buildTryoutReceipt(data.firstName, data.lastName),
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
