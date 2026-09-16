import { NextResponse } from "next/server";
import { meetAuthError, optionalMeetUser } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await optionalMeetUser(req);
    const service = getMeetService();
    if (!user) {
      const meets = await service.listPublicMeets();
      return NextResponse.json({ ok: true, signedIn: false, meets, swimmers: [] });
    }
    const [meets, swimmers] = await Promise.all([
      service.listParentMeets(user.uid, user.email),
      service.listParentSwimmers(user.uid),
    ]);
    return NextResponse.json({ ok: true, signedIn: true, meets, swimmers });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
