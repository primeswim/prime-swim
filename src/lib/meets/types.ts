export const MEET_STATUSES = [
  "draft",
  "admin_review",
  "invitation_pending",
  "ready_to_publish",
  "commitment_open",
  "commitment_closed",
  "submitted",
  "host_reply_received",
  "entries_confirmed",
  "upcoming",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MeetStatus = (typeof MEET_STATUSES)[number];

export type InvitationStatus =
  | "not_required"
  | "not_requested"
  | "requested"
  | "invited"
  | "declined";

export type EligibilityStatus =
  | "unknown"
  | "likely_eligible"
  | "invitation_required"
  | "qualified_swimmers_only"
  | "not_eligible"
  | "admin_confirmed";

export type AttendanceStatus = "no_response" | "incomplete" | "attend" | "decline";

export type ParentEventLabel = "hidden" | "pending_for_review" | "confirmed";

export type MeetStroke = "free" | "back" | "breast" | "fly" | "im" | "unknown";
export type MeetGender = "male" | "female" | "mixed";
export type MeetCourse = "scy" | "scm" | "lcm" | "unknown";

export interface PnsSourceFile {
  name: string;
  url: string;
  kind: "announcement" | "event_file" | "other";
}

export interface PendingSourcePatch {
  startDate?: string;
  endDate?: string;
  location?: string;
  hostClub?: string;
  pnsPublishedDeadline?: string;
  announcementUrl?: string;
  announcementText?: string;
  hostEntryEmail?: string;
  eventFileUrl?: string;
  sourceFiles?: PnsSourceFile[];
  surcharge?: number;
  individualEventFee?: number;
}

export interface MeetEvent {
  id: string;
  eventNumber: number;
  sessionName: string;
  gender: MeetGender;
  minAge: number;
  maxAge: number;
  distance: number;
  stroke: MeetStroke;
  course: MeetCourse;
  eventFee?: number;
  qualifyingTime?: string;
  allowsNT?: boolean;
  isRelay?: boolean;
}

export interface MeetSession {
  id: string;
  name: string;
  date?: string;
}

export interface Meet {
  id: string;
  /** Stable PNS/external key for ingest merge. URL / Firestore doc id is a GUID. */
  sourceKey?: string;
  name: string;
  hostClub: string;
  meetType: "open" | "invitational" | "championship" | "other";
  course: MeetCourse;
  startDate: string;
  endDate: string;
  location: string;
  sanctionNumber?: string;
  announcementUrl?: string;
  announcementText?: string;
  eventFileUrl?: string;
  sourceFiles?: PnsSourceFile[];
  sourceUrl?: string;
  eligibilityStatus: EligibilityStatus;
  invitationStatus: InvitationStatus;
  eligibilityNotes: string[];
  pnsPublishedDeadline?: string;
  announcementEntryDeadline?: string;
  hostConfirmedDeadline?: string;
  effectiveHostDeadline?: string;
  primeCommitmentDeadline?: string;
  deadlineTimezone: string;
  hostEntryEmail?: string;
  surcharge?: number;
  individualEventFee?: number;
  maxEventsMeet?: number;
  maxEventsBySession?: Record<string, number>;
  status: MeetStatus;
  sessions: MeetSession[];
  events: MeetEvent[];
  eventFileAcceptedAt?: string;
  pendingSourceReview?: boolean;
  pendingSourceDiffs?: string[];
  pendingSourcePatch?: PendingSourcePatch;
  sourceLastCheckedAt?: string;
  rejectedAt?: string;
  rejectedReason?: string;
  parentUpdateBanner?: string;
  hostReplySummary?: string;
  /** Hard isolation flag. Parent APIs hide these unless the viewer is a test account. */
  isTestData: boolean;
  createdAt?: string;
  updatedAt?: string;
  publishedToFamiliesAt?: string;
  entriesSubmittedAt?: string;
  entryEmailTo?: string;
  entryEmailSentAt?: string;
  invitationEmailTo?: string;
  invitationEmailSentAt?: string;
  commitmentClosedAt?: string;
  hostReplyAt?: string;
  entriesConfirmedAt?: string;
}

export interface MeetCommitment {
  id: string;
  meetId: string;
  swimmerId: string;
  parentUID: string;
  attendance: AttendanceStatus;
  availableSessionIds: string[];
  selectedEventIds: string[];
  confirmedEventIds?: string[];
  parentNotes: string;
  hostCutNote?: string;
  feePolicyVersion?: string;
  feePolicyAcceptedAt?: string;
  estimatedFee?: number;
  finalFee?: number;
  paymentStatus?: "none" | "estimated" | "invoice_ready" | "payment_reported" | "paid";
  paymentReportedAt?: string;
  paidAt?: string;
  /** Set when families are shown confirmed events. Default: 7 Pacific days later. */
  paymentDueAt?: string;
  isTestData: boolean;
  updatedAt?: string;
}

export interface MeetSwimmer {
  id: string;
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: string;
  childGender?: string;
  level?: string;
  usaSwimmingId?: string;
  parentUID: string;
  paymentStatus?: string;
  isFrozen?: boolean;
  isTestData?: boolean;
}

export interface ClubMeetSettings {
  usaSwimmingOmrUrl: string;
  requiredMembershipLabel: string;
  feePolicyVersion: string;
  feePolicyText: string;
}

export const DEFAULT_FEE_POLICY_VERSION = "2026-09-v1";

export const DEFAULT_FEE_POLICY_TEXT =
  "I understand that Prime Swim Academy will select and submit meet entries on behalf of my swimmer. I agree to pay the final meet fees using a payment method supported by Prime Swim Academy. Meet fees are based on the events selected for the swimmer and become non-refundable once the entries are submitted to the host club.";

/** Prime Swim Academy club OMR. Admin can replace this if USA Swimming issues a new link. */
export const PRIME_SWIM_OMR_URL = "https://omr.usaswimming.org/omr/welcome/7E8545DBBFD70C";

export const DEFAULT_CLUB_MEET_SETTINGS: ClubMeetSettings = {
  usaSwimmingOmrUrl: PRIME_SWIM_OMR_URL,
  requiredMembershipLabel: "USA Swimming Premium / year-round (club OMR)",
  feePolicyVersion: DEFAULT_FEE_POLICY_VERSION,
  feePolicyText: DEFAULT_FEE_POLICY_TEXT,
};

export function resolveClubMeetSettings(partial?: Partial<ClubMeetSettings> | null): ClubMeetSettings {
  const merged = { ...DEFAULT_CLUB_MEET_SETTINGS, ...partial };
  if (!merged.usaSwimmingOmrUrl?.trim()) {
    merged.usaSwimmingOmrUrl = PRIME_SWIM_OMR_URL;
  }
  return merged;
}

export function newMeetId(): string {
  return crypto.randomUUID();
}

export function meetMatchesSource(meet: Pick<Meet, "id" | "sourceKey" | "name">, hint: string): boolean {
  const needle = hint.toLowerCase();
  return `${meet.sourceKey || ""} ${meet.id} ${meet.name || ""}`.toLowerCase().includes(needle);
}

export const PARENT_VISIBLE_STATUSES: MeetStatus[] = [
  "commitment_open",
  "commitment_closed",
  "submitted",
  "host_reply_received",
  "entries_confirmed",
  "upcoming",
  "in_progress",
  "completed",
];
