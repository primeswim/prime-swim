import { feeForMeetEvents } from "./fees";
import { eventsForSwimmer, swimmerEligibilitySummary } from "./eligibility";
import { eventLabel, shortEventLabel } from "./hytek-events";
import { canViewerSeeMeet } from "./test-data";
import type { ClubMeetSettings, Meet, MeetCommitment, MeetEvent, MeetSwimmer } from "./types";
import { DEFAULT_CLUB_MEET_SETTINGS } from "./types";
import { usaSwimmingAttendGate } from "./usa-swimming";
import { canParentEditCommitment, finalSwimEventIds, isParentVisibleStatus, parentEventLabel } from "./workflow";
import { meetPaymentDueAt } from "./deadlines";
import { meetAnnouncementUrl } from "./pns-url";

export interface ParentRequestedEvent {
  id: string;
  label: string;
  sessionName: string;
}

/** Selected (or confirmed) events for one swimmer at one meet. */
export interface ParentSelectedEvent {
  id: string;
  eventNumber: number;
  sessionName: string;
  distance: number;
  stroke: MeetEvent["stroke"];
  label: string;
}

export interface UpcomingSwimmerMeet {
  swimmerId: string;
  swimmerFirstName: string;
  swimmerLastName: string;
  meetId: string;
  name: string;
  hostClub: string;
  startDate: string;
  endDate: string;
  location: string;
  status: Meet["status"];
  attendance: Extract<MeetCommitment["attendance"], "attend" | "incomplete">;
  sourceKey?: string;
  events: ParentSelectedEvent[];
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
  swimmerResponses: Array<{
    swimmerId: string;
    attendance: MeetCommitment["attendance"];
    events: ParentSelectedEvent[];
  }>;
  selectedEvents: ParentSelectedEvent[];
  cutEvents: ParentSelectedEvent[];
  hostCutNote?: string;
  rsvpOpen: boolean;
  rsvpNotice?: string;
  estimatedFee?: number;
  finalFee?: number;
  paymentStatus?: MeetCommitment["paymentStatus"];
  paymentDueAt?: string;
  isTestData: boolean;
}

export interface PublicMeetDetail {
  meet: {
    id: string;
    name: string;
    hostClub: string;
    meetType: Meet["meetType"];
    startDate: string;
    endDate: string;
    location: string;
    announcementText?: string;
    sourceKey?: string;
    eligibilityNotes: string[];
    primeCommitmentDeadline?: string;
    status: Meet["status"];
    isTestData: boolean;
  };
  eventLabel: ReturnType<typeof parentEventLabel>;
  announcementUrl?: string;
  rsvpOpen: boolean;
  rsvpNotice?: string;
  hasEventFile: boolean;
}

