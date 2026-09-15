import { computeHostFee } from "./fees";
import { eventsForSwimmer, swimmerEligibilitySummary } from "./eligibility";
import { eventLabel } from "./hytek-events";
import { canViewerSeeMeet } from "./test-data";
import type { ClubMeetSettings, Meet, MeetCommitment, MeetEvent, MeetSwimmer } from "./types";
import { DEFAULT_CLUB_MEET_SETTINGS, PARENT_VISIBLE_STATUSES } from "./types";
import { usaSwimmingAttendGate } from "./usa-swimming";
import { canParentEditCommitment, finalSwimEventIds, isParentVisibleStatus, parentEventLabel } from "./workflow";
import { meetPaymentDueAt } from "./deadlines";

export interface ParentRequestedEvent {
  id: string;
  label: string;
  sessionName: string;
}

export interface ParentMeetCard {
  meetId: string;
  swimmerId?: string;
  name: string;
  hostClub: string;
  startDate: string;
  endDate: string;
  location: string;
  meetType: Meet["meetType"];
  status: Meet["status"];
  eventLabel: ReturnType<typeof parentEventLabel>;
  primeCommitmentDeadline?: string;
  announcementUrl?: string;
  sourceKey?: string;
  parentUpdateBanner?: string;
  attendance: MeetCommitment["attendance"] | "no_response";
  estimatedFee?: number;
  finalFee?: number;
  paymentStatus?: MeetCommitment["paymentStatus"];
  paymentDueAt?: string;
  isTestData: boolean;
}

export interface ParentMeetDetail {
  meet: Meet;
  swimmer: MeetSwimmer;
  eventLabel: ReturnType<typeof parentEventLabel>;
  canEdit: boolean;
  canRespond: boolean;
  usaGate: ReturnType<typeof usaSwimmingAttendGate>;
  eligibility: ReturnType<typeof swimmerEligibilitySummary>;
  eligibleEvents: Array<MeetEvent & { label: string }>;
  requestedEvents: ParentRequestedEvent[];
  displayedEvents: ParentRequestedEvent[];
  commitment: MeetCommitment | null;
  fee: { surcharge: number; events: number; total: number; isEstimate: boolean };
  settings: ClubMeetSettings;
  hasEventFile: boolean;
  announcementUrl?: string;
}

export function listParentMeetCards(opts: {
  meets: Meet[];
  commitments: MeetCommitment[];
  viewerIsTestAccount: boolean;
  swimmerId?: string;
}): ParentMeetCard[] {
  return opts.meets
    .filter((meet) => isParentVisibleStatus(meet.status))
    .filter((meet) => canViewerSeeMeet({ meetIsTestData: meet.isTestData, viewerIsTestAccount: opts.viewerIsTestAccount }))
    .map((meet) => {
      const commitment = opts.commitments.find(
        (c) => c.meetId === meet.id && (!opts.swimmerId || c.swimmerId === opts.swimmerId)
      );
      const label = parentEventLabel(meet.status);
      return {
        meetId: meet.id,
        swimmerId: opts.swimmerId || commitment?.swimmerId,
        name: meet.name,
        hostClub: meet.hostClub,
        startDate: meet.startDate,
        endDate: meet.endDate,
        location: meet.location,
        meetType: meet.meetType,
        status: meet.status,
        eventLabel: label,
        primeCommitmentDeadline: meet.primeCommitmentDeadline,
        announcementUrl: meet.announcementUrl,
        sourceKey: meet.sourceKey,
        parentUpdateBanner: meet.parentUpdateBanner,
        attendance: commitment?.attendance || "no_response",
        estimatedFee: commitment?.estimatedFee,
        finalFee: label === "confirmed" ? commitment?.finalFee : undefined,
        paymentStatus: label === "confirmed" ? commitment?.paymentStatus : commitment?.attendance === "attend" ? "estimated" : "none",
        paymentDueAt: label === "confirmed" ? commitment?.paymentDueAt || meetPaymentDueAt(meet.entriesConfirmedAt) : undefined,
        isTestData: meet.isTestData,
      };
    });
}

export function buildParentMeetDetail(opts: {
  meet: Meet;
  swimmer: MeetSwimmer;
  commitment: MeetCommitment | null;
  settings?: ClubMeetSettings;
  nowIso: string;
  viewerIsTestAccount: boolean;
}): ParentMeetDetail | { error: string } {
  if (!canViewerSeeMeet({ meetIsTestData: opts.meet.isTestData, viewerIsTestAccount: opts.viewerIsTestAccount })) {
    return { error: "Meet not found." };
  }
  if (!isParentVisibleStatus(opts.meet.status) && !PARENT_VISIBLE_STATUSES.includes(opts.meet.status)) {
    return { error: "Meet is not open to families yet." };
  }
  if (!isParentVisibleStatus(opts.meet.status)) {
    return { error: "Meet is not open to families yet." };
  }

  const settings = opts.settings || DEFAULT_CLUB_MEET_SETTINGS;
  const usaGate = usaSwimmingAttendGate({
    usaSwimmingId: opts.swimmer.usaSwimmingId,
    omrUrl: settings.usaSwimmingOmrUrl,
  });
  const eligibility = swimmerEligibilitySummary(opts.meet, opts.swimmer);
  const eligible = eventsForSwimmer(opts.meet, opts.swimmer).map((event) => ({
    ...event,
    label: eventLabel(event),
  }));
  const label = parentEventLabel(opts.meet.status);
  const selected = finalSwimEventIds({
    attendance: opts.commitment?.attendance,
    status: opts.meet.status,
    selectedEventIds: opts.commitment?.selectedEventIds || [],
    confirmedEventIds: opts.commitment?.confirmedEventIds,
  });
  const byId = new Map(opts.meet.events.map((e) => [e.id, e]));
  const toRequested = (ids: string[]): ParentRequestedEvent[] =>
    ids
      .map((id) => byId.get(id))
      .filter((e): e is MeetEvent => Boolean(e))
      .map((event) => ({ id: event.id, label: eventLabel(event), sessionName: event.sessionName }));

  const feeEventCount = opts.commitment?.attendance === "decline" ? 0 : selected.length;
  const fee = computeHostFee({
    surcharge: opts.meet.surcharge,
    individualEventFee: opts.meet.individualEventFee,
    eventCount: feeEventCount,
  });

  return {
    meet: opts.meet,
    swimmer: opts.swimmer,
    eventLabel: label,
    canRespond: canParentEditCommitment(opts.meet.status, opts.nowIso, opts.meet.primeCommitmentDeadline),
    canEdit: canParentEditCommitment(opts.meet.status, opts.nowIso, opts.meet.primeCommitmentDeadline) && usaGate.canAttend,
    usaGate,
    eligibility,
    eligibleEvents: eligible,
    requestedEvents: toRequested(opts.commitment?.selectedEventIds || []),
    displayedEvents: toRequested(selected),
    commitment: opts.commitment,
    fee: { ...fee, isEstimate: label !== "confirmed" },
    settings,
    hasEventFile: (opts.meet.events || []).length > 0 && Boolean(opts.meet.eventFileAcceptedAt),
    announcementUrl: opts.meet.announcementUrl,
  };
}

export function householdMeetPayments(cards: ParentMeetCard[]): ParentMeetCard[] {
  return cards.filter((card) => card.eventLabel === "confirmed" && (card.finalFee || 0) > 0);
}
