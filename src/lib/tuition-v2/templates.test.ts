import { templateSaveMaySyncMonth } from "./shared-ui";
import { mergeV2Templates, coalesceSavedLevelPlans, levelPlanFromTemplate, mergeTemplateWeeklySlotsIntoPlan } from "./templates";
import type { TuitionV2LevelPlan, TuitionV2LevelTemplate, TuitionV2LevelTemplateMap } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const template: TuitionV2LevelTemplate = {
  defaultRatePerHour: 50,
  minDaysPerWeek: 2,
  reducedRatePerHour: 60,
  weeklySlots: [
    { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
    { weekday: 3, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
  ],
  defaultTimeSlot: "7-8PM",
  defaultLocation: "Mary Wayte Pool",
};

function testMergeKeepsSchedulePeriods() {
  const existing: TuitionV2LevelPlan = {
    level: "Silver Beginner",
    weeklySlots: [{ weekday: 5, timeSlot: "old", location: "old pool" }],
    schedulePeriods: [
      {
        startDate: "2026-09-01",
        endDate: "2026-09-14",
        trainingDates: [{ date: "2026-09-05", timeSlot: "7-8PM", location: "Mary Wayte Pool" }],
      },
    ],
    notes: "keep me",
  };
  const merged = mergeTemplateWeeklySlotsIntoPlan(existing, "Silver Beginner", template);
  assert(merged.weeklySlots.length === 2, "weekly slots replaced from template");
  assert(merged.weeklySlots[0].weekday === 1, "template slot applied");
  assert((merged.schedulePeriods?.length ?? 0) === 1, "schedule periods preserved");
  assert(merged.schedulePeriods![0].trainingDates[0].date === "2026-09-05", "training date kept");
  assert(merged.notes === "keep me", "notes preserved");
}

function testMergeCreatesNewPlan() {
  const merged = mergeTemplateWeeklySlotsIntoPlan(null, "Silver Beginner", template);
  assert(merged.weeklySlots.length === 2, "new plan gets template slots");
  assert((merged.schedulePeriods?.length ?? 0) === 0, "new plan has no periods");
}

function testSavedMonthIgnoresNewerTemplates() {
  const saved = new Map<string, TuitionV2LevelPlan>([
    [
      "Silver Beginner",
      {
        level: "Silver Beginner",
        weeklySlots: [{ weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" }],
      },
    ],
  ]);
  const newer: TuitionV2LevelTemplateMap = {
    "Silver Beginner": {
      ...template,
      weeklySlots: [{ weekday: 1, timeSlot: "6:30-7:30PM", location: "Mary Wayte Pool" }],
    },
    "Bronze Performance": {
      ...template,
      weeklySlots: [{ weekday: 1, timeSlot: "6:30-7:30PM", location: "Mary Wayte Pool" }],
    },
  };
  const plans = coalesceSavedLevelPlans(saved, newer);
  assert(plans.length === 1, "do not invent missing levels from newer templates");
  assert(plans[0].weeklySlots[0].timeSlot === "7-8PM", "saved month keeps old Monday");
}

function testTemplateSaveSkipsCurrentMonth() {
  const now = new Date(2026, 8, 24);
  assert(templateSaveMaySyncMonth("2026-09", now) === false, "do not sync September in September");
  assert(templateSaveMaySyncMonth("2026-10", now) === true, "October is upcoming");
  assert(templateSaveMaySyncMonth("2026-08", now) === false, "do not sync past August");
}

function testEmptyMonthPreviewsTemplates() {
  const newer: TuitionV2LevelTemplateMap = {
    "Silver Beginner": {
      ...template,
      weeklySlots: [{ weekday: 1, timeSlot: "6:30-7:30PM", location: "Mary Wayte Pool" }],
    },
  };
  const plans = coalesceSavedLevelPlans(new Map(), newer);
  assert(plans.some((p) => p.weeklySlots[0]?.timeSlot === "6:30-7:30PM"), "empty month can preview templates");
  assert(levelPlanFromTemplate("Silver Beginner", newer["Silver Beginner"]).level === "Silver Beginner", "helper");
}

function run() {
  testMergeKeepsSchedulePeriods();
  testMergeCreatesNewPlan();
  testSavedMonthIgnoresNewerTemplates();
  testTemplateSaveSkipsCurrentMonth();
  testEmptyMonthPreviewsTemplates();
  console.log("tuition-v2 templates tests passed");
}

run();

// Saved pricing thresholds must not override the independent sibling policy.
const splitThresholds = mergeV2Templates({
  "Silver Beginner": { minDaysPerWeek: 3, defaultRatePerHour: 60, reducedRatePerHour: 50 },
  "Gold Beginner": { minDaysPerWeek: 2 },
});
assert(splitThresholds["Silver Beginner"].minDaysPerWeek === 3, "keep saved reduced-rate threshold");
assert(splitThresholds["Silver Beginner"].minDaysToQualifySibling === 2, "legacy Silver Beginner gets two-day sibling threshold");
assert(splitThresholds["Gold Beginner"].minDaysToQualifySibling === 2, "other levels keep saved eligibility");
assert(mergeV2Templates({ "Silver Beginner": { minDaysToQualifySibling: 1 } })["Silver Beginner"].minDaysToQualifySibling === 1, "explicit sibling threshold persists");
assert(mergeV2Templates(splitThresholds)["Silver Beginner"].minDaysToQualifySibling === 2, "sibling threshold survives save/load");
