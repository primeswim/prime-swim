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

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
    }
    const snap = await adminDb.collection("tuition_month_config").doc(month).get();
    const noTrainingDates: string[] = snap.exists && Array.isArray(snap.data()?.noTrainingDates)
      ? snap.data()!.noTrainingDates
      : [];
    return NextResponse.json({ month, noTrainingDates });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition month-config GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as { month: string; noTrainingDates: string[] };
    const month = body.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
    }
    const noTrainingDates = Array.isArray(body.noTrainingDates)
      ? body.noTrainingDates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
    const ref = adminDb.collection("tuition_month_config").doc(month);
    await ref.set({ noTrainingDates, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true, month, noTrainingDates });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition month-config PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
