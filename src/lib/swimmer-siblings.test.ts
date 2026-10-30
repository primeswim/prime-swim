import {
  applySiblingTuitionDiscounts,
  getSwimmerEnrollmentMillis,
  normalizeSiblingIds,
  swimmerMeetsMinDaysPerWeek,
} from "./swimmer-siblings";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function testNormalizeSiblingIds() {
  assert(
    JSON.stringify(normalizeSiblingIds(["b", "a", "b", "self"], "self")) ===
      JSON.stringify(["a", "b"]),
    "normalizeSiblingIds dedupes and removes self"
  );
}

function testEnrollmentMillis() {
  const earlier = getSwimmerEnrollmentMillis({
    registrationAnchorDate: new Date("2024-01-01"),
    createdAt: new Date("2025-01-01"),
  });
  const later = getSwimmerEnrollmentMillis({
    createdAt: new Date("2025-06-01"),
  });
  assert(earlier < later, "registrationAnchorDate wins over createdAt");
}

function testSiblingDiscountWhenAllMeetMinDays() {
  const rows = [
    { swimmerId: "a", tuition: 400, trainingWeekdays: [1, 3], minDaysPerWeek: 2 },
    { swimmerId: "b", tuition: 500, trainingWeekdays: [1, 3], minDaysPerWeek: 2 },
    { swimmerId: "c", tuition: 300, trainingWeekdays: [1, 3], minDaysPerWeek: 2 },
  ];
  const enrollment = new Map<string, number>([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  const siblings = new Map<string, string[]>([
    ["a", ["b", "c"]],
    ["b", ["a", "c"]],
    ["c", ["a", "b"]],
  ]);

  const out = applySiblingTuitionDiscounts(rows, enrollment, siblings);
  const byId = Object.fromEntries(out.map((r) => [r.swimmerId, r]));

  assert(byId.a.tuition === 400, "eldest pays full");
  assert(byId.b.tuition === 450, "younger sibling 10% off");
  assert(byId.c.tuition === 270, "younger sibling 10% off");
  assert(byId.b.siblingDiscountPercent === 10, "flat 10%");
}

function testNoDiscountWhenAnyBelowMinDays() {
  const rows = [
    { swimmerId: "korman", tuition: 588, trainingWeekdays: [1, 4, 5], minDaysPerWeek: 3 },
    { swimmerId: "everly", tuition: 378, trainingWeekdays: [1, 5], minDaysPerWeek: 3 },
  ];
  const enrollment = new Map<string, number>([
    ["korman", 1],
    ["everly", 2],
  ]);
  const siblings = new Map<string, string[]>([
    ["korman", ["everly"]],
    ["everly", ["korman"]],
  ]);

  const out = applySiblingTuitionDiscounts(rows, enrollment, siblings);
  const byId = Object.fromEntries(out.map((r) => [r.swimmerId, r]));

  assert(byId.korman.tuition === 588, "no family discount when younger below min");
  assert(byId.everly.tuition === 378, "no 10% when below level min days");
  assert(byId.everly.siblingDiscountApplied !== true, "discount flag not set");
}

function testFourSiblingsAllMeetMinDays() {
  const rows = [
    { swimmerId: "a", tuition: 400, trainingWeekdays: [1, 3, 5], minDaysPerWeek: 3 },
    { swimmerId: "b", tuition: 500, trainingWeekdays: [1, 3, 5], minDaysPerWeek: 3 },
    { swimmerId: "c", tuition: 300, trainingWeekdays: [2, 4], minDaysPerWeek: 2 },
    { swimmerId: "d", tuition: 200, trainingWeekdays: [1, 2], minDaysPerWeek: 2 },
  ];
  const enrollment = new Map<string, number>([
    ["a", 1],
    ["b", 2],
    ["c", 3],
    ["d", 4],
  ]);
  const siblings = new Map<string, string[]>([
    ["a", ["b", "c", "d"]],
    ["b", ["a", "c", "d"]],
    ["c", ["a", "b", "d"]],
    ["d", ["a", "b", "c"]],
  ]);

  const out = applySiblingTuitionDiscounts(rows, enrollment, siblings);
  const byId = Object.fromEntries(out.map((r) => [r.swimmerId, r]));

  assert(byId.a.tuition === 400, "first full");
  assert(byId.b.tuition === 450, "10%");
  assert(byId.c.tuition === 270, "10%");
  assert(byId.d.tuition === 180, "10%");
}

function testUnlinkedNoDiscount() {
  const rows = [{ swimmerId: "a", tuition: 400, trainingWeekdays: [1], minDaysPerWeek: 2 }];
  const out = applySiblingTuitionDiscounts(
    rows,
    new Map([["a", 1]]),
    new Map([["a", []]])
  );
  assert(out[0].tuition === 400, "no siblings means no discount");
}

function testMeetsMinDaysHelper() {
  assert(swimmerMeetsMinDaysPerWeek([1, 3], 2) === true, ">= min days");
  assert(swimmerMeetsMinDaysPerWeek([1], 2) === false, "< min days");
  assert(swimmerMeetsMinDaysPerWeek([1], 0) === true, "zero min always ok");
}

function testLinkedSiblingNotInRowsStillBlocksDiscount() {
  const rows = [{ swimmerId: "ryan", tuition: 500, trainingWeekdays: [1, 3], minDaysPerWeek: 2 }];
  const enrollment = new Map<string, number>([
    ["ryan", 2],
    ["nathan", 1],
  ]);
  const siblings = new Map<string, string[]>([
    ["ryan", ["nathan"]],
    ["nathan", ["ryan"]],
  ]);
  const eligibility = new Map([
    ["ryan", { trainingWeekdays: [1, 3], minDaysPerWeek: 2 }],
    ["nathan", { trainingWeekdays: [1], minDaysPerWeek: 2 }],
  ]);

  const out = applySiblingTuitionDiscounts(rows, enrollment, siblings, eligibility);
  assert(out[0].tuition === 500, "no discount when linked sibling below min days");
  assert(out[0].siblingDiscountApplied !== true, "flag not set");
}

function run() {
  testNormalizeSiblingIds();
  testEnrollmentMillis();
  testMeetsMinDaysHelper();
  testSiblingDiscountWhenAllMeetMinDays();
  testNoDiscountWhenAnyBelowMinDays();
  testFourSiblingsAllMeetMinDays();
  testLinkedSiblingNotInRowsStillBlocksDiscount();
  testUnlinkedNoDiscount();
  console.log("swimmer-siblings tests passed");
}

run();

// The lower monthly tuition receives the discount regardless of enrollment order.
for (const prices of [[800, 180], [180, 800]]) {
  const rows = prices.map((tuition, i) => ({ swimmerId: String(i), tuition, trainingWeekdays: [1, 5], minDaysPerWeek: 2 }));
  const out = applySiblingTuitionDiscounts(rows, new Map([["0", 1], ["1", 2]]), new Map([["0", ["1"]]]));
  assert(out.find(r => r.baseTuition === 800)?.tuition === 800, "higher price remains full regardless of registration order");
  assert(out.find(r => r.baseTuition === 180)?.tuition === 162, "lower price receives 10%");
  const reversed = applySiblingTuitionDiscounts([...rows].reverse(), new Map([["0", 1], ["1", 2]]), new Map([["1", ["0"]]]));
  assert(reversed.find(r => r.baseTuition === 180)?.tuition === 162, "row and link direction do not change discount");
}
const equalPrice = applySiblingTuitionDiscounts([
  { swimmerId: "earlier", tuition: 480, trainingWeekdays: [1, 5], minDaysPerWeek: 2 },
  { swimmerId: "later", tuition: 480, trainingWeekdays: [1, 5], minDaysPerWeek: 2 },
], new Map([["earlier", 1], ["later", 2]]), new Map([["earlier", ["later"]]]));
assert(equalPrice[0].tuition === 480 && equalPrice[1].tuition === 432, "equal price keeps enrollment ordering");
