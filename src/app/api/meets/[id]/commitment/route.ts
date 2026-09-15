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
    const body = (await req.json()) as {
      swimmerId?: string;
      attendance?: "attend" | "decline";
      availableSessionIds?: string[];
      selectedEventIds?: string[];
      parentNotes?: string;
      acceptFeePolicy?: boolean;
    };
    if (!body.swimmerId || (body.attendance !== "attend" && body.attendance !== "decline")) {
      return NextResponse.json({ ok: false, error: "swimmerId and attendance are required" }, { status: 400 });
    }
    const service = getMeetService();
    const commitment = await service.saveParentCommitment({
      meetId: id,
      swimmerId: body.swimmerId,
      parentUID: user.uid,
      attendance: body.attendance,
      availableSessionIds: body.availableSessionIds || [],
      selectedEventIds: body.selectedEventIds || [],
      parentNotes: body.parentNotes || "",
      acceptFeePolicy: body.acceptFeePolicy,
    });
    return NextResponse.json({ ok: true, commitment });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
