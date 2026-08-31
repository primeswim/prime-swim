export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import {
  loadSwimmerResponses,
  normalizeSwimmerResponse,
  saveSwimmerResponsesBatch,
} from "@/lib/tuition-v2/swimmer-response-service";
import { listSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";
import { ensureMonthDoc } from "@/lib/tuition-v2/month-service";
import type { TuitionV2SwimmerResponse } from "@/lib/tuition-v2/types";

type RouteCtx = { params: Promise<{ month: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const [enrollments, responses] = await Promise.all([
      listSwimmerEnrollments(adminDb),
      loadSwimmerResponses(adminDb, month),
    ]);
    const responseById = new Map(responses.map((r) => [r.swimmerId, r]));

    const merged = enrollments.map((e) => ({
      enrollment: e,
      response: responseById.get(e.swimmerId) ?? normalizeSwimmerResponse(e.swimmerId, undefined),
    }));

    return NextResponse.json({ month, swimmers: merged });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 swimmer-responses GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    const email = await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as { responses?: TuitionV2SwimmerResponse[] };
    if (!Array.isArray(body.responses)) {
      return NextResponse.json({ error: "Missing responses array" }, { status: 400 });
    }

    await ensureMonthDoc(adminDb, month);
    await saveSwimmerResponsesBatch(adminDb, month, body.responses, email);
    const responses = await loadSwimmerResponses(adminDb, month);
    return NextResponse.json({ ok: true, responses });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 swimmer-responses PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
