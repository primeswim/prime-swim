export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { updateEnrollmentRegularWeekdays } from "@/lib/tuition-v2/enrollment-service";
import { refreshMonthDerivedData } from "@/lib/tuition-v2/refresh-month";

type RouteCtx = { params: Promise<{ swimmerId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const email = await requireTuitionV2Admin(req);
    const { swimmerId } = await ctx.params;
    if (!swimmerId?.trim()) {
      return NextResponse.json({ error: "Missing swimmer id" }, { status: 400 });
    }

    const body = (await req.json()) as { regularWeekdays?: unknown; refreshMonth?: unknown };
    if (!Array.isArray(body.regularWeekdays)) {
      return NextResponse.json({ error: "Missing regularWeekdays array" }, { status: 400 });
    }

    const regularWeekdays = body.regularWeekdays.filter(
      (n): n is number => typeof n === "number" && n >= 0 && n <= 6
    );

    const enrollment = await updateEnrollmentRegularWeekdays(
      adminDb,
      swimmerId,
      regularWeekdays
    );
    if (!enrollment) {
      return NextResponse.json({ error: "Swimmer not found or not eligible" }, { status: 404 });
    }

    const refreshMonth =
      typeof body.refreshMonth === "string" ? parseMonthParam(body.refreshMonth) : null;
    let invoiceCount: number | undefined;
    let rosterSlotCount: number | undefined;
    if (refreshMonth) {
      const refreshed = await refreshMonthDerivedData(adminDb, refreshMonth, {
        actor: email,
        swimmerIds: [swimmerId],
      });
      invoiceCount = refreshed.invoiceCount;
      rosterSlotCount = refreshed.roster.slotCount;
    }

    return NextResponse.json({
      ok: true,
      enrollment,
      ...(invoiceCount !== undefined ? { invoiceCount, rosterSlotCount } : {}),
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 enrollments PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
