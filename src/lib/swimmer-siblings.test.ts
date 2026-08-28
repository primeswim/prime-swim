import {
  applySiblingTuitionDiscounts,
  getSwimmerEnrollmentMillis,
  normalizeSiblingIds,
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

function testSiblingDiscount() {
  const rows = [
    { swimmerId: "a", tuition: 400 },
    { swimmerId: "b", tuition: 500 },
    { swimmerId: "c", tuition: 300 },
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

  assert(byId.a.tuition === 400, "earliest sibling pays full tuition");
  assert(byId.b.tuition === 450, "second sibling gets 10% off");
  assert(byId.c.tuition === 270, "third sibling gets 10% off");
  assert(byId.b.siblingDiscountApplied === true, "discount flag set");
}

function testUnlinkedNoDiscount() {
  const rows = [{ swimmerId: "a", tuition: 400 }];
  const out = applySiblingTuitionDiscounts(
    rows,
    new Map([["a", 1]]),
    new Map([["a", []]])
  );
  assert(out[0].tuition === 400, "no siblings means no discount");
}

function run() {
  testNormalizeSiblingIds();
  testEnrollmentMillis();
  testSiblingDiscount();
  testUnlinkedNoDiscount();
  console.log("swimmer-siblings tests passed");
}

run();
