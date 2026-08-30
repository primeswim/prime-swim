export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadInvoices } from "@/lib/tuition-v2/invoice-service";

type RouteCtx = { params: Promise<{ month: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    const invoices = await loadInvoices(adminDb, month);
    return NextResponse.json({ month, invoices });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 invoices GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
