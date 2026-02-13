// Default level config for monthly tuition calculation.
// Stored in Firestore tuition_level_config; these are fallbacks when doc is empty.
// Each level can have different time/location per weekday (schedule).

export interface LevelScheduleSlot {
  weekday: number; // 0=Sun, 1=Mon, ..., 6=Sat
  timeSlot: string;
  location: string;
}

export interface LevelConfigItem {
  defaultRatePerHour: number;
  daysPerWeek: number;
  minDaysPerWeek: number;
  reducedRatePerHour: number | null; // when swimmer does min days (e.g. Silver Beginner 2-day = $60)
  /** Per-weekday time & location. Used when generating schedule. */
  schedule: LevelScheduleSlot[];
  /** Fallback when a weekday is not in schedule (e.g. make-up). */
  defaultTimeSlot: string;
  defaultLocation: string;
}

export type LevelConfigMap = Record<string, LevelConfigItem>;

export const DEFAULT_LEVEL_CONFIG: LevelConfigMap = {
  "Bronze Beginner": {
    defaultRatePerHour: 60,
    daysPerWeek: 2,
    minDaysPerWeek: 2,
    reducedRatePerHour: null,
    schedule: [
      { weekday: 6, timeSlot: "4-5PM", location: "Redmond Pool" },
    ],
    defaultTimeSlot: "4-5PM",
    defaultLocation: "Redmond Pool",
  },
  "Bronze Performance": {
    defaultRatePerHour: 60,
    daysPerWeek: 2,
    minDaysPerWeek: 2,
    reducedRatePerHour: null,
    schedule: [
      { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 5, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
    ],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Silver Beginner": {
    defaultRatePerHour: 50,
    daysPerWeek: 3,
    minDaysPerWeek: 2,
    reducedRatePerHour: 60,
    schedule: [
      { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 3, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 5, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
    ],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Silver Performance": {
    defaultRatePerHour: 45,
    daysPerWeek: 4,
    minDaysPerWeek: 3,
    reducedRatePerHour: null,
    schedule: [
      { weekday: 1, timeSlot: "8-9PM", location: "Mary Wayte Pool" },
      { weekday: 2, timeSlot: "8-9PM", location: "Mary Wayte Pool" },
      { weekday: 3, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 4, timeSlot: "8-9PM", location: "Mary Wayte Pool" },
    ],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Gold Beginner": {
    defaultRatePerHour: 42,
    daysPerWeek: 4,
    minDaysPerWeek: 3,
    reducedRatePerHour: null,
    schedule: [
      { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 3, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 5, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
    ],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Gold Performance": {
    defaultRatePerHour: 42,
    daysPerWeek: 4,
    minDaysPerWeek: 3,
    reducedRatePerHour: null,
    schedule: [
      { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 3, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
      { weekday: 5, timeSlot: "7-8PM", location: "Mary Wayte Pool" },
    ],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Platinum Beginner": {
    defaultRatePerHour: 42,
    daysPerWeek: 4,
    minDaysPerWeek: 3,
    reducedRatePerHour: null,
    schedule: [],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
  "Platinum Performance": {
    defaultRatePerHour: 42,
    daysPerWeek: 4,
    minDaysPerWeek: 3,
    reducedRatePerHour: null,
    schedule: [],
    defaultTimeSlot: "7-8PM",
    defaultLocation: "Mary Wayte Pool",
  },
};