export interface ParentMeetDetail {
  meet: Meet;
  swimmer: MeetSwimmer;
  eventLabel: ReturnType<typeof parentEventLabel>;
  canEdit: boolean;
  canRespond: boolean;
  rsvpNotice?: string;
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

export function listPublicMeetCards(meets: Meet[]): ParentMeetCard[] {
  return listParentMeetCards({
    meets,
    commitments: [],
    viewerIsTestAccount: false,
  });
}

export function buildPublicMeetDetail(meet: Meet): PublicMeetDetail | { error: string } {
  const cancelledAfterPublish = meet.status === "cancelled" && Boolean(meet.publishedToFamiliesAt);
  if (!isParentVisibleStatus(meet.status) && !cancelledAfterPublish) {
    return { error: "Meet is not open to families yet." };
  }
  return {
    meet: {
      id: meet.id,
      name: meet.name,
      hostClub: meet.hostClub,
      meetType: meet.meetType,
      startDate: meet.startDate,
      endDate: meet.endDate,
      location: meet.location,
      announcementText: meet.announcementText,
      sourceKey: meet.sourceKey,
      eligibilityNotes: meet.eligibilityNotes,
      primeCommitmentDeadline: meet.primeCommitmentDeadline,
      status: meet.status,
      isTestData: meet.isTestData,
    },
    eventLabel: parentEventLabel(meet.status),
    announcementUrl: meetAnnouncementUrl(meet),
    rsvpOpen: meet.status === "commitment_open",
    rsvpNotice: parentRsvpNotice(meet.status),
    hasEventFile: (meet.events || []).length > 0 && Boolean(meet.eventFileAcceptedAt),
  };
}

export function listParentMeetCards(opts: {
  meets: Meet[];
  commitments: MeetCommitment[];
  viewerIsTestAccount: boolean;
  swimmerId?: string;
}): ParentMeetCard[] {
  return opts.meets
    .filter((meet) => isParentVisibleStatus(meet.status) || Boolean(meet.status === "cancelled" && meet.publishedToFamiliesAt))
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
        announcementUrl: meetAnnouncementUrl(meet),
        sourceKey: meet.sourceKey,
        parentUpdateBanner: meet.parentUpdateBanner,
        attendance: commitment?.attendance || "no_response",
        selectedEvents: commitmentSelectedEvents(meet, commitment),
        cutEvents: commitmentCutEvents(meet, commitment),
        hostCutNote: commitment?.hostCutNote,
        rsvpOpen: meet.status === "commitment_open",
        rsvpNotice: parentRsvpNotice(meet.status),
        swimmerResponses: opts.commitments
          .filter((c) => c.meetId === meet.id)
          .map((c) => ({
            swimmerId: c.swimmerId,
            attendance: c.attendance,
            events: commitmentSelectedEvents(meet, c),
          })),
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
  const cancelledAfterPublish = opts.meet.status === "cancelled" && Boolean(opts.meet.publishedToFamiliesAt);
  if (!isParentVisibleStatus(opts.meet.status) && !cancelledAfterPublish) {
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

  const fee =
    opts.commitment?.attendance === "decline"
      ? { surcharge: 0, events: 0, total: 0 }
      : feeForMeetEvents(opts.meet, selected);

  return {
    meet: opts.meet,
    swimmer: opts.swimmer,
    eventLabel: label,
    canRespond: canParentEditCommitment(opts.meet.status, opts.nowIso, opts.meet.primeCommitmentDeadline),
    rsvpNotice: parentRsvpNotice(opts.meet.status),
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
    announcementUrl: meetAnnouncementUrl(opts.meet),
  };
}

export function householdMeetPayments(cards: ParentMeetCard[]): ParentMeetCard[] {
  return cards.filter((card) => card.eventLabel === "confirmed" && (card.finalFee || 0) > 0);
}

export function isSwimmerUpcomingMeetCard(card: ParentMeetCard, todayYmd: string): boolean {
  if (card.attendance !== "attend" && card.attendance !== "incomplete") return false;
  const end = (card.endDate || card.startDate || "").slice(0, 10);
  if (end && end < todayYmd) return false;
  return true;
}

export function parentRsvpNotice(status: Meet["status"]): string | undefined {
  if (status === "commitment_open") return undefined;
  if (status === "cancelled") return "This meet was cancelled. Attend / Decline is closed.";
  if (status === "completed") return "This meet is over. Attend / Decline is closed.";
  return "RSVP is closed. You can still view this meet, but Attend / Decline can no longer be changed.";
}

function toParentSelectedEvents(meet: Meet, ids: string[]): ParentSelectedEvent[] {
  return ids
    .map((id) => meet.events.find((event) => event.id === id))
    .filter((event): event is MeetEvent => Boolean(event))
    .map((event) => ({
      id: event.id,
      eventNumber: event.eventNumber,
      sessionName: event.sessionName,
      distance: event.distance,
      stroke: event.stroke,
      label: shortEventLabel(event),
    }));
}

function commitmentSelectedEvents(meet: Meet, commitment?: MeetCommitment | null): ParentSelectedEvent[] {
  if (!commitment || commitment.attendance === "decline" || commitment.attendance === "no_response") return [];
  return toParentSelectedEvents(
    meet,
    finalSwimEventIds({
      attendance: commitment.attendance,
      status: meet.status,
      selectedEventIds: commitment.selectedEventIds || [],
      confirmedEventIds: commitment.confirmedEventIds,
    })
  );
}

function commitmentCutEvents(meet: Meet, commitment?: MeetCommitment | null): ParentSelectedEvent[] {
  if (!commitment || parentEventLabel(meet.status) !== "confirmed") return [];
  if (commitment.attendance === "decline" || commitment.attendance === "no_response") return [];
  const kept = new Set(
    finalSwimEventIds({
      attendance: commitment.attendance,
      status: meet.status,
      selectedEventIds: commitment.selectedEventIds || [],
      confirmedEventIds: commitment.confirmedEventIds,
    })
  );
  return toParentSelectedEvents(
    meet,
    (commitment.selectedEventIds || []).filter((id) => !kept.has(id))
  );
}

export function listUpcomingSwimmerMeets(opts: {
  meets: Meet[];
  commitments: MeetCommitment[];
  swimmers: MeetSwimmer[];
  viewerIsTestAccount: boolean;
  todayYmd: string;
  swimmerIds?: string[];
}): UpcomingSwimmerMeet[] {
  const wanted = opts.swimmerIds?.length ? new Set(opts.swimmerIds) : null;
  const swimmers = wanted ? opts.swimmers.filter((swimmer) => wanted.has(swimmer.id)) : opts.swimmers;
  const visible = opts.meets.filter(
    (meet) =>
      isParentVisibleStatus(meet.status) &&
      canViewerSeeMeet({ meetIsTestData: meet.isTestData, viewerIsTestAccount: opts.viewerIsTestAccount }) &&
      (meet.endDate || meet.startDate).slice(0, 10) >= opts.todayYmd
  );
  const byId = new Map(swimmers.map((swimmer) => [swimmer.id, swimmer]));
  const rows: UpcomingSwimmerMeet[] = [];
  for (const meet of visible) {
    for (const commitment of opts.commitments) {
      if (commitment.meetId !== meet.id) continue;
      if (wanted && !wanted.has(commitment.swimmerId)) continue;
      if (commitment.attendance !== "attend" && commitment.attendance !== "incomplete") continue;
      const swimmer = byId.get(commitment.swimmerId);
      if (!swimmer) continue;
      rows.push({
        swimmerId: swimmer.id,
        swimmerFirstName: displaySwimmerFirstName(swimmer.childFirstName),
        swimmerLastName: swimmer.childLastName.replace(/^\[TEST\]\s*/, ""),
        meetId: meet.id,
        name: meet.name,
        hostClub: meet.hostClub,
        startDate: meet.startDate,
        endDate: meet.endDate,
        location: meet.location,
        status: meet.status,
        attendance: commitment.attendance,
        sourceKey: meet.sourceKey,
        events: commitmentSelectedEvents(meet, commitment),
      });
    }
  }
  rows.sort((a, b) => `${a.startDate}${a.swimmerLastName}${a.meetId}`.localeCompare(`${b.startDate}${b.swimmerLastName}${b.meetId}`));
  return rows;
}

export function displaySwimmerFirstName(name: string): string {
  return name.replace(/^\[TEST\]\s*/, "").trim() || name;
}

/** What families see. Internal pending_for_review is never shown as a badge. */
export function parentAttendanceLabel(
  attendance: ParentMeetCard["attendance"],
  eventLabel: ParentMeetCard["eventLabel"]
): string {
  if (attendance === "decline") return "Declined";
  if (eventLabel === "confirmed") return "Confirmed";
  if (attendance === "attend" || attendance === "incomplete") return "Attending";
  return "Open";
}

export function swimmerMeetActionLabel(firstName: string, attendance: ParentMeetCard["attendance"]): string {
  const name = displaySwimmerFirstName(firstName);
  if (attendance === "attend" || attendance === "incomplete") return `${name}: Attending`;
  if (attendance === "decline") return `${name}: Declined`;
  return `${name}: Attend / Decline`;
}

/** Homepage tones: slate = not yet, amber = attending, red = declined. */
export function swimmerMeetActionClass(attendance: ParentMeetCard["attendance"]): string {
  if (attendance === "attend" || attendance === "incomplete") {
    return "bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-md";
  }
  if (attendance === "decline") {
    return "bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md";
  }
  return "bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-md";
}

export function parentAttendanceBadgeClass(
  attendance: ParentMeetCard["attendance"],
  eventLabel: ParentMeetCard["eventLabel"]
): string {
  if (attendance === "decline") return "bg-red-600 text-white border-0";
  if (eventLabel === "confirmed") return "bg-yellow-500 text-white border-0";
  if (attendance === "attend" || attendance === "incomplete") return "bg-amber-500 text-white border-0";
  return "bg-slate-800 text-white border-0";
}
