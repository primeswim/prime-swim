import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { MeetServiceError } from "@/lib/meets/service";
import { getMeetService } from "@/lib/meets/server";
import type { ClubMeetSettings } from "@/lib/meets/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireMeetAdmin(req);
    const settings = await getMeetService().getSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireMeetAdmin(req);
    const settings = (await req.json()) as ClubMeetSettings;
    const saved = await getMeetService().saveSettings(settings);
    return NextResponse.json({ ok: true, settings: saved });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const msg = e instanceof MeetServiceError ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
