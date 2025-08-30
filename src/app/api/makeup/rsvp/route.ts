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

function normalizeId(s?: string | null) {
  return (s || "").trim();
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
    const swimmerId = normalizeId(body?.swimmerId);
    const makeupId = normalizeId(body?.makeupId);
    const status = body?.status;

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

/**
 * NEW: 批量读取 RSVP 状态
 * 请求体：
 *   { pairs: Array<{ swimmerId: string; makeupId: string }> }
 * 返回：
 *   { ok: true, map: Record<`${swimmerId}_${makeupId}`, "yes"|"no"|"none"> }
 */
export async function PUT(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    // 1) Auth
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!idToken) {
      return NextResponse.json({ ok: false, stage: "auth", error: "Missing token" }, { status: 401 });
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ ok: false, stage: "auth", error: "Invalid token" }, { status: 401 });
    }

    // 2) Parse body
    let body: { pairs?: Array<{ swimmerId?: string; makeupId?: string }> };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, stage: "parse", error: "Invalid JSON body" }, { status: 400 });
    }

    const rawPairs = Array.isArray(body?.pairs) ? body!.pairs! : [];
    const pairs = rawPairs
      .map((p) => ({
        swimmerId: normalizeId(p.swimmerId),
        makeupId: normalizeId(p.makeupId),
      }))
      .filter((p) => isValidDocId(p.swimmerId) && isValidDocId(p.makeupId));

    if (!pairs.length) {
      return NextResponse.json({ ok: false, stage: "validate", error: "pairs required" }, { status: 400 });
    }

    // 3) 校验每个 swimmer 归属 + 读 RSVP
    const result: Record<string, "yes" | "no" | "none"> = {};

    for (const { swimmerId, makeupId } of pairs) {
      // 归属校验
      const swimmerSnap = await adminDb.collection("swimmers").doc(swimmerId).get();
      if (!swimmerSnap.exists) {
        result[`${swimmerId}_${makeupId}`] = "none";
        continue;
      }
      const swimmerData = swimmerSnap.data() || {};
      const parentUID = String(swimmerData.parentUID || "");
      if (!parentUID || parentUID !== decoded.uid) {
        result[`${swimmerId}_${makeupId}`] = "none";
        continue;
      }

      // 读 RSVP
      const rsvpDoc = await adminDb.collection("makeup_responses").doc(`${swimmerId}_${makeupId}`).get();
      if (!rsvpDoc.exists) {
        result[`${swimmerId}_${makeupId}`] = "none";
      } else {
        const st = rsvpDoc.data()?.status as "yes" | "no" | "none" | undefined;
        result[`${swimmerId}_${makeupId}`] = st || "none";
      }
    }

    return NextResponse.json({ ok: true, map: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rsvp:status:${reqId}] error:`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
