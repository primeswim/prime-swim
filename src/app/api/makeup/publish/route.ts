// app/api/makeup/publish/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

// ✅ 必须在 Node.js runtime（Admin SDK 不支持 Edge）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 复用你的服务端管理员检查
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

type Body = {
  makeupText: string;
  swimmerIds: string[];
};

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8); // 简易请求标记
  try {
    // 1) AuthN
    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";

    console.log(`[publish:${reqId}] headers.authorization exists=`, !!authHeader);

    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!idToken) {
      console.error(`[publish:${reqId}] missing bearer token`);
      return NextResponse.json({ ok: false, stage: "auth", error: "Missing token" }, { status: 401 });
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e: unknown) {
      console.error(`[publish:${reqId}] verifyIdToken error:`, e);
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
      (emailLower !== "" && allow.includes(emailLower)) ||
      (await isInAdminsServer(decoded.email ?? null, decoded.uid));

    console.log(`[publish:${reqId}] decoded.uid=`, decoded.uid, " email=", decoded.email, " isAdmin=", isAdmin);

    if (!isAdmin) {
      console.error(`[publish:${reqId}] not authorized`);
      return NextResponse.json({ ok: false, stage: "authz", error: "Not authorized" }, { status: 403 });
    }

    // 2) Parse body
    let body: Body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[publish:${reqId}] JSON parse error:`, e);
      return NextResponse.json({ ok: false, stage: "parse", error: "Invalid JSON body" }, { status: 400 });
    }

    const { makeupText, swimmerIds } = body || ({} as Body);
    console.log(`[publish:${reqId}] body=`, body);

    if (!makeupText?.trim() || !Array.isArray(swimmerIds) || swimmerIds.length === 0) {
      return NextResponse.json(
        { ok: false, stage: "validate", error: "makeupText and swimmerIds are required" },
        { status: 400 }
      );
    }

    // 校验 doc id 合法性（最常见的触发该错误的原因就是 id 里有 `/` 或为空）
    const invalidIds = swimmerIds.filter((sid) => !isValidDocId(sid));
    if (invalidIds.length) {
      console.error(`[publish:${reqId}] invalid swimmerIds:`, invalidIds);
      return NextResponse.json(
        {
          ok: false,
          stage: "validate",
          error: "Invalid swimmerIds (must be non-empty and must not contain '/')",
          details: { invalidIds },
        },
        { status: 400 }
      );
    }
    console.log(`[publish:${reqId}] swimmerIds count=`, swimmerIds.length, " sample=", swimmerIds.slice(0, 5));

    // 3) Create event & batch update
    const eventRef = adminDb.collection("makeup_events").doc(); // pre-generate ID
    const eventId = eventRef.id;

    console.log(`[publish:${reqId}] eventId=`, eventId);

    const batch = adminDb.batch();
    batch.set(eventRef, {
      text: makeupText.trim(),
      createdAt: new Date(),
      createdBy: decoded.email || decoded.uid || "admin",
      active: true,
    });

    // 单独 try/catch，定位是哪个 swimmerId 触发了错误
    for (const sid of swimmerIds) {
      try {
        const sref = adminDb.collection("swimmers").doc(sid);
        batch.set(
          sref,
          {
            nextMakeupText: makeupText.trim(),
            nextMakeupId: eventId,
          },
          { merge: true }
        );
      } catch (e) {
        console.error(`[publish:${reqId}] batch.set failed for swimmerId=`, sid, " error=", e);
        return NextResponse.json(
          { ok: false, stage: "batch-set", error: "Failed to prepare batch for swimmer", details: { sid } },
          { status: 500 }
        );
      }
    }

    try {
      await batch.commit();
    } catch (e) {
      console.error(`[publish:${reqId}] batch.commit error:`, e);
      return NextResponse.json(
        { ok: false, stage: "commit", error: "Batch commit failed", details: String(e) },
        { status: 500 }
      );
    }

    console.log(`[publish:${reqId}] success: updated`, swimmerIds.length, "swimmer(s)");
    return NextResponse.json({ ok: true, eventId, count: swimmerIds.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publish:${reqId}] unhandled error:`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
