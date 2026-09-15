import { NextResponse } from "next/server";
import { Resend } from "resend";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { assertSendableHostEmail, MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";
import type { InvitationStatus } from "@/lib/meets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

type ActionBody =
  | { action: "approve" }
  | { action: "reject"; reason?: string }
  | { action: "publish" }
  | { action: "invite"; invitationStatus: InvitationStatus }
  | { action: "importEventFile"; content: string; accept?: boolean }
  | { action: "acceptUpdate"; banner?: string }
  | { action: "dismissUpdate" }
  | { action: "close" }
  | { action: "submit" }
  | { action: "composeEntryEmail" }
  | { action: "composeInvitationEmail" }
  | { action: "markInvitationRequested"; to?: string }
  | { action: "sendEntryEmail"; to: string; subject: string; body: string }
  | { action: "recordHostReply"; summary: string }
  | { action: "removeCuts"; swimmerId: string; keepEventIds: string[]; note?: string }
  | { action: "publishConfirmed" }
  | { action: "markPaid"; swimmerId: string }
  | { action: "markUnpaid"; swimmerId: string }
  | {
      action: "updateCommitment";
      swimmerId: string;
      attendance?: "attend" | "decline";
      availableSessionIds?: string[];
      eventIds?: string[];
      parentNotes?: string;
      hostCutNote?: string;
    };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireMeetAdmin(req);
    const { id } = await ctx.params;
    const body = (await req.json()) as ActionBody;
    const service = getMeetService();
    switch (body.action) {
      case "approve":
        return NextResponse.json({ ok: true, meet: await service.approveMeet(id) });
      case "reject":
        return NextResponse.json({ ok: true, meet: await service.rejectMeet(id, body.reason) });
      case "publish":
        return NextResponse.json({ ok: true, meet: await service.publishToFamilies(id) });
      case "invite":
        return NextResponse.json({ ok: true, meet: await service.setInvitationStatus(id, body.invitationStatus) });
      case "importEventFile":
        return NextResponse.json({
          ok: true,
          meet: await service.importEventFile(id, body.content, { accept: body.accept !== false }),
        });
      case "acceptUpdate":
        return NextResponse.json({ ok: true, meet: await service.acceptSourceUpdate(id, body.banner) });
      case "dismissUpdate":
        return NextResponse.json({ ok: true, meet: await service.dismissSourceUpdate(id) });
      case "close":
        return NextResponse.json({ ok: true, meet: await service.closeCommitments(id) });
      case "submit":
        return NextResponse.json({
          ok: true,
          meet: await service.markSubmitted(id),
          email: await service.composeEntryEmail(id),
        });
      case "composeEntryEmail":
        return NextResponse.json({ ok: true, email: await service.composeEntryEmail(id) });
      case "composeInvitationEmail":
        return NextResponse.json({ ok: true, invitationEmail: await service.composeInvitationInquiryEmail(id) });
      case "markInvitationRequested":
        return NextResponse.json({
          ok: true,
          meet: await service.markInvitationRequested(id, body.to),
          invitationEmail: await service.composeInvitationInquiryEmail(id),
        });
      case "sendEntryEmail": {
        const meet = await service.getAdminMeet(id);
        if (!meet) return NextResponse.json({ ok: false, error: "Meet not found" }, { status: 404 });
        const draft = await service.composeEntryEmail(id);
        const to = (body.to || draft.to).trim();
        const subject = (body.subject || draft.subject).trim();
        const text = (body.body || draft.body).trim();
        assertSendableHostEmail(meet, to);
        if (!subject || !text) return NextResponse.json({ ok: false, error: "Email subject and body are required." }, { status: 400 });
        if (!process.env.RESEND_API_KEY) {
          return NextResponse.json({ ok: false, error: "Email sending is not configured (missing RESEND_API_KEY)." }, { status: 500 });
        }
        const sent = await resend.emails.send({
          from: "Prime Swim Academy <noreply@primeswimacademy.com>",
          to,
          bcc: ["prime.swim.us@gmail.com"],
          subject,
          text,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1e293b">${text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br />")}</div>`,
        });
        if (sent.error) {
          return NextResponse.json({ ok: false, error: sent.error.message || "Resend failed" }, { status: 500 });
        }
        return NextResponse.json({
          ok: true,
          meet: await service.recordEntryEmailSent(id, to),
          email: { ...draft, to, subject, body: text },
        });
      }
      case "recordHostReply":
        return NextResponse.json({ ok: true, meet: await service.recordHostReply(id, body.summary) });
      case "removeCuts":
        return NextResponse.json({
          ok: true,
          commitment: await service.removeCutEvents({
            meetId: id,
            swimmerId: body.swimmerId,
            keepEventIds: body.keepEventIds,
            note: body.note,
          }),
        });
      case "publishConfirmed":
        return NextResponse.json({ ok: true, meet: await service.publishConfirmed(id) });
      case "markPaid":
        return NextResponse.json({ ok: true, commitment: await service.markPaid({ meetId: id, swimmerId: body.swimmerId }) });
      case "markUnpaid":
        return NextResponse.json({ ok: true, commitment: await service.markUnpaid({ meetId: id, swimmerId: body.swimmerId }) });
      case "updateCommitment":
        return NextResponse.json({
          ok: true,
          commitment: await service.updateAdminCommitment({
            meetId: id,
            swimmerId: body.swimmerId,
            attendance: body.attendance,
            availableSessionIds: body.availableSessionIds,
            eventIds: body.eventIds,
            parentNotes: body.parentNotes,
            hostCutNote: body.hostCutNote,
          }),
        });
      default:
        return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
