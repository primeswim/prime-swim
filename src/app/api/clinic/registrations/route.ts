// app/api/clinic/registrations/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

async function requireAdmin(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    throw new Error("Missing token");
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    throw new Error("Invalid token");
  }

  const emailLower = (decoded.email ?? "").toLowerCase();
  const rawRole = (decoded as Record<string, unknown>)["role"];
  const hasAdminRole = typeof rawRole === "string" && rawRole.toLowerCase() === "admin";
  const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin =
    hasAdminRole ||
    (emailLower && allow.includes(emailLower)) ||
    (await isInAdminsServer(decoded.email ?? null, decoded.uid));

  if (!isAdmin) {
    throw new Error("Not authorized");
  }
  return decoded;
}

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

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinicId");

    let query = adminDb.collection("clinicRegistrations").orderBy("submittedAt", "desc");
    
    if (clinicId) {
      query = query.where("clinicId", "==", clinicId) as any;
    }

    const snap = await query.get();
    const registrations = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ ok: true, registrations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg === "Missing token" || msg === "Invalid token"
        ? 401
        : msg === "Not authorized"
        ? 403
        : 500;
    console.error("[clinic/registrations:GET]", err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

