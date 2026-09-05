export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { listSwimmerEnrollments, syncActiveSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";
import { openBillingMonths, refreshMonthDerivedData } from "@/lib/tuition-v2/refresh-month";

/** GET: active V2 enrollments for editing regular training weekdays.
 * Auto-syncs roster from active swimmers (no separate Sync button needed).
 */
export async function GET(req: Request) {
  try {
    const email = await requireTuitionV2Admin(req);
    const url = new URL(req.url);
    // Default: sync. Pass sync=0 for a cheap read-only list.
    if (url.searchParams.get("sync") !== "0") {
      const delta = await syncActiveSwimmerEnrollments(adminDb);
      const rosterChanged =
        delta.created.length + delta.deactivated.length + delta.levelChanged.length > 0;
      if (rosterChanged) {
        for (const month of openBillingMonths()) {
          await refreshMonthDerivedData(adminDb, month, { actor: email, syncRoster: false });
        }
      }
    }
    const enrollments = await listSwimmerEnrollments(adminDb);
    const swimmers = enrollments.map((e) => ({
      id: e.swimmerId,
      swimmerName: e.swimmerName,
      level: e.level,
      regularWeekdays: e.regularWeekdays,
    }));
    return NextResponse.json({ swimmers });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 enrollments GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
