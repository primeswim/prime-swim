import {
  applyTuitionOverridesMap,
  shouldApplyTuitionOverride,
} from "./tuition-month-overrides";
import type { TuitionCalculateRow } from "./tuition-calculate";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const baseRow = (overrides: Partial<TuitionCalculateRow>): TuitionCalculateRow => ({
  swimmerId: "ryan",
  swimmerName: "Ryan Kuo",
  level: "Bronze Performance",
  parentName: "",
  parentEmail: "",
  trainingWeekdays: [1],
  sessionCount: 4,
  ratePerHour: 60,
  tuition: 240,
  scheduleLines: [],
  timeSlot: "",
  location: "",
  ...overrides,
});

function testStaleSiblingOverrideIgnored() {
  const calculated = [baseRow({ tuition: 240 })];
  const merged = applyTuitionOverridesMap(calculated, {
    ryan: {
      tuition: 216,
      baseTuition: 240,
      siblingDiscountApplied: true,
      siblingDiscountPercent: 10,
    },
  });
  assert(merged[0].tuition === 240, "stale sibling override ignored");
  assert(merged[0].siblingDiscountApplied !== true, "no sibling flag from override");
}

function testManualOverrideApplied() {
  const calculated = [baseRow({ tuition: 240 })];
  const merged = applyTuitionOverridesMap(calculated, {
    ryan: { tuition: 200, manual: true },
  });
  assert(merged[0].tuition === 200, "manual override applied");
}

function testShouldApplyHelper() {
  const row = baseRow({ tuition: 240 });
  assert(
    shouldApplyTuitionOverride(row, {
      tuition: 216,
      siblingDiscountApplied: true,
    }) === false,
    "stale sibling snapshot"
  );
  assert(
    shouldApplyTuitionOverride(row, { tuition: 200, manual: true }) === true,
    "manual edit"
  );
}

function run() {
  testStaleSiblingOverrideIgnored();
  testManualOverrideApplied();
  testShouldApplyHelper();
  console.log("tuition-month-overrides tests passed");
}

run();
