// src/app/api/register/swimmer/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown> & {
  maappAckAt?: boolean; // if true, we set maappAckAt server timestamp
};

async function requireUser(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) throw new Error("Missing token");
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    throw new Error("Invalid token");
  }
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const decoded = await requireUser(req);

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // Separate flag control from actual payload
    const { maappAckAt, ...rest } = body || {};

    const payload = {
      ...rest,
      parentUID: decoded.uid,
      parentEmail: (decoded.email ?? (rest as Record<string, unknown>).parentEmail) || null,
      isAdult: false,
      createdAt: FieldValue.serverTimestamp(),
      ...(maappAckAt ? { maappAckAt: FieldValue.serverTimestamp() } : {}),
    };

    const docRef = await adminDb.collection("swimmers").add(payload);
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error(`[register:swimmer:POST:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}


