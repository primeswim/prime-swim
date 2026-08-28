export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { runTuitionCalculate } from "@/lib/tuition-calculate";
import { calculateWithSavedTuitionOverrides } from "@/lib/tuition-month-overrides";

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
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
    }

    const levelsParam = searchParams.get("levels");
    const levels = levelsParam
      ? levelsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const { month: m, noTrainingDates, results: calculated, levelsFilter } =
      await runTuitionCalculate(adminDb, month, { levels });
    const results = await calculateWithSavedTuitionOverrides(adminDb, month, calculated);
    const calculatedTuitionBySwimmerId = Object.fromEntries(
      calculated.map((r) => [r.swimmerId, r.tuition])
    );
    return NextResponse.json({
      month: m,
      noTrainingDates,
      results,
      calculatedTuitionBySwimmerId,
      levelsFilter,
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition calculate GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
