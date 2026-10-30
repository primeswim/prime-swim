export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { updateEnrollmentRegularWeekdays } from "@/lib/tuition-v2/enrollment-service";
import { validTrainingStartDate } from "@/lib/tuition-v2/enrollment-schedule";
import { openBillingMonths, refreshMonthDerivedData } from "@/lib/tuition-v2/refresh-month";

type RouteCtx = { params: Promise<{ swimmerId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const email = await requireTuitionV2Admin(req);
    const { swimmerId } = await ctx.params;
    if (!swimmerId?.trim()) {
      return NextResponse.json({ error: "Missing swimmer id" }, { status: 400 });
    }

    const body = (await req.json()) as { regularWeekdays?: unknown; refreshMonth?: unknown; trainingStartDate?: unknown };
    if (!Array.isArray(body.regularWeekdays)) {
      return NextResponse.json({ error: "Missing regularWeekdays array" }, { status: 400 });
    }

    if (body.trainingStartDate !== undefined && !validTrainingStartDate(body.trainingStartDate)) {
      return NextResponse.json({ error: "A valid first training date (YYYY-MM-DD) is required" }, { status: 400 });
    }
    const refreshMonth = typeof body.refreshMonth === "string" ? parseMonthParam(body.refreshMonth) : null;
    if (body.refreshMonth !== undefined && !refreshMonth) {
      return NextResponse.json({ error: "Invalid refresh month" }, { status: 400 });
    }
    const regularWeekdays = body.regularWeekdays.filter(
      (n): n is number => typeof n === "number" && n >= 0 && n <= 6
    );

    const previous = await adminDb.collection("tuition_v2_swimmer_enrollment").doc(swimmerId).get();
    const startChanged = body.trainingStartDate !== undefined &&
      body.trainingStartDate !== previous.data()?.trainingStartDate;
    const enrollment = await updateEnrollmentRegularWeekdays(
      adminDb,
      swimmerId,
      regularWeekdays,
      body.trainingStartDate as string | undefined
    );
    if (!enrollment) {
      return NextResponse.json({ error: "Swimmer not found or not eligible" }, { status: 404 });
    }

    const months = new Set(openBillingMonths());
    if (refreshMonth) months.add(refreshMonth);
    let invoiceCount = 0;
    let rosterSlotCount = 0;
    for (const month of months) {
      const refreshed = await refreshMonthDerivedData(adminDb, month, {
        actor: email, swimmerIds: [swimmerId], preserveFinalizedInvoices: startChanged,
      });
      invoiceCount += refreshed.invoiceCount;
      rosterSlotCount += refreshed.roster.slotCount;
    }

    return NextResponse.json({
      ok: true,
      enrollment,
      ...(startChanged ? {billingNotice: "Existing paid, sent, published or manually adjusted invoices are preserved. Review them separately if a billing correction is needed."} : {}),
      ...(invoiceCount !== undefined ? { invoiceCount, rosterSlotCount } : {}),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 enrollments PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
