import { NextResponse } from "next/server";
import { meetAuthError, requireMeetUser } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireMeetUser(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as { swimmerId?: string };
    if (!body.swimmerId) return NextResponse.json({ ok: false, error: "swimmerId is required" }, { status: 400 });
    const commitment = await getMeetService().reportPayment({
      meetId: id,
      swimmerId: body.swimmerId,
      parentUID: user.uid,
    });
    return NextResponse.json({ ok: true, commitment });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
