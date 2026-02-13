export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { DEFAULT_LEVEL_CONFIG, type LevelConfigMap, type LevelConfigItem, type LevelScheduleSlot } from "@/lib/tuition-defaults";

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

function getDatesInMonth(month: string): Date[] {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const out: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMMDD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (use YYYY-MM)" }, { status: 400 });
    }

    const [levelSnap, monthSnap, swimmersSnap] = await Promise.all([
      adminDb.collection("tuition_level_config").doc("default").get(),
      adminDb.collection("tuition_month_config").doc(month).get(),
      adminDb.collection("swimmers").get(),
    ]);

    const rawLevels = levelSnap.exists && levelSnap.data()?.levels
      ? (levelSnap.data()!.levels as Record<string, unknown>)
      : null;
    const levels: LevelConfigMap = {};
    const base = DEFAULT_LEVEL_CONFIG;
    for (const levelName of Object.keys(base)) {
      const saved = rawLevels?.[levelName] as Partial<LevelConfigItem> | undefined;
      const def = base[levelName];
      const schedule = Array.isArray(saved?.schedule)
        ? (saved!.schedule as LevelScheduleSlot[])
        : (def.schedule ?? []);
      levels[levelName] = {
        defaultRatePerHour: saved?.defaultRatePerHour ?? def.defaultRatePerHour,
        daysPerWeek: saved?.daysPerWeek ?? def.daysPerWeek,
        minDaysPerWeek: saved?.minDaysPerWeek ?? def.minDaysPerWeek,
        reducedRatePerHour: saved?.reducedRatePerHour !== undefined ? saved.reducedRatePerHour : def.reducedRatePerHour,
        schedule,
        defaultTimeSlot: saved?.defaultTimeSlot ?? def.defaultTimeSlot,
        defaultLocation: saved?.defaultLocation ?? def.defaultLocation,
      };
    }
    for (const k of Object.keys(rawLevels || {})) {
      if (!levels[k]) {
        const s = rawLevels![k] as Partial<LevelConfigItem>;
        levels[k] = {
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

    const noTrainingSet = new Set<string>(
      monthSnap.exists && Array.isArray(monthSnap.data()?.noTrainingDates)
        ? monthSnap.data()!.noTrainingDates
        : []
    );

    const [yearNum, monthNum] = month.split("-").map(Number);
    const allDates = getDatesInMonth(month);
    const datesByWeekday: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const d of allDates) {
      const ymd = toYYYYMMDD(d);
      if (noTrainingSet.has(ymd)) continue;
      const wd = d.getDay();
      datesByWeekday[wd].push(ymd);
    }

    const results: {
      swimmerId: string;
      swimmerName: string;
      level: string;
      trainingWeekdays: number[];
      sessionCount: number;
      ratePerHour: number;
      tuition: number;
      scheduleLines: string[];
      timeSlot: string;
      location: string;
      needsConfig?: boolean;
    }[] = [];

    for (const doc of swimmersSnap.docs) {
      const data = doc.data();
      const swimmerId = doc.id;
      const swimmerName = [data.childFirstName, data.childLastName].filter(Boolean).join(" ").trim() || doc.id;
      const level = (data.level && String(data.level).trim()) || "";
      if (data.isFrozen) continue;
      // Only include swimmers with a group/level assignment
      if (!level) continue;

      const trainingWeekdays: number[] = Array.isArray(data.trainingWeekdays)
        ? data.trainingWeekdays.filter((n) => typeof n === "number" && n >= 0 && n <= 6)
        : [];
      const levelCfg = level ? levels[level] : null;
      const swimmerTimeOverride = data.trainingTimeSlot && String(data.trainingTimeSlot).trim() ? String(data.trainingTimeSlot).trim() : null;
      const swimmerLocationOverride = data.trainingLocation && String(data.trainingLocation).trim() ? String(data.trainingLocation).trim() : null;
      const scheduleByWeekday: Record<number, { timeSlot: string; location: string }> = {};
      if (levelCfg?.schedule?.length) {
        for (const slot of levelCfg.schedule) {
          scheduleByWeekday[slot.weekday] = { timeSlot: slot.timeSlot, location: slot.location };
        }
      }
      const defaultTime = levelCfg?.defaultTimeSlot ?? "7-8PM";
      const defaultLoc = levelCfg?.defaultLocation ?? "Mary Wayte Pool";
      const getTimeLoc = (wd: number) => {
        if (swimmerTimeOverride && swimmerLocationOverride) return { timeSlot: swimmerTimeOverride, location: swimmerLocationOverride };
        const s = scheduleByWeekday[wd];
        return s ? { timeSlot: s.timeSlot, location: s.location } : { timeSlot: defaultTime, location: defaultLoc };
      };

      let sessionCount = 0;
      const scheduleEntries: { mmdd: string; wd: number }[] = [];
      for (const wd of trainingWeekdays) {
        const list = datesByWeekday[wd] ?? [];
        sessionCount += list.length;
        for (const ymd of list) {
          const [y, m, d] = ymd.split("-").map(Number);
          scheduleEntries.push({ mmdd: toMMDD(new Date(y, m - 1, d)), wd });
        }
      }
      scheduleEntries.sort((a, b) => {
        const [ma, da] = a.mmdd.split("/").map(Number);
        const [mb, db] = b.mmdd.split("/").map(Number);
        return ma !== mb ? ma - mb : da - db;
      });

      let ratePerHour = 0;
      if (typeof data.ratePerHourOverride === "number" && data.ratePerHourOverride > 0) {
        ratePerHour = data.ratePerHourOverride;
      } else if (levelCfg) {
        const daysChosen = trainingWeekdays.length;
        if (levelCfg.minDaysPerWeek > 0 && daysChosen === levelCfg.minDaysPerWeek && levelCfg.reducedRatePerHour != null) {
          ratePerHour = levelCfg.reducedRatePerHour;
        } else {
          ratePerHour = levelCfg.defaultRatePerHour;
        }
      }

      const tuition = sessionCount * 1 * ratePerHour;
      const scheduleLines = scheduleEntries.map(({ mmdd, wd }) => {
        const { timeSlot, location } = getTimeLoc(wd);
        return `${mmdd} ${timeSlot} ${location}`;
      });
      const timeSlot = swimmerTimeOverride ?? defaultTime;
      const location = swimmerLocationOverride ?? defaultLoc;

      results.push({
        swimmerId,
        swimmerName,
        level,
        trainingWeekdays,
        sessionCount,
        ratePerHour,
        tuition,
        scheduleLines,
        timeSlot,
        location,
        needsConfig: Boolean(!level || (levelCfg && trainingWeekdays.length === 0)),
      });
    }

    results.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));

    return NextResponse.json({
      month,
      noTrainingDates: Array.from(noTrainingSet),
      results,
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition calculate GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
