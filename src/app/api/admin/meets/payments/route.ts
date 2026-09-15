import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireMeetAdmin(req);
    const invoices = await getMeetService().listMeetPayments();
    return NextResponse.json({ ok: true, invoices });
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
