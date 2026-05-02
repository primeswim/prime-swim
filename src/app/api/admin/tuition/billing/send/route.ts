export const runtime = "nodejs";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  TUITION_BILLING_COLLECTION,
  TUITION_BILLING_ROWS_SUBCOL,
  daysUntilLocalYmd,
  pickBillingVariantByDueDate,
} from "@/lib/tuition-billing-shared";
import {
  buildTuitionEmailHtml,
  buildTuitionEmailSubject,
  type TuitionEmailVariant,
} from "@/lib/tuition-email";

const resend = new Resend(process.env.RESEND_API_KEY);

async function requireAdmin(req: Request): Promise<void> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
}

/** POST — send tuition email from a billing row */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as {
      month?: string;
      swimmerId?: string;
      /** Omit or "auto": due ≥3 days out → invoice; 0–2 days before → reminder; after due → past_due */
      kind?: TuitionEmailVariant | "auto";
    };

    const month = body.month?.trim();
    const swimmerId = body.swimmerId?.trim();
    const kindRaw = body.kind ?? "auto";
    const explicitKinds: TuitionEmailVariant[] = ["invoice", "reminder", "past_due"];
    const mode: TuitionEmailVariant | "auto" =
      kindRaw === "auto"
        ? "auto"
        : explicitKinds.includes(kindRaw as TuitionEmailVariant)
          ? (kindRaw as TuitionEmailVariant)
          : "auto";

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    if (!swimmerId) {
      return NextResponse.json({ error: "Missing swimmerId" }, { status: 400 });
    }

    const ref = adminDb
      .collection(TUITION_BILLING_COLLECTION)
      .doc(month)
      .collection(TUITION_BILLING_ROWS_SUBCOL)
      .doc(swimmerId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Billing row not found" }, { status: 404 });
    }
    const d = snap.data()!;
    if (d.paid === true) {
      return NextResponse.json({ error: "Already marked paid" }, { status: 400 });
    }

    const parentEmail = typeof d.parentEmail === "string" ? d.parentEmail.trim() : "";
    if (!parentEmail || !parentEmail.includes("@")) {
      return NextResponse.json({ error: "Missing parent email on billing row" }, { status: 400 });
    }

    const dueRaw = typeof d.dueDate === "string" ? d.dueDate : "";
    const autoPick = pickBillingVariantByDueDate(dueRaw);
    const variant: TuitionEmailVariant = mode === "auto" ? autoPick.variant : mode;

    let daysUntilDue: number | undefined;
    if (variant === "reminder") {
      const du = daysUntilLocalYmd(dueRaw);
      if (du != null && du >= 0) daysUntilDue = du;
    }

    const payload = {
      parentName: String(d.parentName || "Parent/Guardian"),
      parentEmail,
      swimmerName: String(d.swimmerName || ""),
      months: Array.isArray(d.months) ? (d.months as string[]) : [],
      practiceText: String(d.practiceText || ""),
      dueDate: String(d.dueDate || ""),
      amount: typeof d.amount === "number" ? d.amount : Number(d.amount) || 0,
      afterFeeNote: typeof d.afterFeeNote === "string" && d.afterFeeNote.trim() ? d.afterFeeNote : undefined,
      variant,
      daysUntilDue,
    };

    const html = buildTuitionEmailHtml(payload);
    const subject = buildTuitionEmailSubject(payload);

    const resp = await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: parentEmail,
      bcc: ["prime.swim.us@gmail.com"],
      subject,
      html,
    });

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      lastSentAt: now,
      lastEmailKind: variant,
      updatedAt: now,
    };

    if (variant === "invoice") {
      if (!d.firstInvoiceSentAt) {
        updates.firstInvoiceSentAt = now;
      }
    }
    if (variant === "reminder") {
      updates.lastManualReminderAt = now;
      const du = daysUntilLocalYmd(dueRaw);
      if (du === 2) updates.reminder2dSentAt = now;
      else if (du === 1) updates.reminder1dSentAt = now;
      else if (du === 0) updates.reminder1dSentAt = now;
    }
    if (variant === "past_due") {
      updates.pastDueSentAt = now;
    }

    await ref.update(updates);

    return NextResponse.json({
      ok: true,
      data: resp,
      variantUsed: variant,
      daysUntilDue:
        variant === "reminder" && typeof daysUntilDue === "number" ? daysUntilDue : undefined,
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition billing send:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
