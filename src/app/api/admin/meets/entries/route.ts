import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdminOrReadKey } from "@/lib/meets/auth";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireMeetAdminOrReadKey(req);
    const service = getMeetService();
    const meets = await service.listAdminMeets();
    const payloads = [];
    for (const meet of meets) {
      payloads.push(await service.exportMeetEntries(meet.id));
    }
    return NextResponse.json({ ok: true, meets: payloads });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
