import { mergeTemplateWeeklySlotsIntoPlan } from "./templates";
import type { TuitionV2LevelPlan, TuitionV2LevelTemplate } from "./types";

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

function run() {
  testMergeKeepsSchedulePeriods();
  testMergeCreatesNewPlan();
  console.log("tuition-v2 templates tests passed");
}

run();
