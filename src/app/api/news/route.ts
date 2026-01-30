// app/api/news/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

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
  const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin =
    allow.includes(emailLower) ||
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

// GET: 获取所有 news（需要 admin 权限）
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const snap = await adminDb
      .collection("news")
      .orderBy("createdAt", "desc")
      .get();

    const newsList = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data?.title || "",
        content: data?.content || "",
        summary: data?.summary || "",
        image: data?.image || "",
        category: data?.category || "",
        author: data?.author || "",
        publishDate: data?.publishDate || "",
        isPublished: data?.isPublished || false,
        createdAt: data?.createdAt,
      };
    });

    return NextResponse.json({ ok: true, news: newsList });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg === "Missing token" || msg === "Invalid token"
        ? 401
        : msg === "Not authorized"
        ? 403
        : 500;
    console.error("[news:GET]", err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

