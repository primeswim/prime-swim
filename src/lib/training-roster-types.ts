export type TrainingRosterAttendee = {
  swimmerId: string;
  swimmerName: string;
};

export type TrainingRosterLevelGroup = {
  level: string;
  count: number;
  attendees: TrainingRosterAttendee[];
};

/** One pool time block: date + time + location, with all levels that train then. */
export type TrainingRosterSlot = {
  date: string;
  weekday: number;
  weekdayLabel: string;
  timeSlot: string;
  location: string;
  levels: TrainingRosterLevelGroup[];
  totalCount: number;
};

export type TrainingRosterDoc = {
  month: string;
  generatedAt: string;
  generatedBy: string;
  sessionCount: number;
  slotCount: number;
  uniqueSwimmerCount: number;
  slots: TrainingRosterSlot[];
};

export const TRAINING_ROSTERS_COLLECTION = "training_rosters";

/** Drop levels (and time slots) that nobody attends. */
export function omitEmptyRosterLevels(slots: TrainingRosterSlot[]): TrainingRosterSlot[] {
  return slots
    .map((slot) => {
      const levels = (slot.levels ?? []).filter((l) => l.count > 0);
      return {
        ...slot,
        levels,
        totalCount: levels.reduce((sum, l) => sum + l.count, 0),
      };
    })
    .filter((slot) => slot.levels.length > 0);
}
