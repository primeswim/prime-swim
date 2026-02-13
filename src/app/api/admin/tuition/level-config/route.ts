export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { DEFAULT_LEVEL_CONFIG, type LevelConfigMap, type LevelConfigItem, type LevelScheduleSlot } from "@/lib/tuition-defaults";

const CONFIG_DOC_ID = "default";

async function requireAdmin(req: Request): Promise<void> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const ref = adminDb.collection("tuition_level_config").doc(CONFIG_DOC_ID);
    const snap = await ref.get();
    const raw = snap.exists && snap.data()?.levels ? (snap.data()!.levels as Record<string, unknown>) : {};
    const levels: LevelConfigMap = {};
    for (const name of Object.keys(DEFAULT_LEVEL_CONFIG)) {
      const def = DEFAULT_LEVEL_CONFIG[name];
      const s = raw[name] as Partial<LevelConfigItem> | undefined;
      levels[name] = {
        defaultRatePerHour: s?.defaultRatePerHour ?? def.defaultRatePerHour,
        daysPerWeek: s?.daysPerWeek ?? def.daysPerWeek,
        minDaysPerWeek: s?.minDaysPerWeek ?? def.minDaysPerWeek,
        reducedRatePerHour: s?.reducedRatePerHour !== undefined ? s.reducedRatePerHour : def.reducedRatePerHour,
        schedule: Array.isArray(s?.schedule) ? (s.schedule as LevelScheduleSlot[]) : (def.schedule ?? []),
        defaultTimeSlot: s?.defaultTimeSlot ?? def.defaultTimeSlot,
        defaultLocation: s?.defaultLocation ?? def.defaultLocation,
      };
    }
    for (const name of Object.keys(raw)) {
      if (!levels[name]) {
        const s = raw[name] as Partial<LevelConfigItem>;
        levels[name] = {
          defaultRatePerHour: s.defaultRatePerHour ?? 0,
          daysPerWeek: s.daysPerWeek ?? 2,
          minDaysPerWeek: s.minDaysPerWeek ?? 2,
          reducedRatePerHour: s.reducedRatePerHour ?? null,
          schedule: Array.isArray(s.schedule) ? (s.schedule as LevelScheduleSlot[]) : [],
          defaultTimeSlot: s.defaultTimeSlot ?? "7-8PM",
          defaultLocation: s.defaultLocation ?? "Mary Wayte Pool",
        };
      }
    }
    return NextResponse.json({ levels });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition level-config GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as { levels?: LevelConfigMap };
    if (!body.levels || typeof body.levels !== "object") {
      return NextResponse.json({ error: "Missing levels object" }, { status: 400 });
    }
    const ref = adminDb.collection("tuition_level_config").doc(CONFIG_DOC_ID);
    await ref.set({ levels: body.levels, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition level-config PUT:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
