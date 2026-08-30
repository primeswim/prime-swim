import type {
  TuitionV2EffectiveRange,
  TuitionV2LevelPlan,
  TuitionV2SchedulePeriod,
  TuitionV2Session,
  TuitionV2TrainingDate,
  TuitionV2WeeklySlot,
} from "@/lib/tuition-v2/types";

function getDatesInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

function weekdayForDate(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d).getDay();
}

function levelSlug(level: string): string {
  return level
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function timeSlug(timeSlot: string): string {
  return (
    timeSlot
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "t"
  );
}

export function sessionIdFor(date: string, level: string, timeSlot: string): string {
  return `${date}_${levelSlug(level)}_${timeSlug(timeSlot)}`;
}

export function sessionKey(date: string, level: string, timeSlot: string): string {
  return sessionIdFor(date, level, timeSlot);
}

function slotForWeekday(slots: TuitionV2WeeklySlot[], weekday: number): TuitionV2WeeklySlot | null {
  return slots.find((s) => s.weekday === weekday) ?? null;
}

function periodForDate(plan: TuitionV2LevelPlan, date: string): TuitionV2SchedulePeriod | null {
  for (const period of plan.schedulePeriods ?? []) {
    if (date >= period.startDate && date <= period.endDate) {
      return period;
    }
  }
  return null;
}

function makeSession(
  date: string,
  level: string,
  timeSlot: string,
  location: string,
  extraTraining = false
): TuitionV2Session {
  return {
    id: sessionIdFor(date, level, timeSlot),
    date,
    level,
    weekday: weekdayForDate(date),
    timeSlot,
    location,
    source: "generated",
    cancelled: false,
    extraTraining,
  };
}

/** Session ids from explicit schedule-period training dates (for billing). */
export function explicitTrainingSessionKeys(levelPlans: TuitionV2LevelPlan[]): Set<string> {
  const keys = new Set<string>();
  for (const plan of levelPlans) {
    if (!plan.level) continue;
    for (const period of plan.schedulePeriods ?? []) {
      for (const t of period.trainingDates) {
        keys.add(sessionIdFor(t.date, plan.level, t.timeSlot));
      }
    }
  }
  return keys;
}

/** Expand legacy weekday-based period into explicit training dates. */
export function expandLegacyEffectiveRange(
  range: TuitionV2EffectiveRange,
  month: string
): TuitionV2TrainingDate[] {
  const dates = getDatesInMonth(month);
  const out: TuitionV2TrainingDate[] = [];
  for (const date of dates) {
    if (date < range.startDate || date > range.endDate) continue;
    const weekday = weekdayForDate(date);
    const slot = slotForWeekday(range.weeklySlots, weekday);
    if (!slot) continue;
    out.push({ date, timeSlot: slot.timeSlot, location: slot.location });
  }
  return out;
}

export function generateSessionsForMonth(
  month: string,
  levelPlans: TuitionV2LevelPlan[],
  noTrainingDates: string[]
): TuitionV2Session[] {
  const noTraining = new Set(noTrainingDates);
  const dates = getDatesInMonth(month);
  const sessions: TuitionV2Session[] = [];

  for (const plan of levelPlans) {
    if (!plan.level) continue;

    for (const date of dates) {
      if (noTraining.has(date)) continue;

      const period = periodForDate(plan, date);
      if (period) {
        for (const t of period.trainingDates) {
          if (t.date !== date) continue;
          sessions.push(makeSession(date, plan.level, t.timeSlot, t.location, true));
        }
        continue;
      }

      const weekday = weekdayForDate(date);
      const slot = slotForWeekday(plan.weeklySlots, weekday);
      if (!slot) continue;
      sessions.push(makeSession(date, plan.level, slot.timeSlot, slot.location));
    }
  }

  sessions.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byLevel = a.level.localeCompare(b.level);
    if (byLevel !== 0) return byLevel;
    return a.timeSlot.localeCompare(b.timeSlot);
  });
  return sessions;
}

/** Merge regenerated sessions with manual sessions and preserved cancellations. */
export function mergeRegeneratedSessions(
  generated: TuitionV2Session[],
  existing: TuitionV2Session[]
): TuitionV2Session[] {
  const manual = existing.filter((s) => s.source === "manual");
  const cancelledKeys = new Set(
    existing.filter((s) => s.cancelled).map((s) => sessionKey(s.date, s.level, s.timeSlot))
  );

  const merged = generated.map((s) => {
    const key = sessionKey(s.date, s.level, s.timeSlot);
    if (cancelledKeys.has(key)) {
      return { ...s, cancelled: true };
    }
    return s;
  });

  const mergedKeys = new Set(merged.map((s) => sessionKey(s.date, s.level, s.timeSlot)));
  for (const m of manual) {
    const key = sessionKey(m.date, m.level, m.timeSlot);
    if (!mergedKeys.has(key)) {
      merged.push(m);
      mergedKeys.add(key);
    }
  }

  merged.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.level.localeCompare(b.level);
  });
  return merged;
}

export function normalizeSession(raw: unknown, id: string): TuitionV2Session | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const date = typeof s.date === "string" ? s.date : "";
  const level = typeof s.level === "string" ? s.level : "";
  const weekday = typeof s.weekday === "number" ? s.weekday : Number(s.weekday);
  const timeSlot = typeof s.timeSlot === "string" ? s.timeSlot.trim() : "";
  const location = typeof s.location === "string" ? s.location.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !level || !timeSlot || !location) return null;
  if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) return null;
  const source = s.source === "manual" ? "manual" : "generated";
  return {
    id,
    date,
    level,
    weekday,
    timeSlot,
    location,
    source,
    cancelled: s.cancelled === true,
    cancelReason: typeof s.cancelReason === "string" ? s.cancelReason : undefined,
    extraTraining: s.extraTraining === true,
  };
}

export function isDateInMonth(date: string, month: string): boolean {
  return date.startsWith(`${month}-`);
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function validateSchedulePeriod(period: TuitionV2SchedulePeriod, month: string): string | null {
  const { start, end } = monthBounds(month);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(period.endDate)) {
    return "Invalid period dates";
  }
  if (period.startDate > period.endDate) return "Start date must be before end date";
  if (period.endDate < start || period.startDate > end) {
    return "Period must overlap the selected month";
  }
  for (const t of period.trainingDates) {
    if (t.date < period.startDate || t.date > period.endDate) {
      return `Training date ${t.date} must fall within the period`;
    }
    if (!t.timeSlot.trim() || !t.location.trim()) return "Each training date needs time and pool";
  }
  return null;
}
