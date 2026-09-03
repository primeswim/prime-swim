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
