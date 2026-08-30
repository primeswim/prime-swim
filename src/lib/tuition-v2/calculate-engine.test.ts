import { getBillableSessionsForSwimmer } from "./calculate-engine";
import type { TuitionV2Session, TuitionV2SwimmerEnrollment } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function enrollment(overrides: Partial<TuitionV2SwimmerEnrollment> = {}): TuitionV2SwimmerEnrollment {
  return {
    swimmerId: "s1",
    swimmerName: "Test Swimmer",
    level: "Bronze Performance",
    parentName: "Parent",
    parentEmail: "p@test.com",
    regularWeekdays: [1, 5],
    ...overrides,
  };
}

function session(date: string, weekday: number, extraTraining = false): TuitionV2Session {
  return {
    id: `${date}_bronze-performance_7-8pm`,
    date,
    level: "Bronze Performance",
    weekday,
    timeSlot: "7-8PM",
    location: "Mary Wayte Pool",
    source: "generated",
    cancelled: false,
    extraTraining,
  };
}

function testExtraTrainingOutsideRegularWeekdays() {
  const sessions = [session("2026-09-08", 2, true)];
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, null);
  assert(billable.length === 1, "extra training billed even without Tuesday in regular plan");
  assert(billable[0].date === "2026-09-08", "correct session");
}

function testExtraTrainingSkipped() {
  const sessions = [session("2026-09-08", 2, true)];
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, {
    swimmerId: "s1",
    adjustments: [{ type: "skip_session", fromSessionId: sessions[0].id }],
  });
  assert(billable.length === 0, "skip removes extra training");
}

function testRegularWeekdayStillRequiredForNormalSessions() {
  const sessions = [session("2026-09-05", 5, false)];
  const billable = getBillableSessionsForSwimmer(enrollment({ regularWeekdays: [1] }), sessions, null);
  assert(billable.length === 0, "Friday session not billed when only Monday is regular");
}

function testExplicitKeysFromPlan() {
  const sessions = [session("2026-09-08", 2, false)];
  const keys = new Set([sessions[0].id]);
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, null, keys);
  assert(billable.length === 1, "explicit keys from level plan include session");
}

function run() {
  testExtraTrainingOutsideRegularWeekdays();
  testExtraTrainingSkipped();
  testRegularWeekdayStillRequiredForNormalSessions();
  testExplicitKeysFromPlan();
  console.log("tuition-v2 calculate-engine tests passed");
}

run();
