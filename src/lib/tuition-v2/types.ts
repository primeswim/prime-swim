export type TuitionV2MonthStatus =
  | "planning"
  | "computed"
  | "approved"
  | "sent"
  | "closed";

export type TuitionV2WeeklySlot = {
  weekday: number; // 0=Sun … 6=Sat
  timeSlot: string;
  location: string;
};

/** A specific training day within a schedule period. */
export type TuitionV2TrainingDate = {
  date: string; // YYYY-MM-DD
  timeSlot: string;
  location: string;
};

/**
 * Date range where default weekly schedule is fully replaced.
 * Only explicit trainingDates within the range generate sessions.
 */
export type TuitionV2SchedulePeriod = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  trainingDates: TuitionV2TrainingDate[];
};

/** @deprecated Migrated to schedulePeriods */
export type TuitionV2DateOverride = TuitionV2TrainingDate;

/** @deprecated Legacy period ranges — migrated to schedulePeriods on load */
export type TuitionV2EffectiveRange = {
  startDate: string;
  endDate: string;
  weeklySlots: TuitionV2WeeklySlot[];
};

export type TuitionV2LevelTemplate = {
  defaultRatePerHour: number;
  minDaysPerWeek: number;
  reducedRatePerHour: number | null;
  weeklySlots: TuitionV2WeeklySlot[];
  defaultTimeSlot: string;
  defaultLocation: string;
};

export type TuitionV2LevelTemplateMap = Record<string, TuitionV2LevelTemplate>;

export type TuitionV2LevelPlan = {
  level: string;
  weeklySlots: TuitionV2WeeklySlot[];
  schedulePeriods?: TuitionV2SchedulePeriod[];
  /** @deprecated */
  dateOverrides?: TuitionV2TrainingDate[];
  /** @deprecated */
  effectiveRanges?: TuitionV2EffectiveRange[];
  notes?: string;
  updatedAt?: string;
};

export type TuitionV2SessionSource = "generated" | "manual";

export type TuitionV2Session = {
  id: string;
  date: string; // YYYY-MM-DD
  level: string;
  weekday: number;
  timeSlot: string;
  location: string;
  source: TuitionV2SessionSource;
  cancelled: boolean;
  cancelReason?: string;
  /** Explicit training date from a schedule period — bill all swimmers at level unless skip. */
  extraTraining?: boolean;
};

export type TuitionV2SwimmerAdjustment = {
  type: "skip_session" | "swap_session" | "add_session";
  fromSessionId?: string;
  toSessionId?: string;
  note?: string;
};

export type TuitionV2SwimmerResponse = {
  swimmerId: string;
  weekdayAvailability?: Record<number, "available" | "unavailable">;
  adjustments?: TuitionV2SwimmerAdjustment[];
  updatedAt?: string;
  updatedBy?: string;
};

export type TuitionV2SwimmerEnrollment = {
  swimmerId: string;
  swimmerName: string;
  level: string;
  parentName: string;
  parentEmail: string;
  regularWeekdays: number[];
  unavailableWeekdays?: number[];
  ratePerHourOverride?: number | null;
  siblingIds?: string[];
  /** For sibling discount eldest ordering (stored in V2 only) */
  enrollmentMillis?: number;
  /** When false, excluded from V2 tuition calculate */
  active?: boolean;
  updatedAt?: string;
};

export type TuitionV2RateTier = "normal" | "reduced" | "override";

export type TuitionV2InvoiceLineItem = {
  date: string;
  timeSlot: string;
  location: string;
  amount: number;
};

export type TuitionV2Invoice = {
  swimmerId: string;
  swimmerName: string;
  level: string;
  parentName: string;
  parentEmail: string;
  regularWeekdays: number[];
  ratePerHour: number;
  rateTier: TuitionV2RateTier;
  rateTierReason: string;
  billableSessionCount: number;
  amount: number;
  baseAmount: number;
  practiceText: string;
  lineItems: TuitionV2InvoiceLineItem[];
  siblingDiscountApplied?: boolean;
  siblingDiscountPercent?: number;
  manualOverride?: { amount: number; reason: string } | null;
  dueDate: string;
  months: string[];
  afterFeeNote: string;
  paid: boolean;
  paidOn: string | null;
  emailStatus: "pending" | "sent" | "failed";
  lastSentAt?: string;
  lastEmailKind?: string;
  firstInvoiceSentAt?: string;
  updatedAt?: string;
};

export type TuitionV2MonthDoc = {
  month: string;
  status: TuitionV2MonthStatus;
  noTrainingDates: string[];
  lastSessionsGeneratedAt?: string;
  lastCalculatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};
