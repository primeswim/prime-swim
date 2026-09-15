import { isPrimeDeadlinePassed } from "./deadlines";
import type { InvitationStatus, Meet, MeetStatus } from "./types";

export function canPublishToFamilies(meet: Pick<Meet, "invitationStatus" | "status">): {
  ok: boolean;
  reason: string;
} {
  if (meet.invitationStatus === "not_requested" || meet.invitationStatus === "requested") {
    return { ok: false, reason: "Invitational meets cannot be published until invitationStatus is invited." };
  }
  if (meet.invitationStatus === "declined") {
    return { ok: false, reason: "Host declined the invitation." };
  }
  if (meet.status === "cancelled") {
    return { ok: false, reason: "This meet was cancelled." };
  }
  return { ok: true, reason: "" };
}

export function statusAfterApprove(invitationStatus: InvitationStatus): MeetStatus {
  if (invitationStatus === "not_requested" || invitationStatus === "requested") {
    return "invitation_pending";
  }
  return "ready_to_publish";
}

export function parentEventLabel(status: MeetStatus): "hidden" | "pending_for_review" | "confirmed" {
  if (status === "draft" || status === "admin_review" || status === "invitation_pending" || status === "ready_to_publish" || status === "cancelled") {
    return "hidden";
  }
  if (status === "entries_confirmed" || status === "upcoming" || status === "in_progress" || status === "completed") {
    return "confirmed";
  }
  return "pending_for_review";
}

export function isParentVisibleStatus(status: MeetStatus): boolean {
  return parentEventLabel(status) !== "hidden";
}

export function canParentEditCommitment(status: MeetStatus, nowIso: string, deadline?: string): boolean {
  if (status !== "commitment_open") return false;
  return !isPrimeDeadlinePassed(deadline, nowIso);
}

export function shouldAutoCloseRsvp(meet: Pick<Meet, "status" | "primeCommitmentDeadline">, nowIso: string): boolean {
  return meet.status === "commitment_open" && isPrimeDeadlinePassed(meet.primeCommitmentDeadline, nowIso);
}

export function displayedEventIds(opts: {
  status: MeetStatus;
  selectedEventIds: string[];
  confirmedEventIds?: string[];
}): string[] {
  const label = parentEventLabel(opts.status);
  if (label === "confirmed") return opts.confirmedEventIds?.length ? opts.confirmedEventIds : opts.selectedEventIds;
  return opts.selectedEventIds;
}

/** Events this swimmer will actually swim. Decline is always empty. After confirm, host cuts win. */
export function finalSwimEventIds(opts: {
  attendance?: string;
  status: MeetStatus;
  selectedEventIds: string[];
  confirmedEventIds?: string[];
}): string[] {
  if (opts.attendance === "decline") return [];
  return displayedEventIds({
    status: opts.status,
    selectedEventIds: opts.selectedEventIds,
    confirmedEventIds: opts.confirmedEventIds,
  });
}

export function isMeetLineupFinalized(status: MeetStatus): boolean {
  return parentEventLabel(status) === "confirmed";
}

export const ADMIN_MEET_STEP_IDS = [
  "ask_host",
  "publish",
  "collect_rsvp",
  "send_entries",
  "host_reply",
  "confirm_families",
] as const;

export type AdminMeetStepId = (typeof ADMIN_MEET_STEP_IDS)[number] | "done";
export type AdminStepState = "skipped" | "done" | "current" | "locked";

export interface AdminMeetGuide {
  current: AdminMeetStepId;
  nextTitle: string;
  nextDetail: string;
  steps: Array<{ id: Exclude<AdminMeetStepId, "done">; title: string; state: AdminStepState }>;
}

const STEP_TITLES: Record<Exclude<AdminMeetStepId, "done">, string> = {
  ask_host: "Ask the host if Prime may attend",
  publish: "Publish to families",
  collect_rsvp: "Collect Attend / Decline",
  send_entries: "Email the entry list to the host",
  host_reply: "Record the host reply",
  confirm_families: "Show confirmed events & fees",
};

