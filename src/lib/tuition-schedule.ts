import type { LevelConfigItem, LevelScheduleSlot } from "@/lib/tuition-defaults";

export type TrainingScheduleSlot = LevelScheduleSlot;

export function normalizeTrainingSchedule(raw: unknown): TrainingScheduleSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: TrainingScheduleSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const weekday = Number(s.weekday);
    const timeSlot = String(s.timeSlot ?? "").trim();
    const location = String(s.location ?? "").trim();
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    if (!timeSlot || !location) continue;
    out.push({ weekday, timeSlot, location });
  }
  return out;
}

export function scheduleByWeekdayFromSlots(
  slots: TrainingScheduleSlot[]
): Record<number, { timeSlot: string; location: string }> {
  const map: Record<number, { timeSlot: string; location: string }> = {};
  for (const s of slots) {
    map[s.weekday] = { timeSlot: s.timeSlot, location: s.location };
  }
  return map;
}

export function levelScheduleByWeekday(
  levelCfg: LevelConfigItem | null | undefined
): Record<number, { timeSlot: string; location: string }> {
  const map: Record<number, { timeSlot: string; location: string }> = {};
  if (!levelCfg?.schedule?.length) return map;
  for (const slot of levelCfg.schedule) {
    map[slot.weekday] = { timeSlot: slot.timeSlot, location: slot.location };
  }
  return map;
}

export function defaultTimeLocForWeekday(
  wd: number,
  levelCfg: LevelConfigItem | null | undefined
): { timeSlot: string; location: string } {
  const levelMap = levelScheduleByWeekday(levelCfg);
  return (
    levelMap[wd] ?? {
      timeSlot: levelCfg?.defaultTimeSlot ?? "7-8PM",
      location: levelCfg?.defaultLocation ?? "Mary Wayte Pool",
    }
  );
}

export function resolveTimeLocForWeekday(
  wd: number,
  swimmerSchedule: Record<number, { timeSlot: string; location: string }>,
  levelCfg: LevelConfigItem | null | undefined,
  legacy?: { timeSlot: string | null; location: string | null }
): { timeSlot: string; location: string } {
  const swimmerSlot = swimmerSchedule[wd];
  if (swimmerSlot) return swimmerSlot;

  const hasSwimmerSchedule = Object.keys(swimmerSchedule).length > 0;
  if (
    !hasSwimmerSchedule &&
    legacy?.timeSlot &&
    legacy.location
  ) {
    return { timeSlot: legacy.timeSlot, location: legacy.location };
  }

  return defaultTimeLocForWeekday(wd, levelCfg);
}

export function buildEditScheduleForWeekdays(
  trainingWeekdays: number[],
  swimmerSchedule: TrainingScheduleSlot[],
  levelCfg: LevelConfigItem | null | undefined
): Record<number, { timeSlot: string; location: string }> {
  const swimmerMap = scheduleByWeekdayFromSlots(swimmerSchedule);
  const out: Record<number, { timeSlot: string; location: string }> = {};
  for (const wd of [...trainingWeekdays].sort((a, b) => a - b)) {
    out[wd] = swimmerMap[wd] ?? defaultTimeLocForWeekday(wd, levelCfg);
  }
  return out;
}

/** Persist only weekdays that differ from the swimmer's level defaults. */
export function trainingScheduleFromEditForm(
  scheduleByWeekday: Record<number, { timeSlot: string; location: string }>,
  levelCfg: LevelConfigItem | null | undefined
): TrainingScheduleSlot[] | null {
  const custom: TrainingScheduleSlot[] = [];
  for (const [wdStr, slot] of Object.entries(scheduleByWeekday)) {
    const wd = Number(wdStr);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) continue;
    const timeSlot = slot.timeSlot.trim();
    const location = slot.location.trim();
    if (!timeSlot || !location) continue;
    const levelDefault = defaultTimeLocForWeekday(wd, levelCfg);
    if (timeSlot !== levelDefault.timeSlot || location !== levelDefault.location) {
      custom.push({ weekday: wd, timeSlot, location });
    }
  }
  return custom.length > 0 ? custom.sort((a, b) => a.weekday - b.weekday) : null;
}
