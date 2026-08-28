/**
 * Monthly tuition calculator (shared by API routes and billing prepare).
 */

import type { Firestore } from "firebase-admin/firestore";
import {
  DEFAULT_LEVEL_CONFIG,
  type LevelConfigMap,
  type LevelConfigItem,
  type LevelScheduleSlot,
} from "@/lib/tuition-defaults";
import {
  applySiblingTuitionDiscounts,
  getSwimmerEnrollmentMillis,
  normalizeSiblingIds,
} from "@/lib/swimmer-siblings";
import { isSwimmerEligibleForMonthlyTuition } from "@/lib/membership";
import {
  normalizeTrainingSchedule,
  resolveTimeLocForWeekday,
  scheduleByWeekdayFromSlots,
  type TrainingScheduleSlot,
} from "@/lib/tuition-schedule";

export type TuitionCalculateRow = {
  swimmerId: string;
  swimmerName: string;
  level: string;
  parentName: string;
  parentEmail: string;
  trainingWeekdays: number[];
  sessionCount: number;
  ratePerHour: number;
  minDaysPerWeek?: number;
  tuition: number;
  baseTuition?: number;
  siblingDiscountPercent?: number;
  siblingDiscountApplied?: boolean;
  scheduleLines: string[];
  timeSlot: string;
  location: string;
  trainingSchedule?: TrainingScheduleSlot[];
  needsConfig?: boolean;
};

export type TuitionCalculateResult = {
  month: string;
  noTrainingDates: string[];
  results: TuitionCalculateRow[];
  /** Empty = all levels included */
  levelsFilter: string[];
};

export type TuitionCalculateOptions = {
  /** If non-empty, only swimmers in these levels are calculated */
  levels?: string[];
};

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