export function isPrePublishStatus(status: MeetStatus): boolean {
  return status === "draft" || status === "admin_review" || status === "invitation_pending" || status === "ready_to_publish";
}

export function adminMeetGuide(
  meet: Pick<Meet, "status" | "meetType" | "invitationStatus" | "primeCommitmentDeadline">
): AdminMeetGuide {
  const openMeet = meet.invitationStatus === "not_required" || meet.meetType === "open";
  const declined = meet.invitationStatus === "declined";
  const needsInvite = !openMeet && (meet.invitationStatus === "not_requested" || meet.invitationStatus === "requested");

  let current: AdminMeetStepId;
  if (meet.status === "cancelled" && meet.invitationStatus === "declined") {
    current = "ask_host";
  } else if (meet.status === "cancelled") {
    current = "done";
  } else if (isPrePublishStatus(meet.status)) {
    current = declined || needsInvite ? "ask_host" : "publish";
  } else if (meet.status === "commitment_open") {
    current = "collect_rsvp";
  } else if (meet.status === "commitment_closed") {
    current = "send_entries";
  } else if (meet.status === "submitted") {
    current = "host_reply";
  } else if (meet.status === "host_reply_received") {
    current = "confirm_families";
  } else {
    current = "done";
  }

  const currentIndex = current === "done" ? ADMIN_MEET_STEP_IDS.length : ADMIN_MEET_STEP_IDS.indexOf(current);
  const steps = ADMIN_MEET_STEP_IDS.map((id, idx) => {
    if (id === "ask_host" && openMeet) {
      return { id, title: STEP_TITLES[id], state: "skipped" as const };
    }
    if (id === current) return { id, title: STEP_TITLES[id], state: "current" as const };
    if (idx < currentIndex) return { id, title: STEP_TITLES[id], state: "done" as const };
    return { id, title: STEP_TITLES[id], state: "locked" as const };
  });

  let nextTitle = current === "done" ? "This meet is finished" : STEP_TITLES[current];
  let nextDetail = "";
  if (meet.status === "cancelled" && meet.invitationStatus !== "declined") {
    nextTitle = "This meet was cancelled";
    nextDetail = "Families will not see it.";
  } else if (current === "ask_host") {
    if (declined) {
      nextTitle = "Host declined";
      nextDetail = "Prime cannot enter this invitational. Do not publish.";
    } else if (meet.invitationStatus === "requested") {
      nextTitle = "Waiting for the host";
      nextDetail = "When they invite Prime Swim Academy, mark Host invited Prime. Then you can publish.";
    } else {
      nextTitle = "Ask the host if Prime may attend";
      nextDetail = "This is an invitational. Send that request first. Do not publish, and do not send an athlete list yet.";
    }
  } else if (current === "publish") {
    nextTitle = meet.primeCommitmentDeadline ? "Publish to families" : "Set the Prime Deadline, then publish";
    nextDetail = meet.primeCommitmentDeadline
      ? "If you already have the host Event File (.hyv / .ev3), upload it now so families can check events when they Attend. Then publish."
      : "Save a Prime Deadline first. If you already have the Event File, upload it before publishing so families can check events when they Attend.";
  } else if (current === "collect_rsvp") {
    nextTitle = "Families are responding";
    nextDetail =
      "Wait for the Prime Deadline, or close early if the meet fills. Upload the Event File here if the host sent it. The entry email stays hidden until RSVP closes.";
  } else if (current === "send_entries") {
    nextTitle = "Email the entry list to the host";
    nextDetail = "RSVP is closed. This letter lists the athletes who Attended. It is not the invitation request.";
  } else if (current === "host_reply") {
    nextTitle = "Record the host reply";
    nextDetail = "After they confirm or cut events, save a short note. Then you can uncheck cut events.";
  } else if (current === "confirm_families") {
    nextTitle = "Uncheck cut events, then show families the confirmed list";
    nextDetail = "This does not reopen Attend / Decline. It only replaces Pending for review with the final events and fees.";
  } else {
    nextDetail = "Families see the confirmed events and fees.";
  }

  return { current, nextTitle, nextDetail, steps };
}
