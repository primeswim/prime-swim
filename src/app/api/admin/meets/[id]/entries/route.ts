import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdminOrReadKey } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";
import { hostEntryCsv, hostEntryReportText, hostPacketFilename, canBuildHostSd3 } from "@/lib/meets/entries";
import { hostEntrySd3 } from "@/lib/meets/sd3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireMeetAdminOrReadKey(req);
    const { id } = await ctx.params;
    const payload = await getMeetService().exportMeetEntries(id);
    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    if (format === "sd3") {
      if (!canBuildHostSd3(payload)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "The host Event File is not in yet, or no Attend swimmer has official events. Meet Manager cannot import a CSV. Upload the .ev3/.hyv, have families check events, then download SD3.",
          },
          { status: 400 }
        );
      }
      const body = hostEntrySd3(payload);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${hostPacketFilename(payload.meet, "sd3")}"`,
        },
      });
    }
    if (format === "csv") {
      const body = hostEntryCsv(payload);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${hostPacketFilename(payload.meet, "csv")}"`,
        },
      });
    }
    if (format === "txt" || format === "report") {
      const body = hostEntryReportText(payload);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${hostPacketFilename(payload.meet, "txt")}"`,
        },
      });
    }
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof MeetServiceError ? 400 : 500 });
  }
}
