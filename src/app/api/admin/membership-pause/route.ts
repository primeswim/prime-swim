export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { buildMembershipResumeDates } from "@/lib/membership";

async function requireAdmin(req: Request): Promise<void> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
}

function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

type Action = "pause" | "resume";

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as { swimmerIds?: string[]; action?: Action };
    const swimmerIds = Array.isArray(body.swimmerIds)
      ? body.swimmerIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];
    const action = body.action;

    if (!swimmerIds.length || (action !== "pause" && action !== "resume")) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const now = new Date();
    const results: Array<{ id: string; ok: boolean; error?: string; extensionDays?: number }> = [];

    for (const id of swimmerIds) {
      const ref = adminDb.collection("swimmers").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        results.push({ id, ok: false, error: "NOT_FOUND" });
        continue;
      }

      const data = snap.data() || {};
      const nextDue = toDate(data.nextDueDate);
      const periodEnd = toDate(data.currentPeriodEnd);
      const alreadyPaused = data.membershipPaused === true;

      if (action === "pause") {
        if (alreadyPaused) {
          results.push({ id, ok: false, error: "ALREADY_PAUSED" });
          continue;
        }
        if (!nextDue || !periodEnd) {
          results.push({ id, ok: false, error: "NO_MEMBERSHIP_DATES" });
          continue;
        }
        await ref.update({
          membershipPaused: true,
          membershipPausedAt: Timestamp.fromDate(now),
          updatedAt: FieldValue.serverTimestamp(),
        });
        results.push({ id, ok: true });
        continue;
      }

      // resume
      if (!alreadyPaused) {
        results.push({ id, ok: false, error: "NOT_PAUSED" });
        continue;
      }
      const pausedAt = toDate(data.membershipPausedAt);
      if (!nextDue || !periodEnd || !pausedAt) {
        results.push({ id, ok: false, error: "INVALID_PAUSE_STATE" });
        continue;
      }

      const { nextDueDate, currentPeriodEnd, extensionDays } = buildMembershipResumeDates(
        nextDue,
        periodEnd,
        pausedAt,
        now
      );

      await ref.update({
        membershipPaused: false,
        membershipPausedAt: FieldValue.delete(),
        nextDueDate: Timestamp.fromDate(nextDueDate),
        currentPeriodEnd: Timestamp.fromDate(currentPeriodEnd),
        lastMembershipPauseDays: extensionDays,
        lastMembershipResumedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      results.push({ id, ok: true, extensionDays });
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: okCount > 0, results, okCount, total: results.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
