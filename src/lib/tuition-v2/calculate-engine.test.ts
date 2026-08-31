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

function testUnavailableWeekdayExcludesRegularFriday() {
  const sessions = [session("2026-09-05", 5, false)];
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, {
    swimmerId: "s1",
    weekdayAvailability: { 5: "unavailable" },
  });
  assert(billable.length === 0, "unavailable Friday excludes regular Friday session");
}

function testUnavailableWeekdayExcludesExtraTrainingFriday() {
  const sessions = [session("2026-09-05", 5, true)];
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, {
    swimmerId: "s1",
    weekdayAvailability: { 5: "unavailable" },
  });
  assert(billable.length === 0, "unavailable Friday excludes extra training on Friday");
}

function testUnavailableWeekdayDoesNotBlockSwapToFriday() {
  const sessions = [session("2026-09-05", 5, true)];
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, {
    swimmerId: "s1",
    weekdayAvailability: { 5: "unavailable" },
    adjustments: [{ type: "swap_session", toSessionId: sessions[0].id }],
  });
  assert(billable.length === 1, "explicit swap/add still bills unavailable weekday");
}

function testExplicitKeysFromPlan() {
  const sessions = [session("2026-09-08", 2, false)];
  const explicit = { sessionIds: new Set([sessions[0].id]), dateLevelKeys: new Set<string>() };
  const billable = getBillableSessionsForSwimmer(enrollment(), sessions, null, explicit);
  assert(billable.length === 1, "explicit keys from level plan include session");
}

function silverSession(date: string, weekday: number, extraTraining = false): TuitionV2Session {
  return {
    id: `${date}_silver-beginner_7-8pm`,
    date,
    level: "Silver Beginner",
    weekday,
    timeSlot: "7-8PM",
    location: "Mary Wayte Pool",
    source: "generated",
    cancelled: false,
    extraTraining,
  };
}

/** Wed-only swimmer billed for Tue 9/2 when it is an explicit schedule-period date. */
function testPeriodExplicitDateOutsideRegularWeekday() {
  const sessions = [silverSession("2026-09-02", 2, false)];
  const explicit = {
    sessionIds: new Set<string>(),
    dateLevelKeys: new Set(["2026-09-02|Silver Beginner"]),
  };
  const billable = getBillableSessionsForSwimmer(
    enrollment({ level: "Silver Beginner", regularWeekdays: [3] }),
    sessions,
    null,
    explicit
  );
  assert(billable.length === 1 && billable[0].date === "2026-09-02", "period override bills non-regular weekday");
}

function testPeriodRangeBlocksRegularWeekdayWithoutExplicitDate() {
  const sessions = [silverSession("2026-09-03", 3, false)];
  const explicit = {
    sessionIds: new Set<string>(),
    dateLevelKeys: new Set(["2026-09-02|Silver Beginner"]),
  };
  const periodDates = new Map([["Silver Beginner", new Set(["2026-09-02", "2026-09-03", "2026-09-04"])]]);
  const billable = getBillableSessionsForSwimmer(
    enrollment({ level: "Silver Beginner", regularWeekdays: [3] }),
    sessions,
    null,
    explicit,
    periodDates
  );
  assert(billable.length === 0, "regular Wed inside period does not bill unless explicit date");
}

function testPeriodExplicitSkip() {
  const s2 = silverSession("2026-09-02", 2, true);
  const s4 = silverSession("2026-09-04", 4, true);
  const explicit = {
    sessionIds: new Set<string>(),
    dateLevelKeys: new Set(["2026-09-02|Silver Beginner", "2026-09-04|Silver Beginner"]),
  };
  const billable = getBillableSessionsForSwimmer(
    enrollment({ level: "Silver Beginner", regularWeekdays: [3] }),
    [s2, s4],
    { swimmerId: "s1", adjustments: [{ type: "skip_session", fromSessionId: s4.id }] },
    explicit
  );
  assert(billable.length === 1 && billable[0].date === "2026-09-02", "skip removes one period date only");
}

function run() {
  testExtraTrainingOutsideRegularWeekdays();
  testExtraTrainingSkipped();
  testRegularWeekdayStillRequiredForNormalSessions();
  testUnavailableWeekdayExcludesRegularFriday();
  testUnavailableWeekdayExcludesExtraTrainingFriday();
  testUnavailableWeekdayDoesNotBlockSwapToFriday();
  testExplicitKeysFromPlan();
  testPeriodExplicitDateOutsideRegularWeekday();
  testPeriodRangeBlocksRegularWeekdayWithoutExplicitDate();
  testPeriodExplicitSkip();
  console.log("tuition-v2 calculate-engine tests passed");
}

run();
