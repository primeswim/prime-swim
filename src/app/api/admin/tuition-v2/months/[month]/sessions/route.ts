export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, parseMonthParam, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { loadSessions, regenerateSessions } from "@/lib/tuition-v2/month-service";
import { sessionIdFor } from "@/lib/tuition-v2/session-generator";
import { isDateInMonth } from "@/lib/tuition-v2/session-generator";

type RouteCtx = { params: Promise<{ month: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    const sessions = await loadSessions(adminDb, month);
    return NextResponse.json({ month, sessions });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 sessions GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    await requireTuitionV2Admin(req);
    const { month: raw } = await ctx.params;
    const month = parseMonthParam(raw);
    if (!month) return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });

    const body = (await req.json()) as {
      action?: string;
      date?: string;
      level?: string;
      weekday?: number;
      timeSlot?: string;
      location?: string;
    };

    if (body.action === "regenerate") {
      const sessions = await regenerateSessions(adminDb, month);
      return NextResponse.json({ ok: true, sessions, count: sessions.length });
    }

    if (body.action === "add_manual") {
      const date = typeof body.date === "string" ? body.date : "";
      const level = typeof body.level === "string" ? body.level.trim() : "";
      const weekday = typeof body.weekday === "number" ? body.weekday : Number(body.weekday);
      const timeSlot = typeof body.timeSlot === "string" ? body.timeSlot.trim() : "";
      const location = typeof body.location === "string" ? body.location.trim() : "";
      if (!isDateInMonth(date, month) || !level || !timeSlot || !location) {
        return NextResponse.json({ error: "Invalid manual session fields" }, { status: 400 });
      }
      if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) {
        return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
      }
      const id = sessionIdFor(date, level, timeSlot);
      const ref = adminDb
        .collection("tuition_v2_months")
        .doc(month)
        .collection("sessions")
        .doc(id);
      await ref.set({
        date,
        level,
        weekday,
        timeSlot,
        location,
        source: "manual",
        cancelled: false,
      });
      const sessions = await loadSessions(adminDb, month);
      return NextResponse.json({ ok: true, sessions });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 sessions POST:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
