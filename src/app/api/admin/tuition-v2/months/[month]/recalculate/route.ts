export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { recalculateInvoices } from "@/lib/tuition-v2/invoice-service";

type RouteCtx = { params: Promise<{ month: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    let levels: string[] | undefined;
    let syncRoster = true;
    try {
      const body: { levels?: unknown; syncRoster?: unknown } = await req.json();
      if (Array.isArray(body?.levels)) {
        levels = body.levels.filter((l: unknown): l is string => typeof l === "string" && l.trim().length > 0);
      }
      // Partial level recalc skips full roster sync unless explicitly requested.
      syncRoster = body.syncRoster === true ? true : body.syncRoster === false ? false : !levels?.length;
    } catch {
      // empty body — all levels + one roster sync
      syncRoster = true;
    }

    const result = await recalculateInvoices(adminDb, month, { levels, syncRoster });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 recalculate:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
