import type { Firestore } from "firebase-admin/firestore";
import { DEFAULT_LEVEL_CONFIG, type LevelConfigItem, type LevelScheduleSlot } from "@/lib/tuition-defaults";
import { SWIMMER_LEVELS } from "@/lib/swimmer-levels";
import {
  TUITION_V2_TEMPLATES_COLLECTION,
  TUITION_V2_TEMPLATES_DOC,
} from "@/lib/tuition-v2/constants";
import type {
  TuitionV2EffectiveRange,
  TuitionV2LevelPlan,
  TuitionV2LevelTemplate,
  TuitionV2LevelTemplateMap,
  TuitionV2SchedulePeriod,
  TuitionV2TrainingDate,
  TuitionV2WeeklySlot,
} from "@/lib/tuition-v2/types";
import { expandLegacyEffectiveRange } from "@/lib/tuition-v2/session-generator";

function slotsFromLevelConfig(cfg: LevelConfigItem): TuitionV2WeeklySlot[] {
  if (Array.isArray(cfg.schedule) && cfg.schedule.length > 0) {
    return cfg.schedule.map((s) => ({
      weekday: s.weekday,
      timeSlot: s.timeSlot,
      location: s.location,
    }));
  }
  return [];
}

/** Code defaults for initial V2 seed only — does not read or write V1 Firestore. */
export function defaultV2Templates(): TuitionV2LevelTemplateMap {
  const out: TuitionV2LevelTemplateMap = {};
  for (const level of SWIMMER_LEVELS) {
    const def = DEFAULT_LEVEL_CONFIG[level];
    if (!def) continue;
    out[level] = {
      defaultRatePerHour: def.defaultRatePerHour,
      minDaysPerWeek: def.minDaysPerWeek,
      reducedRatePerHour: def.reducedRatePerHour,
      weeklySlots: slotsFromLevelConfig(def),
      defaultTimeSlot: def.defaultTimeSlot,
      defaultLocation: def.defaultLocation,
    };
  }
  return out;
}

export function normalizeWeeklySlots(raw: unknown): TuitionV2WeeklySlot[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionV2WeeklySlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const weekday = typeof s.weekday === "number" ? s.weekday : Number(s.weekday);
    const timeSlot = typeof s.timeSlot === "string" ? s.timeSlot.trim() : "";
    const location = typeof s.location === "string" ? s.location.trim() : "";
    if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) continue;
    if (!timeSlot || !location) continue;
    out.push({ weekday, timeSlot, location });
  }
  return out.sort((a, b) => a.weekday - b.weekday);
}

function normalizeTemplate(raw: unknown, fallback: TuitionV2LevelTemplate): TuitionV2LevelTemplate {
  if (!raw || typeof raw !== "object") return fallback;
  const s = raw as Record<string, unknown>;
  return {
    defaultRatePerHour:
      typeof s.defaultRatePerHour === "number" ? s.defaultRatePerHour : fallback.defaultRatePerHour,
    minDaysPerWeek:
      typeof s.minDaysPerWeek === "number" ? s.minDaysPerWeek : fallback.minDaysPerWeek,
    reducedRatePerHour:
      s.reducedRatePerHour === null
        ? null
        : typeof s.reducedRatePerHour === "number"
          ? s.reducedRatePerHour
          : fallback.reducedRatePerHour,
    weeklySlots: normalizeWeeklySlots(s.weeklySlots ?? s.schedule).length
      ? normalizeWeeklySlots(s.weeklySlots ?? s.schedule)
      : fallback.weeklySlots,
    defaultTimeSlot:
      typeof s.defaultTimeSlot === "string" && s.defaultTimeSlot.trim()
        ? s.defaultTimeSlot.trim()
        : fallback.defaultTimeSlot,
    defaultLocation:
      typeof s.defaultLocation === "string" && s.defaultLocation.trim()
        ? s.defaultLocation.trim()
        : fallback.defaultLocation,
  };
}

export function mergeV2Templates(raw: Record<string, unknown> | null | undefined): TuitionV2LevelTemplateMap {
  const base = defaultV2Templates();
  if (!raw) return base;
  const out = { ...base };
  for (const level of Object.keys(base)) {
    out[level] = normalizeTemplate(raw[level], base[level]);
  }
  for (const level of Object.keys(raw)) {
    if (out[level]) continue;
    const fb: TuitionV2LevelTemplate = {
      defaultRatePerHour: 0,
      minDaysPerWeek: 2,
      reducedRatePerHour: null,
      weeklySlots: [],
      defaultTimeSlot: "7-8PM",
      defaultLocation: "Mary Wayte Pool",
    };
    out[level] = normalizeTemplate(raw[level], fb);
  }
  return out;
}

export type V2TemplateSource = "v2_saved" | "not_initialized";

