import { allowPnsCron } from "@/lib/meets/pns-cron-auth";
import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { runTrackedPnsSync } from "@/lib/meets/pns-sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runScan() {
  const stats = await runTrackedPnsSync();
  return NextResponse.json({
    ok: true,
    source: "live",
    scheduled: true,
    ...stats,
  }, {status: stats.notification === "failed" ? 502 : 200});
}

export async function GET(req: Request) {
  try {
    if (!allowPnsCron(req, process.env.CRON_SECRET)) await requireMeetAdmin(req);
    return await runScan();
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    console.error("admin/meets/pns/sync:", e);
    const msg = e instanceof Error ? e.message : "PNS sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
