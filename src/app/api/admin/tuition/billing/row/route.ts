export const runtime = "nodejs";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  TUITION_BILLING_COLLECTION,
  TUITION_BILLING_ROWS_SUBCOL,
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

/** PATCH — edit one billing row */
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as {
      month?: string;
      swimmerId?: string;
      parentName?: string;
      parentEmail?: string;
      amount?: number;
      practiceText?: string;
      dueDate?: string;
      afterFeeNote?: string;
      months?: string[];
      paid?: boolean;
      paidOn?: string | null;
      /** When setting paid=true without paidOn, use today (server local TZ) — client should send explicit date */
    };

    const month = body.month?.trim();
    const swimmerId = body.swimmerId?.trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    if (!swimmerId) {
      return NextResponse.json({ error: "Missing swimmerId" }, { status: 400 });
    }

    const ref = adminDb
      .collection(TUITION_BILLING_COLLECTION)
      .doc(month)
      .collection(TUITION_BILLING_ROWS_SUBCOL)
      .doc(swimmerId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Billing row not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (body.parentName !== undefined) updates.parentName = String(body.parentName);
    if (body.parentEmail !== undefined) updates.parentEmail = String(body.parentEmail).trim();
    if (body.amount !== undefined) {
      if (typeof body.amount !== "number" || body.amount < 0 || Number.isNaN(body.amount)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      updates.amount = body.amount;
    }
    if (body.practiceText !== undefined) updates.practiceText = String(body.practiceText);
    if (body.dueDate !== undefined) {
      const dd = String(body.dueDate);
      if (dd && !/^\d{4}-\d{2}-\d{2}$/.test(dd)) {
        return NextResponse.json({ error: "dueDate must be YYYY-MM-DD" }, { status: 400 });
      }
      updates.dueDate = dd;
    }
    if (body.afterFeeNote !== undefined) updates.afterFeeNote = String(body.afterFeeNote ?? "");
    if (Array.isArray(body.months) && body.months.length > 0) {
      updates.months = body.months.map(String);
    }
    if (body.paid !== undefined) {
      updates.paid = Boolean(body.paid);
      if (body.paid === true) {
        if (body.paidOn != null && String(body.paidOn).trim() !== "") {
          const po = String(body.paidOn);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(po)) {
            return NextResponse.json({ error: "paidOn must be YYYY-MM-DD" }, { status: 400 });
          }
          updates.paidOn = po;
        } else {
          const t = new Date();
          updates.paidOn = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        }
      } else {
        updates.paidOn = null;
      }
    }

    await ref.update(updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition billing row PATCH:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
