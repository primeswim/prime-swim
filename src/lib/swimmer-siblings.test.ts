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
    { swimmerId: "a", tuition: 400, trainingWeekdays: [1, 3], minDaysPerWeek: 2 },
    { swimmerId: "b", tuition: 500, trainingWeekdays: [1], minDaysPerWeek: 2 },
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

  assert(byId.a.tuition === 400, "no family discount");
  assert(byId.b.tuition === 500, "no family discount");
  assert(byId.c.tuition === 300, "no family discount even if C meets min");
  assert(byId.c.siblingDiscountApplied !== true, "discount flag not set");
}

function testNoDiscountWhenEldestBelowMinDays() {
  const rows = [
    { swimmerId: "a", tuition: 400, trainingWeekdays: [1], minDaysPerWeek: 2 },
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

  assert(byId.a.tuition === 400, "A full");
  assert(byId.b.tuition === 500, "B no discount when A below min");
  assert(byId.c.tuition === 300, "C no discount when A below min");
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
  const rows = [
    { swimmerId: "ryan", tuition: 500, trainingWeekdays: [1, 3], minDaysPerWeek: 2 },
  ];
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
  testNoDiscountWhenEldestBelowMinDays();
  testFourSiblingsAllMeetMinDays();
  testLinkedSiblingNotInRowsStillBlocksDiscount();
  testUnlinkedNoDiscount();
  console.log("swimmer-siblings tests passed");
}

run();
