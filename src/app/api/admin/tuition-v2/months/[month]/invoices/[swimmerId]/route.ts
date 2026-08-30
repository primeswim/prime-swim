export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { updateInvoice } from "@/lib/tuition-v2/invoice-service";

type RouteCtx = { params: Promise<{ month: string; swimmerId: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw, swimmerId } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    if (!swimmerId) return NextResponse.json({ error: "Missing swimmerId" }, { status: 400 });

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateInvoice>[3] = {};

    if (body.amount !== undefined) patch.amount = Number(body.amount);
    if (typeof body.dueDate === "string") patch.dueDate = body.dueDate;
    if (typeof body.afterFeeNote === "string") patch.afterFeeNote = body.afterFeeNote;
    if (typeof body.parentEmail === "string") patch.parentEmail = body.parentEmail;
    if (typeof body.parentName === "string") patch.parentName = body.parentName;
    if (Array.isArray(body.months)) patch.months = body.months.map(String);
    if (body.paid === true) {
      patch.paid = true;
      patch.paidOn = typeof body.paidOn === "string" ? body.paidOn : new Date().toISOString().slice(0, 10);
    }
    if (body.paid === false) {
      patch.paid = false;
      patch.paidOn = null;
    }
    if (body.clearManualOverride === true) {
      patch.manualOverride = null;
    }
    if (body.manualOverride && typeof body.manualOverride === "object") {
      const mo = body.manualOverride as { amount?: number; reason?: string };
      if (typeof mo.amount === "number") {
        patch.manualOverride = {
          amount: mo.amount,
          reason: typeof mo.reason === "string" ? mo.reason : "Admin override",
        };
        patch.amount = mo.amount;
      }
    }

    const updated = await updateInvoice(adminDb, month, swimmerId, patch);
    if (!updated) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json({ ok: true, invoice: updated });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 invoice PATCH:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
