import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";
import type { Meet } from "@/lib/meets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireMeetAdmin(req);
    const { id } = await ctx.params;
    const service = getMeetService();
    const meet = await service.getAdminMeet(id);
    if (!meet) return NextResponse.json({ ok: false, error: "Meet not found" }, { status: 404 });
    const commitments = await service.listMeetCommitments(id);
    const swimmers = await service.listSwimmersByIds([...new Set(commitments.map((c) => c.swimmerId))]);
    let invitationEmail = null;
    let email = null;
    try {
      invitationEmail = await service.composeInvitationInquiryEmail(id);
    } catch {
      invitationEmail = null;
    }
    try {
      email = await service.composeEntryEmail(id);
    } catch {
      email = null;
    }
    return NextResponse.json({ ok: true, meet, commitments, swimmers, invitationEmail, email });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireMeetAdmin(req);
    const { id } = await ctx.params;
    const patch = (await req.json()) as Partial<Meet>;
    const meet = await getMeetService().updateMeet(id, patch);
    return NextResponse.json({ ok: true, meet });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
