import { NextResponse } from "next/server";
import { meetAuthError, requireMeetAdmin } from "@/lib/meets/auth";
import { getMeetService } from "@/lib/meets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowCron(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return bearer === secret || (req.headers.get("x-api-key") || "").trim() === secret;
}

async function runScan() {
  const stats = await getMeetService().scanLivePns();
  return NextResponse.json({
    ok: true,
    source: "live",
    scheduled: true,
    ...stats,
  });
}

export async function GET(req: Request) {
  try {
    if (!allowCron(req)) await requireMeetAdmin(req);
    return await runScan();
  } catch (e) {
    const auth = meetAuthError(e);
    if (auth) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    console.error("admin/meets/pns/sync:", e);
    const msg = e instanceof Error ? e.message : "PNS sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
