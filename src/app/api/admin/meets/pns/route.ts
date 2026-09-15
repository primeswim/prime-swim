import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { loadTestTacHyv, mockPnsCalendarItems } from "@/lib/meets/fixtures";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await requireMeetAdmin(req);
    const body = (await req.json().catch(() => ({}))) as { source?: "mock" | "live" };
    const source = body.source === "live" ? "live" : "mock";
    const service = getMeetService();
    if (source === "mock") {
      const meets = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
      const tac = meets.find((m) => (m.sourceKey || m.id).includes("tac") || /Pentathlon/i.test(m.name));
      if (tac) {
        await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
      }
      const refreshed = await service.listAdminMeets();
      return NextResponse.json({
        ok: true,
        source: "mock",
        warning: "Loaded [TEST] fixture meets only. Real parents cannot see these.",
        meets: refreshed.filter((m) => m.isTestData),
      });
    }
    try {
      const stats = await service.scanLivePns();
      return NextResponse.json({
        ok: true,
        source: "live",
        ...stats,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PNS fetch failed";
      return NextResponse.json({
        ok: false,
        source: "live",
        error: msg,
        hint: "Could not reach the PNS TeamUnify calendar. Try again, or use Load [TEST] fixtures.",
      }, { status: 502 });
    }
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    console.error("admin/meets/pns:", e);
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
