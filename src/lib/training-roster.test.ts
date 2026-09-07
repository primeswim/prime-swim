/**
 * Training roster + auto-refresh pipeline smoke tests (pure / shared math).
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' src/lib/training-roster.test.ts
 */
import { getBillableSessionsForSwimmer } from "./tuition-v2/calculate-engine";
import {
  resolveSessionsForMonth,
  schedulePeriodCoverage,
} from "./tuition-v2/session-generator";
import type {
  TuitionV2LevelPlan,
  TuitionV2Session,
  TuitionV2SwimmerEnrollment,
  TuitionV2SwimmerResponse,
} from "./tuition-v2/types";
import type { TrainingRosterSlot } from "./training-roster-types";
import { omitEmptyRosterLevels } from "./training-roster-types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function buildSlotsFromBillable(
  sessions: TuitionV2Session[],
  attendeesBySession: Map<string, { swimmerId: string; swimmerName: string }[]>
): TrainingRosterSlot[] {
  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slotMap = new Map<
    string,
    {
      date: string;
      weekday: number;
      timeSlot: string;
      location: string;
      byLevel: Map<string, { swimmerId: string; swimmerName: string }[]>;
    }
  >();

  for (const s of sessions) {
    if (s.cancelled) continue;
    const key = `${s.date}|${s.timeSlot}|${s.location}`;
    let slot = slotMap.get(key);
    if (!slot) {
      slot = {
        date: s.date,
        weekday: s.weekday,
        timeSlot: s.timeSlot,
        location: s.location,
        byLevel: new Map(),
      };
      slotMap.set(key, slot);
    }
    const attendees = attendeesBySession.get(s.id) ?? [];
    if (attendees.length === 0) continue;
    slot.byLevel.set(s.level, attendees);
  }

  return [...slotMap.values()].map((slot) => {
    const levels = [...slot.byLevel.entries()].map(([level, attendees]) => ({
      level,
      count: attendees.length,
      attendees,
    }));
    return {
      date: slot.date,
      weekday: slot.weekday,
      weekdayLabel: WEEKDAY_LABELS[slot.weekday] ?? "",
      timeSlot: slot.timeSlot,
      location: slot.location,
      levels,
      totalCount: levels.reduce((sum, l) => sum + l.count, 0),
    };
  });
}

function testRosterCountsMatchBillable() {
  const month = "2026-09";
  const plan: TuitionV2LevelPlan = {
    level: "Silver Beginner",
    weeklySlots: [{ weekday: 2, timeSlot: "5-6PM", location: "Mary Wayte Pool" }],
    schedulePeriods: [
      {
        startDate: "2026-09-01",
        endDate: "2026-09-07",
        trainingDates: [
          { date: "2026-09-02", timeSlot: "5-6PM", location: "Mary Wayte Pool" },
        ],
      },
    ],
  };
  const sessions = resolveSessionsForMonth(month, [plan], [], []);
  const coverage = schedulePeriodCoverage([plan], month);

  const e1: TuitionV2SwimmerEnrollment = {
    swimmerId: "a",
    swimmerName: "Alice",
    level: "Silver Beginner",
    parentName: "",
    parentEmail: "",
    regularWeekdays: [2],
  };
  const e2: TuitionV2SwimmerEnrollment = {
    swimmerId: "b",
    swimmerName: "Bob",
    level: "Silver Beginner",
    parentName: "",
    parentEmail: "",
    regularWeekdays: [2],
  };
  const responseSkip: TuitionV2SwimmerResponse = {
    swimmerId: "b",
    adjustments: [
      {
        type: "skip_session",
        fromSessionId: sessions.find((s) => s.date === "2026-09-02")?.id,
      },
    ],
  };

  const attendeesBySession = new Map<string, { swimmerId: string; swimmerName: string }[]>();
  for (const s of sessions) attendeesBySession.set(s.id, []);

  for (const enrollment of [e1, e2]) {
    const response = enrollment.swimmerId === "b" ? responseSkip : null;
    const billable = getBillableSessionsForSwimmer(
      enrollment,
      sessions,
      response,
      coverage.explicit,
      coverage.periodDatesByLevel
    );
    for (const s of billable) {
      attendeesBySession.get(s.id)!.push({
        swimmerId: enrollment.swimmerId,
        swimmerName: enrollment.swimmerName,
      });
    }
  }

  const slots = buildSlotsFromBillable(sessions, attendeesBySession);
  const sep2 = slots.find((s) => s.date === "2026-09-02");
  assert(!!sep2, "Sep 2 slot exists");
  assert(sep2!.totalCount === 1, "Bob skipped — only Alice on Sep 2");
  assert(sep2!.levels[0].attendees[0].swimmerName === "Alice", "Alice attends");

  // After period ends, regular Tuesday should include both
  const laterTue = slots.find((s) => s.date === "2026-09-15");
  assert(!!laterTue, "regular Tue session after period");
  assert(laterTue!.totalCount === 2, "both swimmers on regular Tue");
}

function testSameTimeSlotAggregatesLevels() {
  const sessions: TuitionV2Session[] = [
    {
      id: "2026-09-08_silver-beginner_5-6pm",
      date: "2026-09-08",
      weekday: 2,
      level: "Silver Beginner",
      timeSlot: "5-6PM",
      location: "Mary Wayte Pool",
      source: "generated",
      cancelled: false,
    },
    {
      id: "2026-09-08_silver-performance_5-6pm",
      date: "2026-09-08",
      weekday: 2,
      level: "Silver Performance",
      timeSlot: "5-6PM",
      location: "Mary Wayte Pool",
      source: "generated",
      cancelled: false,
    },
  ];
  const attendeesBySession = new Map([
    [
      sessions[0].id,
      [
        { swimmerId: "1", swimmerName: "A" },
        { swimmerId: "2", swimmerName: "B" },
      ],
    ],
    [sessions[1].id, [{ swimmerId: "3", swimmerName: "C" }]],
  ]);
  const slots = buildSlotsFromBillable(sessions, attendeesBySession);
  assert(slots.length === 1, "same time+pool collapses to one slot");
  assert(slots[0].totalCount === 3, "total kids across levels");
  assert(slots[0].levels.length === 2, "two levels in slot");
}

function testOmitEmptyLevels() {
  const slots: TrainingRosterSlot[] = [
    {
      date: "2026-10-01",
      weekday: 4,
      weekdayLabel: "Thu",
      timeSlot: "5-6PM",
      location: "Redmond Pool",
      totalCount: 3,
      levels: [
        { level: "Bronze Beginner", count: 3, attendees: [] },
        { level: "Gold Performance", count: 0, attendees: [] },
      ],
    },
    {
      date: "2026-10-01",
      weekday: 4,
      weekdayLabel: "Thu",
      timeSlot: "6-8PM",
      location: "Redmond Pool",
      totalCount: 0,
      levels: [{ level: "Gold Performance", count: 0, attendees: [] }],
    },
  ];
  const cleaned = omitEmptyRosterLevels(slots);
  assert(cleaned.length === 1, "drop time slots with nobody");
  assert(cleaned[0].levels.length === 1, "drop empty level");
  assert(cleaned[0].levels[0].level === "Bronze Beginner", "keep occupied level");
  assert(cleaned[0].totalCount === 3, "recount after dropping zeros");
}

function run() {
  testRosterCountsMatchBillable();
  testSameTimeSlotAggregatesLevels();
  testOmitEmptyLevels();
  console.log("training-roster tests passed");
}

run();
