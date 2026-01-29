// app/api/clinic/registrations/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

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

// GET: 获取所有注册
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(idToken);
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const registrationsRef = adminDb.collection("clinicRegistrations");
    const snap = await registrationsRef.orderBy("submittedAt", "desc").get();

    const registrations = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ ok: true, registrations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET clinic registrations error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

