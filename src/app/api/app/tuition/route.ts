import { NextResponse } from "next/server";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadParentTuitionForSwimmers } from "@/lib/tuition-v2/parent-tuition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoOrNull(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const date = new Date(ts > 1e12 ? ts : ts * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof ts === "object" && ts !== null) {
    if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
      return (ts as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof (ts as { seconds?: number }).seconds === "number") {
      const t = ts as { seconds: number; nanoseconds?: number };
      return new Date(t.seconds * 1000 + (t.nanoseconds || 0) / 1000000).toISOString();
    }
  }
  return null;
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
  try {
    const decoded = await requireUser(req);
    const swimmersSnap = await adminDb.collection("swimmers").where("parentUID", "==", decoded.uid).get();

    const swimmers = swimmersSnap.docs.map((d) => {
      const data = d.data() || {};
      return {
        swimmerId: d.id,
        swimmerName: `${data.childFirstName || ""} ${data.childLastName || ""}`.trim() || d.id,
        level: typeof data.level === "string" ? data.level : "",
        membership: {
          nextDueDate: toIsoOrNull(data.nextDueDate),
          currentPeriodStart: toIsoOrNull(data.currentPeriodStart),
          currentPeriodEnd: toIsoOrNull(data.currentPeriodEnd),
          membershipPaused: data.membershipPaused === true,
        },
      };
    });

    const tuitionBundle = await loadParentTuitionForSwimmers(
      adminDb,
      swimmers.map((s) => s.swimmerId)
    );

    return NextResponse.json({
      ok: true,
      billingMonth: tuitionBundle.billingMonth,
      swimmers: swimmers.map((s) => ({
        ...s,
        tuition: tuitionBundle.bySwimmerId[s.swimmerId] ?? null,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "Missing token" || msg === "Invalid token" ? 401 : 500;
    console.error("[app:tuition:GET]", err);
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
