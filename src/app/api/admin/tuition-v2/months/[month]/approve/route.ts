export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { approveMonth, loadInvoices } from "@/lib/tuition-v2/invoice-service";
import { normalizeMonthDoc } from "@/lib/tuition-v2/month-service";
import { TUITION_V2_MONTHS_COLLECTION } from "@/lib/tuition-v2/constants";

type RouteCtx = { params: Promise<{ month: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const email = await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const invoices = await loadInvoices(adminDb, month);
    if (invoices.length === 0) {
      return NextResponse.json({ error: "Recalculate tuition first" }, { status: 400 });
    }

    const monthDoc = await approveMonth(adminDb, month, email);
    return NextResponse.json({ ok: true, month: monthDoc });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 approve:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    const snap = await adminDb.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get();
    return NextResponse.json({
      month: normalizeMonthDoc(month, snap.data()),
      approved: snap.data()?.status === "approved",
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 approve GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
