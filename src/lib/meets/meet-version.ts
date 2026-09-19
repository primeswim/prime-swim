import { parentBannerForDayReselection } from "./pns-calendar";
import type { Meet, MeetCommitment, MeetEvent, MeetSession } from "./types";

export const MEET_UPDATE_REASONS = [
  "dates_changed",
  "sessions_changed",
  "event_file_changed",
  "events_changed",
] as const;

export type MeetUpdateReason = (typeof MEET_UPDATE_REASONS)[number];

export type MeetNoticeReason = "location_changed";
export type EventReviewAction = "none" | "reconfirm" | "contact_prime";

export type ParentMeetReview = {
  meetVersion: number;
  responseVersion: number;
  requiresEventReview: boolean;
  updateReason: MeetUpdateReason[];
  updatedAt?: string;
  canEdit: boolean;
  canRespond: boolean;
  eventReviewAction: EventReviewAction;
  requiresMeetAcknowledgement: boolean;
  noticeReason?: MeetNoticeReason;
  noticeVersion: number;
  acknowledgedNoticeVersion: number;
  noticeUpdatedAt?: string;
};

export function currentMeetVersion(meet: { meetVersion?: number }): number {
  const value = Number(meet.meetVersion);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

/** Legacy RSVPs without responseVersion are treated as already in sync. */
export function currentResponseVersion(
  commitment: { responseVersion?: number } | null | undefined,
  meetVersion: number
): number {
  const value = Number(commitment?.responseVersion);
  return Number.isFinite(value) ? value : meetVersion;
}

export function isAttendingCommitment(attendance?: string): boolean {
  return attendance === "attend" || attendance === "incomplete";
}

export function currentNoticeVersion(meet: { noticeVersion?: number }): number {
  const value = Number(meet.noticeVersion);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function currentAcknowledgedNoticeVersion(commitment: { acknowledgedNoticeVersion?: number } | null | undefined): number {
  const value = Number(commitment?.acknowledgedNoticeVersion);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeLocation(value?: string): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function locationChanged(before?: string, after?: string): boolean {
  return normalizeLocation(before) !== normalizeLocation(after);
}

export function applyLocationNoticeBump<
  T extends { noticeVersion?: number; noticeReason?: MeetNoticeReason; noticeUpdatedAt?: string },
>(meet: T, noticeUpdatedAt: string): T {
  return {
    ...meet,
    noticeVersion: currentNoticeVersion(meet) + 1,
    noticeReason: "location_changed",
    noticeUpdatedAt,
  };
}

export function parentMeetReviewState(
  meet: {
    meetVersion?: number;
    updateReason?: MeetUpdateReason[];
    updatedAt?: string;
    noticeVersion?: number;
    noticeReason?: MeetNoticeReason;
    noticeUpdatedAt?: string;
  },
  commitment: { attendance?: string; responseVersion?: number; acknowledgedNoticeVersion?: number } | null | undefined,
  access: { canEdit: boolean; canRespond: boolean } = { canEdit: false, canRespond: false }
): ParentMeetReview {
  const meetVersion = currentMeetVersion(meet);
  const responseVersion = currentResponseVersion(commitment, meetVersion);
  const requiresEventReview = isAttendingCommitment(commitment?.attendance) && meetVersion > responseVersion;
  const noticeVersion = currentNoticeVersion(meet);
  const acknowledgedNoticeVersion = currentAcknowledgedNoticeVersion(commitment);
  const requiresMeetAcknowledgement =
    isAttendingCommitment(commitment?.attendance) && noticeVersion > acknowledgedNoticeVersion;
  return {
    meetVersion,
    responseVersion,
    requiresEventReview,
    updateReason: Array.isArray(meet.updateReason) ? meet.updateReason : [],
    updatedAt: meet.updatedAt,
    canEdit: access.canEdit,
    canRespond: access.canRespond,
    eventReviewAction: requiresEventReview ? (access.canRespond ? "reconfirm" : "contact_prime") : "none",
    requiresMeetAcknowledgement,
    noticeReason: requiresMeetAcknowledgement ? meet.noticeReason || "location_changed" : undefined,
    noticeVersion,
    acknowledgedNoticeVersion,
    noticeUpdatedAt: meet.noticeUpdatedAt,
  };
}

export const LOCATION_NOTICE_TEXT = "The meet location was updated. Please check the new venue.";
export const CLOSED_REVIEW_TEXT = "This meet was updated after RSVP closed. Contact Prime — you cannot change events now.";

export function parentBannerForUpdateReasons(reasons: MeetUpdateReason[]): string | undefined {
  if (reasons.includes("dates_changed")) return parentBannerForDayReselection();
  if (reasons.includes("event_file_changed") || reasons.includes("events_changed")) {
    return "The host updated the events for this meet. Review the list and tap Attend again.";
  }
  if (reasons.includes("sessions_changed")) {
    return "The host changed the sessions for this meet. Review your days and tap Attend again.";
  }
  return undefined;
}

export function applyMeetVersionBump<
  T extends { meetVersion?: number; updateReason?: MeetUpdateReason[]; parentUpdateBanner?: string },
>(meet: T, reasons: MeetUpdateReason[], banner?: string): T {
  const unique = [...new Set(reasons.filter((reason) => MEET_UPDATE_REASONS.includes(reason)))];
  if (unique.length === 0) return meet;
  const note = (banner || "").trim() || parentBannerForUpdateReasons(unique);
  return {
    ...meet,
    meetVersion: currentMeetVersion(meet) + 1,
    updateReason: unique,
    parentUpdateBanner: note || meet.parentUpdateBanner,
  };
}

function ymd(value?: string): string {
  return (value || "").slice(0, 10);
}

function sessionSignature(sessions: MeetSession[] | undefined): string {
  return (sessions || [])
    .map((session) => `${session.id}:${session.name}:${ymd(session.date)}`)
    .sort()
    .join("|");
}

function eventSignature(events: MeetEvent[] | undefined): string {
  return (events || [])
    .map(
      (event) =>
        `${event.id}:${event.eventNumber}:${event.sessionName}:${event.stroke}:${event.distance}:${event.gender}:${event.minAge}:${event.maxAge}`
    )
    .sort()
    .join("|");
}

export function reasonsForMeetShapeChange(
  before: Pick<Meet, "startDate" | "endDate" | "sessions" | "events">,
  after: Pick<Meet, "startDate" | "endDate" | "sessions" | "events">
): MeetUpdateReason[] {
  const reasons: MeetUpdateReason[] = [];
  if (ymd(before.startDate) !== ymd(after.startDate) || ymd(before.endDate) !== ymd(after.endDate)) {
    reasons.push("dates_changed");
  }
  if (sessionSignature(before.sessions) !== sessionSignature(after.sessions)) {
    reasons.push("sessions_changed");
  }
  if (eventSignature(before.events) !== eventSignature(after.events)) {
    reasons.push("events_changed");
  }
  return reasons;
}

export function reasonsFromPnsDateDiffs(diffs: string[]): MeetUpdateReason[] {
  if (!diffs.some((diff) => /startDate|endDate/i.test(diff))) return [];
  return ["dates_changed", "sessions_changed"];
}
