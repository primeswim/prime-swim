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

    // 获取所有 evaluations
    const snap = await adminDb.collection("evaluations").get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, message: "No evaluations found" });
    }

    const evaluations = snap.docs;
    let fixedCount = 0;
    
    // 将所有 evaluation 的 evaluatedAt 设置为 createdAt
    for (const doc of evaluations) {
      const data = doc.data();
      const createdAt = data.createdAt;
      
      // 如果 createdAt 存在，将其设置为 evaluatedAt
      if (createdAt) {
        await doc.ref.update({ evaluatedAt: createdAt });
        fixedCount++;
        console.log(`Fixed evaluation ${doc.id}: set evaluatedAt to createdAt`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Fixed ${fixedCount} evaluation(s) by setting evaluatedAt to createdAt`,
      fixedCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fix evaluation dates error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

