// src/app/api/dashboard/swimmers/route.ts
import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SwimmerOut = {
  id: string;
  childFirstName?: string;
  childLastName?: string;
  childDateOfBirth?: string;
  createdAt?: unknown;
  paymentStatus?: string | null;
  level?: string;
  nextMakeupText?: string;
  nextMakeupId?: string;
  nextDueDate?: unknown;
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  registrationAnchorDate?: unknown;
  isFrozen?: boolean;
};

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0 && !id.includes("/");
}

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

export async function GET(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  try {
    const decoded = await requireUser(req);

    const swimmersSnap = await adminDb
      .collection("swimmers")
      .where("parentUID", "==", decoded.uid)
      .get();

    // Helper to convert Firestore Timestamp to ISO string or null
    const toIsoOrNull = (ts: unknown): string | null => {
      if (!ts) return null;
      if (typeof ts === "object" && ts !== null) {
        // Firestore Timestamp has toDate() method
        if (typeof (ts as any).toDate === "function") {
          const date = (ts as { toDate: () => Date }).toDate();
          return date.toISOString();
        }
        // Firestore Timestamp in seconds/nanoseconds format
        if (typeof (ts as any).seconds === "number") {
          const t = ts as { seconds: number; nanoseconds?: number };
          const date = new Date(t.seconds * 1000 + (t.nanoseconds || 0) / 1000000);
          return date.toISOString();
        }
      }
      return null;
    };

    const swimmers: SwimmerOut[] = swimmersSnap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        childFirstName: data.childFirstName,
        childLastName: data.childLastName,
        childDateOfBirth: data.childDateOfBirth,
        createdAt: toIsoOrNull(data.createdAt),
        paymentStatus: data.paymentStatus || null,
        level: data.level || undefined,
        nextMakeupText: data.nextMakeupText,
        nextMakeupId: data.nextMakeupId,
        nextDueDate: toIsoOrNull(data.nextDueDate),
        currentPeriodStart: toIsoOrNull(data.currentPeriodStart),
        currentPeriodEnd: toIsoOrNull(data.currentPeriodEnd),
        registrationAnchorDate: toIsoOrNull(data.registrationAnchorDate),
        isFrozen: !!data.isFrozen,
      };
    });

    // pending payments（避免复合索引：只按 swimmerId 查询，然后在内存里筛 pending）
    const pendingMap: Record<string, { paymentId: string }> = {};
    await Promise.all(
      swimmers.map(async (s) => {
        if (!isValidDocId(s.id)) return;
        const paySnap = await adminDb
          .collection("payments")
          .where("swimmerId", "==", s.id)
          .limit(50)
          .get();
        const firstPending = paySnap.docs.find((d) => (d.data()?.status || "") === "pending");
        if (firstPending) pendingMap[s.id] = { paymentId: firstPending.id };
      })
    );

    return NextResponse.json({ ok: true, swimmers, pendingMap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error(`[dashboard:swimmers:GET:${reqId}]`, err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}


