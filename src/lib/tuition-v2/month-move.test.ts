/**
 * A group or training-day change takes effect next month.
 * The current month keeps its level, days, price, and calendar.
 * Run: npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"commonjs"}' src/lib/tuition-v2/month-move.test.ts
 */
import {
  buildLineItems,
  getBillableSessionsForSwimmer,
  getMonthlyRate,
  practiceTextFromLineItems,
  toSiblingDiscountRows,
} from "./calculate-engine";
import {
  enrollmentForMonth,
  parseEnrollmentDoc,
  shouldPinCurrentMonthLevel,
  weekdaysByMonthAfterChange,
} from "./enrollment-service";
import { pickParentTuitionForSwimmer, toParentTuitionView } from "./parent-tuition";
import { resolveSessionsForMonth, schedulePeriodCoverage } from "./session-generator";
import type {
  TuitionV2Invoice,
  TuitionV2LevelPlan,
  TuitionV2LevelTemplate,
  TuitionV2Session,
  TuitionV2SwimmerEnrollment,
} from "./types";
import { applySiblingTuitionDiscounts } from "../swimmer-siblings";
import { countsOnMonthRoster } from "../training-roster";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const CURRENT = "2026-09";
const NEXT = "2026-10";

function enrollment(
  overrides: Partial<TuitionV2SwimmerEnrollment> & Pick<TuitionV2SwimmerEnrollment, "swimmerId" | "level">
): TuitionV2SwimmerEnrollment {
  return {
    swimmerName: overrides.swimmerId,
    parentName: "",
    parentEmail: "",
    regularWeekdays: [2],
    active: true,
    ...overrides,
  };
}

function template(minDays: number): TuitionV2LevelTemplate {
  return {
    defaultRatePerHour: 60,
    minDaysPerWeek: minDays,
    reducedRatePerHour: 54,
    weeklySlots: [],
    defaultTimeSlot: "",
    defaultLocation: "",
  };
}

const plans: TuitionV2LevelPlan[] = [
  {
    level: "Bronze Beginner",
    weeklySlots: [{ weekday: 6, timeSlot: "4-5PM", location: "Redmond Pool" }],
  },
  {
    level: "Bronze Performance",
    weeklySlots: [{ weekday: 5, timeSlot: "5-6PM", location: "Mary Wayte Pool" }],
  },
  {
    level: "Silver Beginner",
    weeklySlots: [{ weekday: 2, timeSlot: "5-6PM", location: "Mary Wayte Pool" }],
  },
];

function sessionsFor(month: string, closures: { date: string; location?: string; timeSlot?: string }[] = []) {
  return resolveSessionsForMonth(month, plans, [], closures);
}

function billableFor(month: string, monthEnrollment: TuitionV2SwimmerEnrollment, sessions: TuitionV2Session[]) {
  const coverage = schedulePeriodCoverage(plans, month);
  return getBillableSessionsForSwimmer(
    monthEnrollment,
    sessions,
    null,
    coverage.explicit,
    coverage.periodDatesByLevel
  );
}

function priceFor(month: string, monthEnrollment: TuitionV2SwimmerEnrollment, sessions: TuitionV2Session[]) {
  const rows = billableFor(month, monthEnrollment, sessions);
  const rate = getMonthlyRate(monthEnrollment, template(2));
  const lineItems = buildLineItems(rows, rate.ratePerHour);
  return {
    sessions: rows,
    ratePerHour: rate.ratePerHour,
    amount: lineItems.reduce((sum, item) => sum + item.amount, 0),
    practiceText: practiceTextFromLineItems(lineItems),
  };
}

function calendarHits(
  month: string,
  people: TuitionV2SwimmerEnrollment[],
  sessions: TuitionV2Session[]
) {
  const hits: { swimmerId: string; date: string; level: string; weekday: number }[] = [];
  for (const raw of people) {
    const monthEnrollment = enrollmentForMonth(raw, month);
    if (!countsOnMonthRoster(monthEnrollment)) continue;
    for (const session of billableFor(month, monthEnrollment, sessions)) {
      hits.push({
        swimmerId: monthEnrollment.swimmerId,
        date: session.date,
        level: session.level,
        weekday: session.weekday,
      });
    }
  }
  return hits;
}