export async function runTuitionCalculate(
  db: Firestore,
  month: string,
  options?: TuitionCalculateOptions
): Promise<TuitionCalculateResult> {
  const levelsFilter = (options?.levels ?? []).map((l) => l.trim()).filter(Boolean);
  const levelSet =
    levelsFilter.length > 0 ? new Set(levelsFilter) : null;
  const [levelSnap, monthSnap, swimmersSnap] = await Promise.all([
    db.collection("tuition_level_config").doc("default").get(),
    db.collection("tuition_month_config").doc(month).get(),
    db.collection("swimmers").get(),
  ]);

  const rawLevels =
    levelSnap.exists && levelSnap.data()?.levels
      ? (levelSnap.data()!.levels as Record<string, unknown>)
      : null;
  const levels: LevelConfigMap = {};
  const base = DEFAULT_LEVEL_CONFIG;
  for (const levelName of Object.keys(base)) {
    const saved = rawLevels?.[levelName] as Partial<LevelConfigItem> | undefined;
    const def = base[levelName];
    const schedule = Array.isArray(saved?.schedule)
      ? (saved!.schedule as LevelScheduleSlot[])
      : def.schedule ?? [];
    levels[levelName] = {
      defaultRatePerHour: saved?.defaultRatePerHour ?? def.defaultRatePerHour,
      daysPerWeek: saved?.daysPerWeek ?? def.daysPerWeek,
      minDaysPerWeek: saved?.minDaysPerWeek ?? def.minDaysPerWeek,
      reducedRatePerHour:
        saved?.reducedRatePerHour !== undefined ? saved.reducedRatePerHour : def.reducedRatePerHour,
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

  const allDates = getDatesInMonth(month);
  const datesByWeekday: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const d of allDates) {
    const ymd = toYYYYMMDD(d);
    if (noTrainingSet.has(ymd)) continue;
    const wd = d.getDay();
    datesByWeekday[wd].push(ymd);
  }

  const results: TuitionCalculateRow[] = [];
  const enrollmentById = new Map<string, number>();
  const siblingIdsBySwimmer = new Map<string, string[]>();
  const trainingEligibilityById = new Map<
    string,
    { trainingWeekdays: number[]; minDaysPerWeek: number }
  >();

  for (const doc of swimmersSnap.docs) {
    const data = doc.data();
    const swimmerId = doc.id;
    enrollmentById.set(swimmerId, getSwimmerEnrollmentMillis(data));
    siblingIdsBySwimmer.set(
      swimmerId,
      normalizeSiblingIds(data.siblingIds, swimmerId)
    );
    const levelForEligibility = (data.level && String(data.level).trim()) || "";
    const levelCfgForEligibility = levelForEligibility
      ? levels[levelForEligibility]
      : null;
    const trainingWeekdaysForEligibility: number[] = Array.isArray(data.trainingWeekdays)
      ? data.trainingWeekdays.filter((n) => typeof n === "number" && n >= 0 && n <= 6)
      : [];
    trainingEligibilityById.set(swimmerId, {
      trainingWeekdays: trainingWeekdaysForEligibility,
      minDaysPerWeek: levelCfgForEligibility?.minDaysPerWeek ?? 0,
    });
    const swimmerName =
      [data.childFirstName, data.childLastName].filter(Boolean).join(" ").trim() || doc.id;
    const level = (data.level && String(data.level).trim()) || "";
    const parentName =
      (typeof data.parentName === "string" && data.parentName.trim()) ||
      [data.parentFirstName, data.parentLastName].filter(Boolean).join(" ").trim() ||
      "";
    const parentEmailRaw =
      (typeof data.parentEmail === "string" && data.parentEmail.trim()) ||
      (Array.isArray(data.parentEmails)
        ? data.parentEmails.find((x: unknown) => typeof x === "string" && x.includes("@"))
        : "") ||
      "";
    const parentEmail = typeof parentEmailRaw === "string" ? parentEmailRaw.trim() : "";
    if (!isSwimmerEligibleForMonthlyTuition(data)) continue;
    if (!level) continue;
    if (levelSet && !levelSet.has(level)) continue;

    const trainingWeekdays: number[] = Array.isArray(data.trainingWeekdays)
      ? data.trainingWeekdays.filter((n) => typeof n === "number" && n >= 0 && n <= 6)
      : [];
    const levelCfg = level ? levels[level] : null;
    const swimmerSchedule = scheduleByWeekdayFromSlots(
      normalizeTrainingSchedule(data.trainingSchedule)
    );
    const legacyTime =
      data.trainingTimeSlot && String(data.trainingTimeSlot).trim()
        ? String(data.trainingTimeSlot).trim()
        : null;
    const legacyLoc =
      data.trainingLocation && String(data.trainingLocation).trim()
        ? String(data.trainingLocation).trim()
        : null;
    const defaultTime = levelCfg?.defaultTimeSlot ?? "7-8PM";
    const defaultLoc = levelCfg?.defaultLocation ?? "Mary Wayte Pool";
    const getTimeLoc = (wd: number) =>
      resolveTimeLocForWeekday(wd, swimmerSchedule, levelCfg, {
        timeSlot: legacyTime,
        location: legacyLoc,
      });

    let sessionCount = 0;
    const scheduleEntries: { mmdd: string; wd: number }[] = [];
    for (const wd of trainingWeekdays) {
      const list = datesByWeekday[wd] ?? [];
      sessionCount += list.length;
      for (const ymd of list) {
        const [y, mo, dd] = ymd.split("-").map(Number);
        scheduleEntries.push({ mmdd: toMMDD(new Date(y, mo - 1, dd)), wd });
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
      if (
        levelCfg.minDaysPerWeek > 0 &&
        daysChosen === levelCfg.minDaysPerWeek &&
        levelCfg.reducedRatePerHour != null
      ) {
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
    const firstWd = trainingWeekdays[0];
    const firstSlot = firstWd != null ? getTimeLoc(firstWd) : { timeSlot: defaultTime, location: defaultLoc };
    const storedSchedule = normalizeTrainingSchedule(data.trainingSchedule);

    results.push({
      swimmerId,
      swimmerName,
      level,
      parentName,
      parentEmail,
      trainingWeekdays,
      sessionCount,
      ratePerHour,
      minDaysPerWeek: levelCfg?.minDaysPerWeek ?? 0,
      tuition,
      scheduleLines,
      timeSlot: firstSlot.timeSlot,
      location: firstSlot.location,
      trainingSchedule: storedSchedule.length > 0 ? storedSchedule : undefined,
      needsConfig: Boolean(!level || (levelCfg && trainingWeekdays.length === 0)),
    });
  }

  const discountedResults = applySiblingTuitionDiscounts(
    results,
    enrollmentById,
    siblingIdsBySwimmer,
    trainingEligibilityById
  );

  discountedResults.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));

  return {
    month,
    noTrainingDates: Array.from(noTrainingSet),
    results: discountedResults,
    levelsFilter,
  };
}
