export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { updateSession } from "@/lib/tuition-v2/month-service";

type RouteCtx = { params: Promise<{ month: string; sessionId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw, sessionId } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const body = (await req.json()) as {
      cancelled?: boolean;
      cancelReason?: string;
      timeSlot?: string;
      location?: string;
    };

    const updated = await updateSession(adminDb, month, sessionId, {
      ...(body.cancelled !== undefined ? { cancelled: Boolean(body.cancelled) } : {}),
      ...(body.cancelReason !== undefined ? { cancelReason: body.cancelReason } : {}),
      ...(body.timeSlot !== undefined ? { timeSlot: body.timeSlot } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
    });

    if (!updated) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json({ ok: true, session: updated });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 session PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
