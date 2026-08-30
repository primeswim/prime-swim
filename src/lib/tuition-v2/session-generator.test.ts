import {
  generateSessionsForMonth,
  mergeRegeneratedSessions,
  sessionIdFor,
} from "./session-generator";
import type { TuitionV2LevelPlan } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function testBasicGeneration() {
  const plans: TuitionV2LevelPlan[] = [
    {
      level: "Bronze Performance",
      weeklySlots: [
        { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
        { weekday: 5, timeSlot: "5-5:55PM", location: "Norwood Swimming Pool" },
      ],
    },
  ];
  const sessions = generateSessionsForMonth("2026-09", plans, ["2026-09-07"]);
  assert(sessions.length > 0, "generates sessions");
  assert(!sessions.some((s) => s.date === "2026-09-07"), "skips no-training");
  const mon = sessions.find((s) => s.date === "2026-09-14" && s.weekday === 1);
  assert(mon?.timeSlot === "7-8PM", "mon slot");
}

function testSchedulePeriod() {
  const plans: TuitionV2LevelPlan[] = [
    {
      level: "Bronze Performance",
      weeklySlots: [
        { weekday: 5, timeSlot: "5-5:55PM", location: "Norwood Swimming Pool" },
      ],
      schedulePeriods: [
        {
          startDate: "2026-09-01",
          endDate: "2026-09-14",
          trainingDates: [
            { date: "2026-09-04", timeSlot: "7-8PM", location: "Mary Wayte Pool" },
            { date: "2026-09-11", timeSlot: "7-8PM", location: "Mary Wayte Pool" },
          ],
        },
      ],
    },
  ];
  const sessions = generateSessionsForMonth("2026-09", plans, []);
  const friInPeriodNotListed = sessions.find((s) => s.date === "2026-09-18" && s.weekday === 5);
  const friOverride = sessions.find((s) => s.date === "2026-09-04");
  const friInPeriodSkipped = sessions.find((s) => s.date === "2026-09-05");
  assert(friOverride?.location === "Mary Wayte Pool", "explicit training date in period");
  assert(!friInPeriodSkipped, "default weekly ignored inside period");
  assert(friInPeriodNotListed?.location === "Norwood Swimming Pool", "outside period uses default");
}

function testPreserveCancellation() {
  const generated = [
    {
      id: sessionIdFor("2026-09-05", "Bronze Performance", "7-8PM"),
      date: "2026-09-05",
      level: "Bronze Performance",
      weekday: 5,
      timeSlot: "7-8PM",
      location: "Mary Wayte Pool",
      source: "generated" as const,
      cancelled: false,
    },
  ];
  const existing = [{ ...generated[0], cancelled: true, cancelReason: "Pool closed" }];
  const merged = mergeRegeneratedSessions(generated, existing);
  assert(merged[0].cancelled === true, "preserves cancellation");
}

function run() {
  testBasicGeneration();
  testSchedulePeriod();
  testPreserveCancellation();
  console.log("tuition-v2 session-generator tests passed");
}

run();
