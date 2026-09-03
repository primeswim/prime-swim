import type { Firestore } from "firebase-admin/firestore";
import { getBillableSessionsForSwimmer } from "@/lib/tuition-v2/calculate-engine";
import { listSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";
import {
  ensureMonthDoc,
  loadLevelPlans,
  loadSessions,
} from "@/lib/tuition-v2/month-service";
import {
  resolveSessionsForMonth,
  schedulePeriodCoverage,
} from "@/lib/tuition-v2/session-generator";
import { loadSwimmerResponses } from "@/lib/tuition-v2/swimmer-response-service";
import {
  TRAINING_ROSTERS_COLLECTION,
  type TrainingRosterAttendee,
  type TrainingRosterDoc,
  type TrainingRosterLevelGroup,
  type TrainingRosterSlot,
} from "@/lib/training-roster-types";

export type {
  TrainingRosterAttendee,
  TrainingRosterDoc,
  TrainingRosterLevelGroup,
  TrainingRosterSlot,
} from "@/lib/training-roster-types";
export { TRAINING_ROSTERS_COLLECTION } from "@/lib/training-roster-types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function slotKey(date: string, timeSlot: string, location: string): string {
  return `${date}|${timeSlot}|${location}`;
}

/**
 * Build expected training roster from Tuition V2 plans + enrollments + responses.
 * Same “who attends” rules as billable sessions.
 */
export async function computeTrainingRoster(
  db: Firestore,
  month: string
): Promise<Omit<TrainingRosterDoc, "generatedAt" | "generatedBy">> {
  const monthDoc = await ensureMonthDoc(db, month);
  const [enrollments, sessionsStored, responses, levelPlans] = await Promise.all([
    listSwimmerEnrollments(db),
    loadSessions(db, month),
    loadSwimmerResponses(db, month),
    loadLevelPlans(db, month),
  ]);

  const billingSessions = resolveSessionsForMonth(
    month,
    levelPlans,
    sessionsStored,
    monthDoc.noTrainingDates
  );
  const periodCoverage = schedulePeriodCoverage(levelPlans, month);
  const responseById = new Map(responses.map((r) => [r.swimmerId, r]));

  // sessionId → attendees
  const attendeesBySession = new Map<string, TrainingRosterAttendee[]>();
  const sessionMeta = new Map<
    string,
    { date: string; weekday: number; timeSlot: string; location: string; level: string }
  >();

  for (const s of billingSessions) {
    if (s.cancelled) continue;
    sessionMeta.set(s.id, {
      date: s.date,
      weekday: s.weekday,
      timeSlot: s.timeSlot,
      location: s.location,
      level: s.level,
    });
    attendeesBySession.set(s.id, []);
  }

  const uniqueSwimmers = new Set<string>();

  for (const enrollment of enrollments) {
    if (enrollment.active === false) continue;
    const billable = getBillableSessionsForSwimmer(
      enrollment,
      billingSessions,
      responseById.get(enrollment.swimmerId) ?? null,
      periodCoverage.explicit,
      periodCoverage.periodDatesByLevel
    );
    for (const session of billable) {
      const list = attendeesBySession.get(session.id);
      if (!list) continue;
      list.push({
        swimmerId: enrollment.swimmerId,
        swimmerName: enrollment.swimmerName,
      });
      uniqueSwimmers.add(enrollment.swimmerId);
    }
  }

  // Group by (date, timeSlot, location)
  const slotMap = new Map<
    string,
    {
      date: string;
      weekday: number;
      timeSlot: string;
      location: string;
      byLevel: Map<string, TrainingRosterAttendee[]>;
    }
  >();

  let sessionCount = 0;
  for (const [sessionId, attendees] of attendeesBySession) {
    const meta = sessionMeta.get(sessionId);
    if (!meta) continue;
    // Include sessions even with 0 attendees so coaches see empty slots
    sessionCount += 1;
    const key = slotKey(meta.date, meta.timeSlot, meta.location);
    let slot = slotMap.get(key);
    if (!slot) {
      slot = {
        date: meta.date,
        weekday: meta.weekday,
        timeSlot: meta.timeSlot,
        location: meta.location,
        byLevel: new Map(),
      };
      slotMap.set(key, slot);
    }
    const sorted = [...attendees].sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
    const existing = slot.byLevel.get(meta.level) ?? [];
    // Merge if same level somehow appears twice (shouldn't), prefer unique ids
    const seen = new Set(existing.map((a) => a.swimmerId));
    for (const a of sorted) {
      if (!seen.has(a.swimmerId)) {
        existing.push(a);
        seen.add(a.swimmerId);
      }
    }
    slot.byLevel.set(meta.level, existing);
  }

  const slots: TrainingRosterSlot[] = [...slotMap.values()]
    .map((slot) => {
      const levels: TrainingRosterLevelGroup[] = [...slot.byLevel.entries()]
        .map(([level, attendees]) => ({
          level,
          count: attendees.length,
          attendees: attendees.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName)),
        }))
        .sort((a, b) => a.level.localeCompare(b.level));
      const totalCount = levels.reduce((sum, l) => sum + l.count, 0);
      return {
        date: slot.date,
        weekday: slot.weekday,
        weekdayLabel: WEEKDAY_LABELS[slot.weekday] ?? "",
        timeSlot: slot.timeSlot,
        location: slot.location,
        levels,
        totalCount,
      };
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      const byTime = a.timeSlot.localeCompare(b.timeSlot);
      if (byTime !== 0) return byTime;
      return a.location.localeCompare(b.location);
    });

  return {
    month,
    sessionCount,
    slotCount: slots.length,
    uniqueSwimmerCount: uniqueSwimmers.size,
    slots,
  };
}

export async function loadTrainingRoster(
  db: Firestore,
  month: string
): Promise<TrainingRosterDoc | null> {
  const snap = await db.collection(TRAINING_ROSTERS_COLLECTION).doc(month).get();
  if (!snap.exists) return null;
  const raw = snap.data() as TrainingRosterDoc | undefined;
  if (!raw || !Array.isArray(raw.slots)) return null;
  return {
    month: raw.month || month,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    generatedBy: typeof raw.generatedBy === "string" ? raw.generatedBy : "",
    sessionCount: typeof raw.sessionCount === "number" ? raw.sessionCount : 0,
    slotCount: typeof raw.slotCount === "number" ? raw.slotCount : raw.slots.length,
    uniqueSwimmerCount: typeof raw.uniqueSwimmerCount === "number" ? raw.uniqueSwimmerCount : 0,
    slots: raw.slots,
  };
}

export async function saveTrainingRoster(
  db: Firestore,
  month: string,
  generatedBy: string
): Promise<TrainingRosterDoc> {
  const computed = await computeTrainingRoster(db, month);
  const doc: TrainingRosterDoc = {
    ...computed,
    generatedAt: new Date().toISOString(),
    generatedBy,
  };
  await db.collection(TRAINING_ROSTERS_COLLECTION).doc(month).set(doc);
  return doc;
}
