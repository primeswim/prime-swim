export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import {
  TUITION_BILLING_COLLECTION,
  TUITION_BILLING_ROWS_SUBCOL,
  type TuitionBillingRow,
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

function millisFromFirestore(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function serializeRow(docSnap: DocumentSnapshot): TuitionBillingRow {
  const d = docSnap.data()!;
  return {
    month: String(d.month || ""),
    swimmerId: docSnap.id,
    swimmerName: String(d.swimmerName || ""),
    level: String(d.level || ""),
    parentName: String(d.parentName || ""),
    parentEmail: String(d.parentEmail || ""),
    amount: typeof d.amount === "number" ? d.amount : 0,
    baseAmount: typeof d.baseAmount === "number" ? d.baseAmount : d.baseAmount === null ? null : undefined,
    siblingDiscountPercent:
      typeof d.siblingDiscountPercent === "number"
        ? d.siblingDiscountPercent
        : d.siblingDiscountPercent === null
          ? null
          : undefined,
    siblingDiscountApplied: d.siblingDiscountApplied === true ? true : d.siblingDiscountApplied === false ? false : undefined,
    practiceText: typeof d.practiceText === "string" ? d.practiceText : "",
    dueDate: String(d.dueDate || ""),
    months: Array.isArray(d.months) ? (d.months as string[]) : [],
    afterFeeNote: typeof d.afterFeeNote === "string" ? d.afterFeeNote : "",
    paid: Boolean(d.paid),
    paidOn: d.paidOn == null ? null : String(d.paidOn),
    createdAtMillis: millisFromFirestore(d.createdAt),
    updatedAtMillis: millisFromFirestore(d.updatedAt),
    firstInvoiceSentAtMillis: millisFromFirestore(d.firstInvoiceSentAt ?? null),
    lastSentAtMillis: millisFromFirestore(d.lastSentAt ?? null),
    lastEmailKind: d.lastEmailKind == null ? null : String(d.lastEmailKind),
    reminder2dSentAtMillis: millisFromFirestore(d.reminder2dSentAt ?? null),
    reminder1dSentAtMillis: millisFromFirestore(d.reminder1dSentAt ?? null),
    pastDueSentAtMillis: millisFromFirestore(d.pastDueSentAt ?? null),
    lastManualReminderAtMillis: millisFromFirestore(d.lastManualReminderAt ?? null),
  };
}

/** GET — list billing rows for a month */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    }

    const snap = await adminDb
      .collection(TUITION_BILLING_COLLECTION)
      .doc(month)
      .collection(TUITION_BILLING_ROWS_SUBCOL)
      .get();

    const rows = snap.docs.map((d) => serializeRow(d));
    rows.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
    return NextResponse.json({ month, rows });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition billing GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
