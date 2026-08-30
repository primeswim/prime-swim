export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import {
  loadSwimmerEnrollments,
  updateEnrollmentRegularWeekdays,
} from "@/lib/tuition-v2/enrollment-service";

type RouteCtx = { params: Promise<{ swimmerId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { swimmerId } = await ctx.params;
    if (!swimmerId?.trim()) {
      return NextResponse.json({ error: "Missing swimmer id" }, { status: 400 });
    }

    const body = (await req.json()) as { regularWeekdays?: unknown };
    if (!Array.isArray(body.regularWeekdays)) {
      return NextResponse.json({ error: "Missing regularWeekdays array" }, { status: 400 });
    }

    const regularWeekdays = body.regularWeekdays.filter(
      (n): n is number => typeof n === "number" && n >= 0 && n <= 6
    );

    await loadSwimmerEnrollments(adminDb);
    const enrollment = await updateEnrollmentRegularWeekdays(
      adminDb,
      swimmerId,
      regularWeekdays
    );
    if (!enrollment) {
      return NextResponse.json({ error: "Swimmer not found or not eligible" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, enrollment });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 enrollments PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
