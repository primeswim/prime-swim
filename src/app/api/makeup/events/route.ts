// src/app/api/makeup/events/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeId(s?: string | null) {
  return (s || "").trim();
}
function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

// ---- Types & helpers (no any) ----
type TimestampLike = { toDate: () => Date };
type MaybeDateish = Date | TimestampLike | string | null | undefined;

type MakeupEventDoc = {
  text?: string;
  createdAt?: MaybeDateish;
  createdBy?: string;
  active?: boolean;
};

function hasToDate(x: unknown): x is TimestampLike {
  return !!x && typeof x === "object" && typeof (x as { toDate?: unknown }).toDate === "function";
}

function toIso(raw: MaybeDateish): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    return Number.isFinite(raw.getTime()) ? raw.toISOString() : null;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (hasToDate(raw)) {
    const d = raw.toDate();
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  return null;
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

export async function GET(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    await requireAdmin(req);

    // Admin SDK 查询（createdAt 倒序）
    const snap = await adminDb.collection("makeup_events").orderBy("createdAt", "desc").get();
    const events = snap.docs.map((d) => {
      const data = (d.data() as MakeupEventDoc) ?? {};
      const createdAt = toIso(data.createdAt);

      return {
        id: d.id,
        text: data.text ?? "",
        createdAt,
        createdBy: data.createdBy ?? "",
        active: Boolean(data.active),
      };
    });

    return NextResponse.json({ ok: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg === "Missing token" || msg === "Invalid token"
        ? 401
        : msg === "Not authorized"
        ? 403
        : 500;
    console.error(`[events:GET:${reqId}]`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    await requireAdmin(req);

    // ✅ 优先从查询参数读取 id（DELETE+body 在部分环境兼容性差）
    let id = "";
    try {
      const url = new URL(req.url);
      id = normalizeId(url.searchParams.get("id"));
    } catch {
      // 忽略，继续尝试从正文读取
    }

    // 兜底：如果客户端还是发了 body，尝试解析
    if (!isValidDocId(id)) {
      try {
        const raw = await req.text();
        if (raw) {
          // 允许两种形式：纯字符串或 JSON { id: "..." }
          if (raw.trim().startsWith("{")) {
            const body = JSON.parse(raw) as { id?: string };
            id = normalizeId(body.id);
          } else {
            id = normalizeId(raw);
          }
        }
      } catch {
        // ignore; 用下面的校验报错
      }
    }

    if (!isValidDocId(id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    // 校验存在
    const evRef = adminDb.collection("makeup_events").doc(id);
    const evSnap = await evRef.get();
    if (!evSnap.exists) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }

    // 删除事件
    await evRef.delete();

    // 级联删除对应的 RSVP（分批以免一次性过大）
    let deleted = 0;
    while (true) {
      const respSnap = await adminDb
        .collection("makeup_responses")
        .where("makeupId", "==", id)
        .limit(400)
        .get();

      if (respSnap.empty) break;

      const batch = adminDb.batch();
      respSnap.docs.forEach((docRef) => batch.delete(docRef.ref));
      await batch.commit();
      deleted += respSnap.size;
    }

    // 清空 swimmers 中的 nextMakeupId / nextMakeupText（分批）
    let cleared = 0;
    while (true) {
      const swSnap = await adminDb
        .collection("swimmers")
        .where("nextMakeupId", "==", id)
        .limit(400)
        .get();

      if (swSnap.empty) break;

      const batch = adminDb.batch();
      swSnap.docs.forEach((docRef) => {
        batch.update(docRef.ref, {
          nextMakeupId: FieldValue.delete(),
          nextMakeupText: FieldValue.delete(),
        });
      });
      await batch.commit();
      cleared += swSnap.size;
    }

    return NextResponse.json({ ok: true, deletedResponses: deleted, clearedSwimmers: cleared });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg === "Missing token" || msg === "Invalid token"
        ? 401
        : msg === "Not authorized"
        ? 403
        : 500;
    console.error(`[events:DELETE:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
