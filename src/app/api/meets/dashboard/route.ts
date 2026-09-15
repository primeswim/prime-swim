import { NextResponse } from "next/server";
import { meetAuthError, requireMeetUser } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireMeetUser(req);
    const payload = await getMeetService().listParentDashboard(user.uid, user.email);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