function testPinsKeepStartedMonth() {
  assert(shouldPinCurrentMonthLevel("Bronze Beginner", "Bronze Performance", undefined) === true, "pin on move");
  assert(shouldPinCurrentMonthLevel("Bronze Beginner", "Bronze Beginner", undefined) === false, "same level");
  assert(
    shouldPinCurrentMonthLevel("Bronze Beginner", "Bronze Performance", "Bronze Beginner") === false,
    "do not overwrite an existing month pin"
  );

  const started = enrollment({
    swimmerId: "miranda",
    swimmerName: "Miranda",
    level: "Bronze Beginner",
    regularWeekdays: [6],
  });
  const afterFriday = weekdaysByMonthAfterChange(started, [5], CURRENT);
  assert(JSON.stringify(afterFriday[CURRENT]) === "[6]", "September keeps Saturday");
  const afterSecondChange = weekdaysByMonthAfterChange(
    { regularWeekdays: [5], weekdaysByMonth: afterFriday },
    [1],
    CURRENT
  );
  assert(JSON.stringify(afterSecondChange[CURRENT]) === "[6]", "a second change does not replace September");

  const moved = enrollment({
    swimmerId: "miranda",
    swimmerName: "Miranda",
    level: "Bronze Performance",
    regularWeekdays: [1],
    levelByMonth: { [CURRENT]: "Bronze Beginner" },
    weekdaysByMonth: afterSecondChange,
  });
  const september = enrollmentForMonth(moved, CURRENT);
  const october = enrollmentForMonth(moved, NEXT);
  assert(september.level === "Bronze Beginner" && JSON.stringify(september.regularWeekdays) === "[6]", "Sep plan");
  assert(october.level === "Bronze Performance" && JSON.stringify(october.regularWeekdays) === "[1]", "Oct plan");
  assert(moved.level === "Bronze Performance" && JSON.stringify(moved.regularWeekdays) === "[1]", "live enrollment unchanged");
}

function testCurrentMonthPriceAndCalendarStay() {
  const moved = enrollment({
    swimmerId: "miranda",
    swimmerName: "Miranda",
    level: "Bronze Performance",
    regularWeekdays: [5],
    levelByMonth: { [CURRENT]: "Bronze Beginner" },
    weekdaysByMonth: { [CURRENT]: [6] },
  });
  const steady = enrollment({
    swimmerId: "alice",
    swimmerName: "Alice",
    level: "Silver Beginner",
    regularWeekdays: [2],
  });
  const inactive = enrollment({
    swimmerId: "bob",
    swimmerName: "Bob",
    level: "Silver Beginner",
    regularWeekdays: [2],
    active: false,
  });

  const sepSessions = sessionsFor(CURRENT);
  const octSessions = sessionsFor(NEXT, [
    { date: "2026-10-30", location: "Mary Wayte Pool", timeSlot: "5-6PM" },
  ]);

  const sep = priceFor(CURRENT, enrollmentForMonth(moved, CURRENT), sepSessions);
  const oct = priceFor(NEXT, enrollmentForMonth(moved, NEXT), octSessions);
  assert(sep.sessions.every((s) => s.weekday === 6 && s.level === "Bronze Beginner"), "Sep stays Saturday beginner");
  assert(sep.sessions.map((s) => s.date).join(",") === "2026-09-05,2026-09-12,2026-09-19,2026-09-26", "Sep dates");
  assert(sep.ratePerHour === 60 && sep.amount === 240, "Sep price uses the old one-day plan");
  assert(sep.practiceText.includes("09/05 4-5PM Redmond Pool"), "Sep practice text");
  assert(!sep.practiceText.includes("Mary Wayte"), "Sep text is not the new pool");

  assert(oct.sessions.every((s) => s.weekday === 5 && s.level === "Bronze Performance"), "Oct is Friday performance");
  assert(oct.sessions.map((s) => s.date).join(",") === "2026-10-02,2026-10-09,2026-10-16,2026-10-23", "Oct 30 closure drops only that session");
  assert(oct.amount === 240, "Oct price follows the new plan");
  assert(oct.practiceText.includes("10/02 5-6PM Mary Wayte Pool"), "Oct practice text");
  assert(!oct.practiceText.includes("Redmond"), "Oct text is not the old pool");

  const aliceSep = priceFor(CURRENT, enrollmentForMonth(steady, CURRENT), sepSessions);
  const aliceOct = priceFor(NEXT, enrollmentForMonth(steady, NEXT), octSessions);
  assert(aliceSep.sessions.every((s) => s.level === "Silver Beginner" && s.weekday === 2), "unchanged swimmer stays Tuesday");
  assert(aliceOct.sessions.every((s) => s.level === "Silver Beginner" && s.weekday === 2), "unchanged swimmer stays Tuesday next month");
  assert(aliceSep.ratePerHour === aliceOct.ratePerHour, "unchanged swimmer rate is stable");
  assert(aliceSep.sessions.length > 0 && aliceOct.sessions.length > 0, "unchanged swimmer still has sessions");

  const sepCalendar = calendarHits(CURRENT, [moved, steady, inactive], sepSessions);
  const octCalendar = calendarHits(NEXT, [moved, steady, inactive], octSessions);
  const sepMiranda = sepCalendar.filter((hit) => hit.swimmerId === "miranda");
  const octMiranda = octCalendar.filter((hit) => hit.swimmerId === "miranda");
  assert(sepMiranda.length === 4 && sepMiranda.every((hit) => hit.level === "Bronze Beginner" && hit.weekday === 6), "Sep calendar");
  assert(octMiranda.length === 4 && octMiranda.every((hit) => hit.level === "Bronze Performance" && hit.weekday === 5), "Oct calendar");
  assert(sepCalendar.some((hit) => hit.swimmerId === "alice"), "other swimmer remains on Sep calendar");
  assert(octCalendar.some((hit) => hit.swimmerId === "alice"), "other swimmer remains on Oct calendar");
  assert(!sepCalendar.some((hit) => hit.swimmerId === "bob") && !octCalendar.some((hit) => hit.swimmerId === "bob"), "inactive is off the calendar");
}

