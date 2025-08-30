// src/app/api/makeup/events/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return NextResponse.json({ ok: false, stage: "auth", error: "Missing token" }, { status: 401 });
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ ok: false, stage: "auth", error: "Invalid token" }, { status: 401 });
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
      return NextResponse.json({ ok: false, stage: "authz", error: "Not authorized" }, { status: 403 });
    }

    // Admin SDK 查询（createdAt 倒序）
    const snap = await adminDb.collection("makeup_events").orderBy("createdAt", "desc").get();
    const events = snap.docs.map((d) => {
    const data = d.data() || {};
    let createdAt: string | null = null;

    const raw = data.createdAt;
    if (raw instanceof Date) {
        createdAt = raw.toISOString();
    } else if (raw?.toDate) {
        // Firestore.Timestamp
        createdAt = raw.toDate().toISOString();
    } else if (typeof raw === "string") {
        createdAt = raw;
    }

    return {
        id: d.id,
        text: String(data.text ?? ""),
        createdAt,
        createdBy: String(data.createdBy ?? ""),
        active: Boolean(data.active),
    };
    });


    return NextResponse.json({ ok: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[events:${reqId}]`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
