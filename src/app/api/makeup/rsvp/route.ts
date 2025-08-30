// src/app/api/makeup/rsvp/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  swimmerId: string;
  makeupId: string;
  status: "yes" | "no" | "none";
};

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    // 1) Auth
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
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

    // 2) Parse
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, stage: "parse", error: "Invalid JSON body" }, { status: 400 });
    }
    const { swimmerId, makeupId, status } = body || ({} as Body);

    if (!isValidDocId(swimmerId) || !isValidDocId(makeupId)) {
      return NextResponse.json(
        { ok: false, stage: "validate", error: "Invalid swimmerId or makeupId" },
        { status: 400 }
      );
    }
    if (!["yes", "no", "none"].includes(status)) {
      return NextResponse.json(
        { ok: false, stage: "validate", error: "Invalid status" },
        { status: 400 }
      );
    }

    // 3) Authorization: ensure this parent owns the swimmer
    const swimmerSnap = await adminDb.collection("swimmers").doc(swimmerId).get();
    if (!swimmerSnap.exists) {
      return NextResponse.json(
        { ok: false, stage: "authz", error: "Swimmer not found" },
        { status: 404 }
      );
    }
    const swimmerData = swimmerSnap.data() || {};
    const parentUID = String(swimmerData.parentUID || "");
    if (!parentUID || parentUID !== decoded.uid) {
      // if you have multiple parents: parentUIDs: string[] and check .includes(decoded.uid)
      return NextResponse.json(
        { ok: false, stage: "authz", error: "Not allowed to RSVP for this swimmer" },
        { status: 403 }
      );
    }

    // 4) Write RSVP: makeup_responses/{swimmerId}_{makeupId}
    const docId = `${swimmerId}_${makeupId}`;
    await adminDb
      .collection("makeup_responses")
      .doc(docId)
      .set(
        {
          swimmerId,
          makeupId,
          status,
          parentUID: decoded.uid,
          parentEmail: decoded.email || null,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, docId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rsvp:${reqId}] error:`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