/** Load V2 templates from tuition_v2_level_templates only. */
export async function loadV2TemplatesWithSource(
  db: Firestore
): Promise<{ levels: TuitionV2LevelTemplateMap; source: V2TemplateSource }> {
  const v2Snap = await db
    .collection(TUITION_V2_TEMPLATES_COLLECTION)
    .doc(TUITION_V2_TEMPLATES_DOC)
    .get();
  if (v2Snap.exists && v2Snap.data()?.levels) {
    return {
      levels: mergeV2Templates(v2Snap.data()!.levels as Record<string, unknown>),
      source: "v2_saved",
    };
  }
  return { levels: defaultV2Templates(), source: "not_initialized" };
}

export async function loadV2Templates(db: Firestore): Promise<TuitionV2LevelTemplateMap> {
  const { levels } = await loadV2TemplatesWithSource(db);
  return levels;
}

/** Write code defaults into tuition_v2_level_templates (V2 only). */
export async function seedV2TemplatesDefaults(db: Firestore): Promise<TuitionV2LevelTemplateMap> {
  const levels = defaultV2Templates();
  await db
    .collection(TUITION_V2_TEMPLATES_COLLECTION)
    .doc(TUITION_V2_TEMPLATES_DOC)
    .set({ levels, updatedAt: new Date().toISOString() });
  return levels;
}

export async function saveV2Templates(
  db: Firestore,
  levels: TuitionV2LevelTemplateMap
): Promise<TuitionV2LevelTemplateMap> {
  const normalized = mergeV2Templates(levels as unknown as Record<string, unknown>);
  await db
    .collection(TUITION_V2_TEMPLATES_COLLECTION)
    .doc(TUITION_V2_TEMPLATES_DOC)
    .set({ levels: normalized, updatedAt: new Date().toISOString() });
  return normalized;
}

export function levelPlanFromTemplate(level: string, template: TuitionV2LevelTemplate): TuitionV2LevelPlan {
  return {
    level,
    weeklySlots: template.weeklySlots.map((s) => ({ ...s })),
    schedulePeriods: [],
    notes: "",
  };
}

/** Copy template weekly slots into a plan; keep month-specific schedule periods and notes. */
export function mergeTemplateWeeklySlotsIntoPlan(
  existing: TuitionV2LevelPlan | null | undefined,
  level: string,
  template: TuitionV2LevelTemplate
): TuitionV2LevelPlan {
  const weeklySlots = template.weeklySlots.map((s) => ({ ...s }));
  if (!existing) return levelPlanFromTemplate(level, template);
  return {
    ...existing,
    weeklySlots,
  };
}

function normalizeTrainingDates(raw: unknown): TuitionV2TrainingDate[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionV2TrainingDate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const date = typeof r.date === "string" ? r.date.trim() : "";
    const timeSlot = typeof r.timeSlot === "string" ? r.timeSlot.trim() : "";
    const location = typeof r.location === "string" ? r.location.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeSlot || !location) continue;
    out.push({ date, timeSlot, location });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
}

export function normalizeSchedulePeriods(raw: unknown): TuitionV2SchedulePeriod[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionV2SchedulePeriod[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const startDate = typeof r.startDate === "string" ? r.startDate.trim() : "";
    const endDate = typeof r.endDate === "string" ? r.endDate.trim() : "";
    const trainingDates = normalizeTrainingDates(r.trainingDates);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;
    if (startDate > endDate) continue;
    out.push({ startDate, endDate, trainingDates });
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function normalizeLegacyEffectiveRanges(raw: unknown): TuitionV2EffectiveRange[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionV2EffectiveRange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const startDate = typeof r.startDate === "string" ? r.startDate.trim() : "";
    const endDate = typeof r.endDate === "string" ? r.endDate.trim() : "";
    const weeklySlots = normalizeWeeklySlots(r.weeklySlots);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;
    if (weeklySlots.length === 0) continue;
    out.push({ startDate, endDate, weeklySlots });
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function migrateLegacyPlanFields(
  r: Record<string, unknown>,
  month: string
): TuitionV2SchedulePeriod[] {
  const fromPeriods = normalizeSchedulePeriods(r.schedulePeriods);
  if (fromPeriods.length > 0) return fromPeriods;

  const flatDates = normalizeTrainingDates(r.dateOverrides);
  if (flatDates.length > 0) {
    return flatDates.map((t) => ({
      startDate: t.date,
      endDate: t.date,
      trainingDates: [t],
    }));
  }

  const legacy = normalizeLegacyEffectiveRanges(r.effectiveRanges);
  if (legacy.length > 0) {
    return legacy.map((range) => ({
      startDate: range.startDate,
      endDate: range.endDate,
      trainingDates: expandLegacyEffectiveRange(range, month),
    }));
  }

  return [];
}

export function normalizeLevelPlan(
  level: string,
  raw: unknown,
  template: TuitionV2LevelTemplate,
  month?: string
): TuitionV2LevelPlan {
  const base = levelPlanFromTemplate(level, template);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const weeklySlots = normalizeWeeklySlots(r.weeklySlots);
  const schedulePeriods = month ? migrateLegacyPlanFields(r, month) : normalizeSchedulePeriods(r.schedulePeriods);
  return {
    level,
    weeklySlots: weeklySlots.length ? weeklySlots : base.weeklySlots,
    schedulePeriods,
    notes: typeof r.notes === "string" ? r.notes : "",
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}
