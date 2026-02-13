export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

async function requireAdmin(req: Request): Promise<void> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    if (!id || id.trim().length === 0) {
      return NextResponse.json({ error: "Missing swimmer id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      trainingWeekdays?: number[];
      trainingTimeSlot?: string | null;
      trainingLocation?: string | null;
      ratePerHourOverride?: number | string | null;
    };

    const updates: Record<string, unknown> = {};
    if (Array.isArray(body.trainingWeekdays)) {
      updates.trainingWeekdays = body.trainingWeekdays.filter(
        (n) => typeof n === "number" && n >= 0 && n <= 6
      );
    }
    if (body.trainingTimeSlot !== undefined) {
      updates.trainingTimeSlot = body.trainingTimeSlot == null || body.trainingTimeSlot === "" ? null : String(body.trainingTimeSlot);
    }
    if (body.trainingLocation !== undefined) {
      updates.trainingLocation = body.trainingLocation == null || body.trainingLocation === "" ? null : String(body.trainingLocation);
    }
    if (body.ratePerHourOverride !== undefined) {
      const v = body.ratePerHourOverride;
      updates.ratePerHourOverride = (v == null || v === "") ? null : Number(v);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const ref = adminDb.collection("swimmers").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Swimmer not found" }, { status: 404 });
    }

    await ref.update(updates);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition swimmers PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
