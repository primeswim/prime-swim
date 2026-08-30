import type {
  TuitionV2LevelTemplate,
  TuitionV2Session,
  TuitionV2SwimmerEnrollment,
  TuitionV2SwimmerResponse,
  TuitionV2RateTier,
  TuitionV2InvoiceLineItem,
} from "@/lib/tuition-v2/types";
import { formatSessionLine } from "@/lib/tuition-v2/shared-ui";

export type RateResult = {
  ratePerHour: number;
  rateTier: TuitionV2RateTier;
  rateTierReason: string;
};

export function getMonthlyRate(
  enrollment: TuitionV2SwimmerEnrollment,
  template: TuitionV2LevelTemplate | undefined
): RateResult {
  if (typeof enrollment.ratePerHourOverride === "number" && enrollment.ratePerHourOverride > 0) {
    return {
      ratePerHour: enrollment.ratePerHourOverride,
      rateTier: "override",
      rateTierReason: "Manual rate override",
    };
  }
  const chosen = enrollment.regularWeekdays.length;
  const min = template?.minDaysPerWeek ?? 0;
  if (chosen < min) {
    return {
      ratePerHour: template?.defaultRatePerHour ?? 0,
      rateTier: "normal",
      rateTierReason: `Regular plan (${chosen} day${chosen === 1 ? "" : "s"}/wk) below min (${min}) → normal rate`,
    };
  }
  const reduced = template?.reducedRatePerHour ?? template?.defaultRatePerHour ?? 0;
  return {
    ratePerHour: reduced,
    rateTier: "reduced",
    rateTierReason: `Regular plan (${chosen} day${chosen === 1 ? "" : "s"}/wk) meets min (${min}) → reduced rate`,
  };
}

function isWeekdayUnavailable(
  weekday: number,
  enrollment: TuitionV2SwimmerEnrollment,
  response: TuitionV2SwimmerResponse | null
): boolean {
  const fromEnrollment = enrollment.unavailableWeekdays?.includes(weekday);
  if (fromEnrollment) return true;
  const avail = response?.weekdayAvailability?.[weekday];
  return avail === "unavailable";
}

export function getBillableSessionsForSwimmer(
  enrollment: TuitionV2SwimmerEnrollment,
  allSessions: TuitionV2Session[],
  response: TuitionV2SwimmerResponse | null,
  explicitTrainingKeys: Set<string> = new Set()
): TuitionV2Session[] {
  const levelSessions = allSessions.filter(
    (s) => s.level === enrollment.level && !s.cancelled
  );
  const byId = new Map(levelSessions.map((s) => [s.id, s]));

  const skipIds = new Set<string>();
  const swapFromIds = new Set<string>();
  const addIds = new Set<string>();

  for (const adj of response?.adjustments ?? []) {
    if (adj.type === "skip_session" && adj.fromSessionId) skipIds.add(adj.fromSessionId);
    if (adj.type === "swap_session") {
      if (adj.fromSessionId) swapFromIds.add(adj.fromSessionId);
      if (adj.toSessionId) addIds.add(adj.toSessionId);
    }
    if (adj.type === "add_session" && adj.toSessionId) addIds.add(adj.toSessionId);
  }

  const isExtraTraining = (session: TuitionV2Session) =>
    session.extraTraining === true || explicitTrainingKeys.has(session.id);

  const billableIds = new Set<string>();

  for (const session of levelSessions) {
    if (skipIds.has(session.id) || swapFromIds.has(session.id)) continue;
    if (addIds.has(session.id)) {
      billableIds.add(session.id);
      continue;
    }
    if (isExtraTraining(session)) {
      if (isWeekdayUnavailable(session.weekday, enrollment, response)) continue;
      billableIds.add(session.id);
      continue;
    }
    if (!enrollment.regularWeekdays.includes(session.weekday)) continue;
    if (isWeekdayUnavailable(session.weekday, enrollment, response)) continue;
    billableIds.add(session.id);
  }

  for (const id of addIds) {
    if (byId.has(id)) billableIds.add(id);
    else {
      const s = allSessions.find((x) => x.id === id && !x.cancelled);
      if (s) billableIds.add(s.id);
    }
  }

  return [...billableIds]
    .map((id) => byId.get(id) ?? allSessions.find((s) => s.id === id))
    .filter((s): s is TuitionV2Session => Boolean(s))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildLineItems(
  sessions: TuitionV2Session[],
  ratePerHour: number
): TuitionV2InvoiceLineItem[] {
  return sessions.map((s) => ({
    date: s.date,
    timeSlot: s.timeSlot,
    location: s.location,
    amount: ratePerHour,
  }));
}

export function practiceTextFromLineItems(items: TuitionV2InvoiceLineItem[]): string {
  return items
    .map((li) => formatSessionLine(li.date, li.timeSlot, li.location))
    .join("\n");
}

export type TuitionCalcRow = {
  swimmerId: string;
  tuition: number;
  trainingWeekdays: number[];
  minDaysPerWeek: number;
};

/** Rows for sibling discount — min days check uses regularWeekdays only. */
export function toSiblingDiscountRows(
  enrollments: TuitionV2SwimmerEnrollment[],
  tuitionById: Map<string, number>,
  minDaysByLevel: Map<string, number>
): TuitionCalcRow[] {
  return enrollments.map((e) => ({
    swimmerId: e.swimmerId,
    tuition: tuitionById.get(e.swimmerId) ?? 0,
    trainingWeekdays: e.regularWeekdays,
    minDaysPerWeek: minDaysByLevel.get(e.level) ?? 0,
  }));
}
