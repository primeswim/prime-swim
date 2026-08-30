export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";

/** GET: active V2 enrollments for editing regular training weekdays. */
export async function GET(req: Request) {
  try {
    await requireTuitionV2Admin(req);
    const enrollments = await loadSwimmerEnrollments(adminDb);
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
