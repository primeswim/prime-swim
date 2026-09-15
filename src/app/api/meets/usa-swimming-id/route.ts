import { NextResponse } from "next/server";
import { meetAuthError, requireMeetUser } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireMeetUser(req);
    const body = (await req.json()) as { swimmerId?: string; usaSwimmingId?: string };
    if (!body.swimmerId || !body.usaSwimmingId) {
      return NextResponse.json({ ok: false, error: "swimmerId and usaSwimmingId are required" }, { status: 400 });
    }
    const swimmer = await getMeetService().saveUsaSwimmingId({
      swimmerId: body.swimmerId,
      parentUID: user.uid,
      usaSwimmingId: body.usaSwimmingId,
    });
    return NextResponse.json({ ok: true, swimmer });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
