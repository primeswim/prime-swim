// src/app/api/zelle-payment/confirm/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  swimmerId: string;
  paymentId?: string | null;
  payerName: string;
  payerMemo?: string | null;
};

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

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const { uid, email } = await requireUid(req);

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const swimmerId = normalizeId(body?.swimmerId);
    const paymentId = normalizeId(body?.paymentId || null);
    const payerName = String(body?.payerName || "").trim();
    const payerMemo = String(body?.payerMemo || "").trim();

    if (!isValidDocId(swimmerId)) {
      return NextResponse.json({ ok: false, error: "Invalid swimmerId" }, { status: 400 });
    }
    if (!payerName) {
      return NextResponse.json({ ok: false, error: "payerName required" }, { status: 400 });
    }

    // ownership via swimmer
    const swRef = adminDb.collection("swimmers").doc(swimmerId);
    const swSnap = await swRef.get();
    if (!swSnap.exists) {
      return NextResponse.json({ ok: false, error: "Swimmer not found" }, { status: 404 });
    }
    const sw = swSnap.data() || {};
    const parentUID = String(sw.parentUID || "");
    if (!parentUID || parentUID !== uid) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    let finalPaymentId = paymentId || null;

    if (isValidDocId(paymentId)) {
      // ensure payment belongs
      const pRef = adminDb.collection("payments").doc(paymentId);
      const pSnap = await pRef.get();
      if (!pSnap.exists) {
        return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
      }
      const pdata = pSnap.data() || {};
      if (String(pdata.parentUID || "") !== uid || String(pdata.swimmerId || "") !== swimmerId) {
        return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
      }
      await pRef.set(
        {
          payerName,
          payerMemo: payerMemo || null,
          status: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // create registration payment record (pending means parent claims transfer completed)
      const pRef = await adminDb.collection("payments").add({
        swimmerId,
        parentUID: uid,
        parentEmail: email,
        status: "pending",
        method: "zelle",
        amountCents: 7500,
        payerName,
        payerMemo: payerMemo || null,
        createdAt: FieldValue.serverTimestamp(),
      });
      finalPaymentId = pRef.id;
    }

    await swRef.set(
      {
        paymentStatus: "pending",
        paymentName: payerName,
        paymentMemo: payerMemo || null,
        lastPaymentId: finalPaymentId,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, paymentId: finalPaymentId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error(`[zelle:confirm:POST:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}


