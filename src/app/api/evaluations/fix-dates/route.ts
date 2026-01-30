// app/api/evaluations/fix-dates/route.ts
// One-time script to fix evaluation dates
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// 检查是否为 admin
async function isInAdminsServer(email?: string | null, uid?: string | null) {
  const e = (email || "").trim().toLowerCase();
  const u = uid || undefined;
  const colNames = ["admin", "admins"];

  for (const col of colNames) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get();
      if (byEmail.exists) return true;
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get();
      if (byUid.exists) return true;
    }
  }
  for (const col of colNames) {
    if (e) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get();
      if (!snap.empty) return true;
    }
  }
  return false;
}

// POST: 修复 evaluation 日期
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(idToken);
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // 获取所有 evaluations，按 createdAt 排序（最新的在前）
    const snap = await adminDb
      .collection("evaluations")
      .orderBy("createdAt", "desc")
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, message: "No evaluations found" });
    }

    const evaluations = snap.docs;
    
    // 修复最新的 evaluation 日期为 1/27/2026
    if (evaluations.length > 0) {
      const latest = evaluations[0];
      const latestDate = Timestamp.fromDate(new Date("2026-01-27"));
      await latest.ref.update({ evaluatedAt: latestDate });
      console.log(`Fixed latest evaluation ${latest.id} to 2026-01-27`);
    }

    // 修复上一次的 evaluation 日期为 11/25/2026
    if (evaluations.length > 1) {
      const previous = evaluations[1];
      const previousDate = Timestamp.fromDate(new Date("2026-11-25"));
      await previous.ref.update({ evaluatedAt: previousDate });
      console.log(`Fixed previous evaluation ${previous.id} to 2026-11-25`);
    }

    return NextResponse.json({
      ok: true,
      message: `Fixed ${Math.min(evaluations.length, 2)} evaluation(s)`,
      fixed: {
        latest: evaluations.length > 0 ? evaluations[0].id : null,
        previous: evaluations.length > 1 ? evaluations[1].id : null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fix evaluation dates error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

