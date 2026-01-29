// src/app/api/zelle-payment/resolve/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeId(v?: string | null) {
  return (v || "").trim();
}
function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

async function requireUid(req: Request): Promise<{ uid: string; email: string | null }> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) throw new Error("Missing token");
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    throw new Error("Invalid token");
  }
}

export async function GET(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const { uid, email } = await requireUid(req);

    const url = new URL(req.url);
    const paymentId = normalizeId(url.searchParams.get("paymentId"));
    const swimmerId = normalizeId(url.searchParams.get("swimmerId") || url.searchParams.get("id"));

    if (isValidDocId(paymentId)) {
      const psnap = await adminDb.collection("payments").doc(paymentId).get();
      if (!psnap.exists) {
        return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
      }
      const pdata = psnap.data() || {};
      const parentUID = String(pdata.parentUID || "");
      const resolvedSwimmerId = String(pdata.swimmerId || "");
      if (!parentUID || parentUID !== uid) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
      }
      if (!isValidDocId(resolvedSwimmerId)) {
        return NextResponse.json({ ok: false, error: "Invalid swimmerId on payment" }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        user: { uid, email },
        swimmerId: resolvedSwimmerId,
        paymentId,
      });
    }

    if (isValidDocId(swimmerId)) {
      const ssnap = await adminDb.collection("swimmers").doc(swimmerId).get();
      if (!ssnap.exists) {
        return NextResponse.json({ ok: false, error: "Swimmer not found" }, { status: 404 });
      }
      const sdata = ssnap.data() || {};
      const parentUID = String(sdata.parentUID || "");
      if (!parentUID || parentUID !== uid) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
      }
      return NextResponse.json({
        ok: true,
        user: { uid, email },
        swimmerId,
      });
    }

    return NextResponse.json({ ok: false, error: "Missing paymentId or swimmerId" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error(`[zelle:resolve:GET:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}


