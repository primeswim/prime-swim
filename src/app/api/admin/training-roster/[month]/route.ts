export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadTrainingRoster, saveTrainingRoster } from "@/lib/training-roster";

type RouteCtx = { params: Promise<{ month: string }> };

/** GET — return cached roster for the month (404 if never generated). */
export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const roster = await loadTrainingRoster(adminDb, month);
    if (!roster) {
      return NextResponse.json(
        { error: "No saved roster for this month. Click Generate to create one.", month },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, roster, cached: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("training-roster GET:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — recompute from Tuition V2 and save one entry for this month. */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const email = await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const roster = await saveTrainingRoster(adminDb, month, email);
    return NextResponse.json({ ok: true, roster, cached: false });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("training-roster POST:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
