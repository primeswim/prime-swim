export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import {
  ensureMonthDoc,
  loadLevelPlans,
  loadSessions,
  normalizeMonthDoc,
  updateMonthNoTraining,
} from "@/lib/tuition-v2/month-service";
import { TUITION_V2_MONTHS_COLLECTION } from "@/lib/tuition-v2/constants";

type RouteCtx = { params: Promise<{ month: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const monthDoc = await ensureMonthDoc(adminDb, month);
    const [levelPlans, sessions] = await Promise.all([
      loadLevelPlans(adminDb, month),
      loadSessions(adminDb, month),
    ]);

    return NextResponse.json({ month: monthDoc, levelPlans, sessions });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 month GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as { noTrainingDates?: string[] };
    if (!Array.isArray(body.noTrainingDates)) {
      return NextResponse.json({ error: "Missing noTrainingDates array" }, { status: 400 });
    }
    const noTrainingDates = body.noTrainingDates.filter(
      (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    );
    const monthDoc = await updateMonthNoTraining(adminDb, month, noTrainingDates);
    return NextResponse.json({ ok: true, month: monthDoc });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 month PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const snap = await adminDb.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get();
    if (snap.exists) {
      return NextResponse.json({ ok: true, month: normalizeMonthDoc(month, snap.data()) });
    }
    const monthDoc = await ensureMonthDoc(adminDb, month);
    return NextResponse.json({ ok: true, month: monthDoc, created: true });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 month POST:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
