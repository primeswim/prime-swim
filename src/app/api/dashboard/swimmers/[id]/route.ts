// src/app/api/dashboard/swimmers/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

async function requireUid(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) throw new Error("Missing token");
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new Error("Invalid token");
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const uid = await requireUid(req);
    const { id } = await ctx.params;
    if (!isValidDocId(id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const swRef = adminDb.collection("swimmers").doc(id);
    const swSnap = await swRef.get();
    if (!swSnap.exists) {
      return NextResponse.json({ ok: false, error: "Swimmer not found" }, { status: 404 });
    }

    const parentUID = String(swSnap.data()?.parentUID || "");
    if (!parentUID || parentUID !== uid) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    await swRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error(`[dashboard:swimmers:DELETE:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}


