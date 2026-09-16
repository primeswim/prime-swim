import { NextResponse } from "next/server";
import { meetAuthError, optionalMeetUser } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await optionalMeetUser(req);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const swimmerId = url.searchParams.get("swimmerId") || "";
    const service = getMeetService();
    if (user && swimmerId) {
      const detail = await service.getParentDetail({
        meetId: id,
        swimmerId,
        parentUID: user.uid,
        email: user.email,
      });
      return NextResponse.json({ ok: true, signedIn: true, detail });
    }
    const viewerIsTestAccount = user ? await service.viewerIsTestAccount(user.uid, user.email) : false;
    const detail = await service.getPublicMeet(id, { viewerIsTestAccount });
    return NextResponse.json({ ok: true, signedIn: Boolean(user), public: true, detail });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
