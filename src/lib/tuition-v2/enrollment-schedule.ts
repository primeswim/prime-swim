import type { TuitionV2SwimmerEnrollment } from "./types";

/** Months already underway keep the level and training days they had. */
export function enrollmentForMonth(
  enrollment: TuitionV2SwimmerEnrollment,
  month: string
): TuitionV2SwimmerEnrollment {
  const level = enrollment.levelByMonth?.[month];
  const days = enrollment.weekdaysByMonth?.[month];
  const nextLevel = level && level !== enrollment.level ? level : enrollment.level;
  const nextDays = days ?? enrollment.regularWeekdays;
  if (nextLevel === enrollment.level && nextDays === enrollment.regularWeekdays) return enrollment;
  return { ...enrollment, level: nextLevel, regularWeekdays: nextDays };
}


/** Validate a real calendar date, without local timezone conversion. */
export function validTrainingStartDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
