export const runtime = "nodejs";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { runTuitionCalculate } from "@/lib/tuition-calculate";
import {
  TUITION_BILLING_COLLECTION,
  TUITION_BILLING_ROWS_SUBCOL,
  billingMonthLabel,
  defaultDueDateForBilledMonth,
} from "@/lib/tuition-billing-shared";

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

/** POST — create/update billing rows from calculator. Body: { month, overwriteUnpaidComputed?: boolean } */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as {
      month?: string;
      overwriteUnpaidComputed?: boolean;
      levels?: string[];
    };
    const month = body.month?.trim();
    const overwriteUnpaidComputed = Boolean(body.overwriteUnpaidComputed);
    const levels = Array.isArray(body.levels)
      ? body.levels.map((l) => String(l).trim()).filter(Boolean)
      : undefined;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    }

    const { results } = await runTuitionCalculate(adminDb, month, { levels });
    const monthParent = billingMonthLabel(month);
    const defaultDue = defaultDueDateForBilledMonth(month);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const col = adminDb.collection(TUITION_BILLING_COLLECTION).doc(month).collection(TUITION_BILLING_ROWS_SUBCOL);

    for (const r of results) {
      const ref = col.doc(r.swimmerId);
      const existing = await ref.get();
      const practiceText = r.scheduleLines.join("\n");

      if (!existing.exists) {
        await ref.set({
          month,
          swimmerName: r.swimmerName,
          level: r.level,
          parentName: r.parentName,
          parentEmail: r.parentEmail,
          amount: r.tuition,
          practiceText,
          dueDate: defaultDue,
          months: monthParent,
          afterFeeNote: "",
          paid: false,
          paidOn: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        created += 1;
        continue;
      }

      const d = existing.data()!;
      if (d.paid === true) {
        skipped += 1;
        continue;
      }

      if (overwriteUnpaidComputed) {
        await ref.update({
          swimmerName: r.swimmerName,
          level: r.level,
          parentName: r.parentName,
          parentEmail: r.parentEmail || d.parentEmail,
          amount: r.tuition,
          practiceText,
          months: monthParent,
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      month,
      counts: { created, updated, skipped, totalCalculateRows: results.length },
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition billing prepare:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