function testInactiveAndNotSetStayOffRoster() {
  assert(countsOnMonthRoster(enrollment({ swimmerId: "a", level: "Silver Beginner", active: false })) === false, "inactive");
  assert(countsOnMonthRoster(enrollment({ swimmerId: "a", level: "Silver Beginner" })) === true, "active assigned");
  assert(countsOnMonthRoster(enrollment({ swimmerId: "a", level: "Not set" })) === false, "Not set label");
  const cleared = parseEnrollmentDoc("everly", {
    swimmerName: "Everly",
    level: "",
    active: false,
    regularWeekdays: [6],
    levelByMonth: { [CURRENT]: "Platinum Performance" },
  });
  assert(cleared === null, "cleared level is not enrolled");
}

function testSiblingPriceUsesTheMonthPlan() {
  const older = enrollment({
    swimmerId: "older",
    level: "Bronze Performance",
    regularWeekdays: [5],
    weekdaysByMonth: { [CURRENT]: [1, 3] },
    siblingIds: ["younger"],
    enrollmentMillis: 1,
  });
  const younger = enrollment({
    swimmerId: "younger",
    level: "Bronze Beginner",
    regularWeekdays: [1, 3],
    siblingIds: ["older"],
    enrollmentMillis: 2,
  });
  const minDays = new Map([
    ["Bronze Performance", 2],
    ["Bronze Beginner", 2],
  ]);

  function discount(month: string) {
    const monthPeople = [older, younger].map((person) => enrollmentForMonth(person, month));
    const tuition = new Map(monthPeople.map((person) => [person.swimmerId, 240]));
    const rows = toSiblingDiscountRows(monthPeople, tuition, minDays);
    return applySiblingTuitionDiscounts(rows, new Map(monthPeople.map((p) => [p.swimmerId, p.enrollmentMillis ?? 0])), new Map(monthPeople.map((p) => [p.swimmerId, p.siblingIds ?? []])));
  }

  const september = discount(CURRENT);
  const october = discount(NEXT);
  const sepYounger = september.find((row) => row.swimmerId === "younger");
  const octYounger = october.find((row) => row.swimmerId === "younger");
  assert(sepYounger?.siblingDiscountApplied === true && sepYounger.tuition === 216, "Sep still meets min days");
  assert(octYounger?.siblingDiscountApplied !== true && octYounger?.tuition === 240, "Oct uses the new one-day plan");
}

function testAppKeepsPublishedCurrentMonthPlan() {
  const now = new Date(2026, 8, 25);
  const september = {
    month: CURRENT,
    monthStatus: "sent",
    invoice: {
      swimmerId: "miranda",
      swimmerName: "Miranda",
      level: "Bronze Beginner",
      parentName: "",
      parentEmail: "",
      regularWeekdays: [6],
      ratePerHour: 60,
      rateTier: "normal" as const,
      rateTierReason: "",
      billableSessionCount: 3,
      amount: 180,
      baseAmount: 180,
      practiceText: "09/05 4-5PM Redmond Pool\n09/12 4-5PM Redmond Pool\n09/19 4-5PM Redmond Pool",
      lineItems: [],
      dueDate: "2026-09-01",
      months: ["September 2026"],
      afterFeeNote: "",
      paid: false,
      paidOn: null,
      emailStatus: "sent" as const,
      publishedToApp: true,
    } satisfies TuitionV2Invoice,
  };
  const october = {
    month: NEXT,
    monthStatus: "computed",
    invoice: {
      ...september.invoice,
      level: "Bronze Performance",
      regularWeekdays: [5],
      billableSessionCount: 4,
      amount: 240,
      baseAmount: 240,
      practiceText: "10/02 5-6PM Mary Wayte Pool",
      publishedToApp: false,
    } satisfies TuitionV2Invoice,
  };
  const picked = pickParentTuitionForSwimmer(
    [
      { month: "2026-08", monthStatus: "sent", invoice: null },
      september,
      october,
    ],
    now
  );
  const view = toParentTuitionView(picked.month, picked.monthStatus, picked.invoice);
  assert(picked.month === CURRENT, "app stays on the published current month");
  assert(view.amount === 180, "app price is the September amount");
  assert(view.practiceText === september.invoice.practiceText, "app training plan is the September plan");
  assert(!view.practiceText?.includes("Mary Wayte"), "app does not show the October plan yet");
}

function run() {
  testPinsKeepStartedMonth();
  testCurrentMonthPriceAndCalendarStay();
  testInactiveAndNotSetStayOffRoster();
  testSiblingPriceUsesTheMonthPlan();
  testAppKeepsPublishedCurrentMonthPlan();
  console.log("month-move tests passed");
}

run();
