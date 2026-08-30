export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadInvoices } from "@/lib/tuition-v2/invoice-service";
import { normalizeMonthDoc } from "@/lib/tuition-v2/month-service";
import { TUITION_V2_INVOICES_SUBCOL, TUITION_V2_MONTHS_COLLECTION } from "@/lib/tuition-v2/constants";
import {
  daysUntilLocalYmd,
  pickBillingVariantByDueDate,
} from "@/lib/tuition-billing-shared";
import { monthReadyToSendEmail } from "@/lib/tuition-v2/shared-ui";
import {
  buildTuitionEmailHtml,
  buildTuitionEmailSubject,
  type TuitionEmailVariant,
} from "@/lib/tuition-email";

const resend = new Resend(process.env.RESEND_API_KEY);

type RouteCtx = { params: Promise<{ month: string }> };

async function sendOneInvoice(
  month: string,
  swimmerId: string,
  kind: TuitionEmailVariant | "auto"
) {
  const monthSnap = await adminDb.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get();
  const monthDoc = normalizeMonthDoc(month, monthSnap.data());
  if (!monthReadyToSendEmail(monthDoc.status)) {
    throw new Error("MONTH_NOT_READY");
  }

  const ref = adminDb
    .collection(TUITION_V2_MONTHS_COLLECTION)
    .doc(month)
    .collection(TUITION_V2_INVOICES_SUBCOL)
    .doc(swimmerId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NOT_FOUND");
  const d = snap.data()!;
  if (d.paid === true) throw new Error("ALREADY_PAID");

  const parentEmail = typeof d.parentEmail === "string" ? d.parentEmail.trim() : "";
  if (!parentEmail.includes("@")) throw new Error("NO_EMAIL");

  const dueRaw = typeof d.dueDate === "string" ? d.dueDate : "";
  const autoPick = pickBillingVariantByDueDate(dueRaw);
  const variant: TuitionEmailVariant = kind === "auto" ? autoPick.variant : kind;

  let daysUntilDue: number | undefined;
  if (variant === "reminder") {
    const du = daysUntilLocalYmd(dueRaw);
    if (du != null && du >= 0) daysUntilDue = du;
  }

  const siblingDiscountApplied = d.siblingDiscountApplied === true;
  const payload = {
    parentName: String(d.parentName || "Parent/Guardian"),
    parentEmail,
    swimmerName: String(d.swimmerName || ""),
    months: Array.isArray(d.months) ? (d.months as string[]) : [],
    practiceText: String(d.practiceText || ""),
    dueDate: dueRaw,
    amount: typeof d.amount === "number" ? d.amount : Number(d.amount) || 0,
    baseAmount: siblingDiscountApplied && typeof d.baseAmount === "number" ? d.baseAmount : undefined,
    siblingDiscountPercent:
      siblingDiscountApplied && typeof d.siblingDiscountPercent === "number"
        ? d.siblingDiscountPercent
        : undefined,
    siblingDiscountApplied: siblingDiscountApplied || undefined,
    afterFeeNote: typeof d.afterFeeNote === "string" && d.afterFeeNote.trim() ? d.afterFeeNote : undefined,
    variant,
    daysUntilDue,
  };

  const resp = await resend.emails.send({
    from: "Prime Swim Academy <noreply@primeswimacademy.com>",
    to: parentEmail,
    bcc: ["prime.swim.us@gmail.com"],
    subject: buildTuitionEmailSubject(payload),
    html: buildTuitionEmailHtml(payload),
  });

  const now = new Date().toISOString();
  await ref.update({
    emailStatus: "sent",
    lastSentAt: now,
    lastEmailKind: variant,
    updatedAt: now,
    ...(variant === "invoice" && !d.firstInvoiceSentAt ? { firstInvoiceSentAt: now } : {}),
  });

  await adminDb.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).set(
    { status: "sent", updatedAt: now },
    { merge: true }
  );

  return { swimmerId, variant, resp };
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as {
      swimmerId?: string;
      kind?: TuitionEmailVariant | "auto";
      batch?: boolean;
    };

    const kind = body.kind ?? "auto";

    if (body.batch) {
      const monthSnap = await adminDb.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get();
      if (!monthReadyToSendEmail(normalizeMonthDoc(month, monthSnap.data()).status)) {
        return NextResponse.json({ error: "Recalculate tuition in Review before sending" }, { status: 400 });
      }
      const invoices = await loadInvoices(adminDb, month);
      const targets = invoices.filter((i) => !i.paid && i.parentEmail.includes("@"));
      const results: { swimmerId: string; ok: boolean; error?: string }[] = [];
      for (const inv of targets) {
        try {
          await sendOneInvoice(month, inv.swimmerId, kind);
          results.push({ swimmerId: inv.swimmerId, ok: true });
        } catch (e) {
          results.push({
            swimmerId: inv.swimmerId,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      const sent = results.filter((r) => r.ok).length;
      return NextResponse.json({ ok: true, sent, failed: results.length - sent, results });
    }

    const swimmerId = body.swimmerId?.trim();
    if (!swimmerId) {
      return NextResponse.json({ error: "Missing swimmerId or batch flag" }, { status: 400 });
    }

    try {
      const result = await sendOneInvoice(month, swimmerId, kind);
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "MONTH_NOT_READY") {
          return NextResponse.json({ error: "Recalculate tuition in Review before sending" }, { status: 400 });
        }
        if (e.message === "NOT_FOUND") {
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
        if (e.message === "ALREADY_PAID") {
          return NextResponse.json({ error: "Already marked paid" }, { status: 400 });
        }
        if (e.message === "NO_EMAIL") {
          return NextResponse.json({ error: "Missing parent email" }, { status: 400 });
        }
      }
      throw e;
    }
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 send:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
