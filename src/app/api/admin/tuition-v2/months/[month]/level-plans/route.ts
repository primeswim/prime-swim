export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadLevelPlans, saveLevelPlans, syncLevelPlansFromTemplates } from "@/lib/tuition-v2/month-service";
import { loadV2Templates, loadV2TemplatesWithSource, normalizeLevelPlan } from "@/lib/tuition-v2/templates";
import type { TuitionV2LevelPlan } from "@/lib/tuition-v2/types";

type RouteCtx = { params: Promise<{ month: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    const levelPlans = await loadLevelPlans(adminDb, month);
    return NextResponse.json({ month, levelPlans });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 level-plans GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as { levelPlans?: TuitionV2LevelPlan[] };
    if (!Array.isArray(body.levelPlans)) {
      return NextResponse.json({ error: "Missing levelPlans array" }, { status: 400 });
    }

    const templates = await loadV2Templates(adminDb);
    const levelPlans = body.levelPlans.map((p) =>
      normalizeLevelPlan(
        p.level,
        p,
        templates[p.level] ?? {
          defaultRatePerHour: 0,
          minDaysPerWeek: 2,
          reducedRatePerHour: null,
          weeklySlots: [],
          defaultTimeSlot: "7-8PM",
          defaultLocation: "Mary Wayte Pool",
        },
        month
      )
    );
    await saveLevelPlans(adminDb, month, levelPlans);
    return NextResponse.json({ ok: true, levelPlans });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 level-plans PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as { action?: string };
    if (body.action === "init_from_templates" || body.action === "sync_from_templates") {
      const { levels, source } = await loadV2TemplatesWithSource(adminDb);
      if (source === "not_initialized") {
        return NextResponse.json(
          { error: "Initialize and save V2 level templates first (Level Templates tab)." },
          { status: 400 }
        );
      }
      const levelPlans = await syncLevelPlansFromTemplates(adminDb, month, levels);
      return NextResponse.json({ ok: true, levelPlans, templateSource: source });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 level-plans POST:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
