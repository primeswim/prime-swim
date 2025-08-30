// src/app/api/makeup/attendees/route.ts
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

type Row = {
  swimmerId: string;
  swimmerName: string;
  parentName: string;
  email: string;
  status: "yes" | "no" | "none";
  updatedAt: string | null; // ISO string or null
};

// robust time coercion (Timestamp|Date|string|null|undefined -> ISO or null)
function toIso(val: unknown): string | null {
    try {
      if (!val) return null;
  
      // Firestore Timestamp duck type check
      if (typeof (val as any)?.toDate === "function") {
        const d: Date = (val as any).toDate();
        return isFinite(d.getTime()) ? d.toISOString() : null;
      }
  
      if (val instanceof Date) {
        return isFinite(val.getTime()) ? val.toISOString() : null;
      }
  
      if (typeof val === "string") {
        const d = new Date(val);
        return isFinite(d.getTime()) ? d.toISOString() : null;
      }
  
      return null;
    } catch {
      return null;
    }
  }
  
  

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    // auth
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

    // body
    const { makeupId } = (await req.json()) as { makeupId?: string };
    if (!makeupId) {
      return NextResponse.json({ ok: false, stage: "validate", error: "makeupId required" }, { status: 400 });
    }

    // rsvps
    const rsvpSnap = await adminDb
      .collection("makeup_responses")
      .where("makeupId", "==", makeupId)
      .get();

    const rsvps = rsvpSnap.docs.map((d) => d.data()) as Array<{
      swimmerId?: string;
      makeupId?: string;
      status?: "yes" | "no" | "none";
      parentEmail?: string | null;
      updatedAt?: unknown; // Timestamp | Date | string | undefined
    }>;

    const swimmerIds = Array.from(
      new Set(rsvps.map((r) => r.swimmerId).filter((x): x is string => !!x))
    );

    // pull swimmers
    const swimmerMap: Record<string, any> = {};
    for (const sid of swimmerIds) {
      const s = await adminDb.collection("swimmers").doc(sid).get();
      if (s.exists) swimmerMap[sid] = s.data();
    }

    // rows
    const rows: Row[] = rsvps.map((r) => {
      const sid = r.swimmerId || "";
      const s = swimmerMap[sid] || {};
      const swimmerName =
        s.swimmerName ||
        [s.childFirstName, s.childLastName].filter(Boolean).join(" ") ||
        sid;
      const parentName =
        s.parentName ||
        [s.parentFirstName, s.parentLastName].filter(Boolean).join(" ") ||
        "";
      const email =
        s.parentEmail ||
        (Array.isArray(s.parentEmails) ? s.parentEmails[0] : "") ||
        r.parentEmail ||
        "";

      return {
        swimmerId: sid,
        swimmerName,
        parentName,
        email,
        status: (r.status as Row["status"]) || "none",
        updatedAt: toIso(r.updatedAt),
      };
    });

    return NextResponse.json({ ok: true, rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[attendees:${reqId}]`, err);
    return NextResponse.json({ ok: false, stage: "unhandled", error: msg }, { status: 500 });
  }
}
