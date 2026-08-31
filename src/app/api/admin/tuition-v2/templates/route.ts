export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import {
  loadV2TemplatesWithSource,
  saveV2Templates,
  seedV2TemplatesDefaults,
} from "@/lib/tuition-v2/templates";
import { syncLevelPlansFromTemplates } from "@/lib/tuition-v2/month-service";
import type { TuitionV2LevelTemplateMap } from "@/lib/tuition-v2/types";

export async function GET(req: Request) {
  try {
    await requireTuitionV2Admin(req);
    const { levels, source } = await loadV2TemplatesWithSource(adminDb);
    return NextResponse.json({ levels, source });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 templates GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireTuitionV2Admin(req);
    const body = (await req.json()) as { levels?: TuitionV2LevelTemplateMap; syncMonth?: string };
    if (!body.levels || typeof body.levels !== "object") {
      return NextResponse.json({ error: "Missing levels object" }, { status: 400 });
    }
    const levels = await saveV2Templates(adminDb, body.levels);
    const syncMonth = parseMonthParam(body.syncMonth);
    const levelPlans = syncMonth
      ? await syncLevelPlansFromTemplates(adminDb, syncMonth, levels)
      : undefined;
    return NextResponse.json({ ok: true, levels, source: "v2_saved", ...(levelPlans ? { levelPlans } : {}) });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 templates PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireTuitionV2Admin(req);
    const body = (await req.json()) as { action?: string };
    if (body.action === "seed_defaults") {
      const levels = await seedV2TemplatesDefaults(adminDb);
      return NextResponse.json({ ok: true, levels, source: "v2_saved" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 templates POST:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
