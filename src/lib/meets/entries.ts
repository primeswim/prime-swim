import { eventLabel } from "./hytek-events";
import { isMeetPaymentOverdue, meetPaymentDueAt } from "./deadlines";
import type { Meet, MeetCommitment, MeetSwimmer } from "./types";
import { finalSwimEventIds, parentEventLabel } from "./workflow";

export interface MeetEntryEvent {
  id: string;
  eventNumber: number;
  sessionName: string;
  label: string;
}

export interface MeetEntryExport {
  swimmerId: string;
  firstName: string;
  lastName: string;
  usaSwimmingId?: string;
  attendance: MeetCommitment["attendance"];
  days: string[];
  requestedEventIds: string[];
  confirmedEventIds: string[];
  finalEventIds: string[];
  finalEvents: MeetEntryEvent[];
  parentNotes: string;
  hostCutNote?: string;
  estimatedFee?: number;
  finalFee?: number;
  paymentStatus?: MeetCommitment["paymentStatus"];
  paymentDueAt?: string;
  paymentReportedAt?: string;
  paidAt?: string;
  isTestData: boolean;
  updatedAt?: string;
}

export interface MeetEntriesPayload {
  meet: {
    id: string;
    name: string;
    hostClub: string;
    meetType: Meet["meetType"];
    startDate: string;
    endDate: string;
    location: string;
    course: Meet["course"];
    status: Meet["status"];
    isTestData: boolean;
    entriesConfirmedAt?: string;
    paymentDueAt?: string;
  };
  catalog: MeetEntryEvent[];
  entries: MeetEntryExport[];
}

function toEntryEvent(meet: Meet, id: string): MeetEntryEvent | null {
  const event = meet.events.find((e) => e.id === id);
  if (!event) return null;
  return {
    id: event.id,
    eventNumber: event.eventNumber,
    sessionName: event.sessionName,
    label: eventLabel(event),
  };
}

export function serializeMeetEntry(meet: Meet, commitment: MeetCommitment, swimmer?: MeetSwimmer | null): MeetEntryExport {
  const finalEventIds = finalSwimEventIds({
    attendance: commitment.attendance,
    status: meet.status,
    selectedEventIds: commitment.selectedEventIds || [],
    confirmedEventIds: commitment.confirmedEventIds,
  });
  const due =
    commitment.paymentDueAt ||
    (parentEventLabel(meet.status) === "confirmed" ? meetPaymentDueAt(meet.entriesConfirmedAt) : undefined);
  return {
    swimmerId: commitment.swimmerId,
    firstName: swimmer?.childFirstName || "",
    lastName: swimmer?.childLastName || "",
    usaSwimmingId: swimmer?.usaSwimmingId,
    attendance: commitment.attendance,
    days: commitment.availableSessionIds || [],
    requestedEventIds: commitment.selectedEventIds || [],
    confirmedEventIds: commitment.confirmedEventIds || [],
    finalEventIds,
    finalEvents: finalEventIds.map((id) => toEntryEvent(meet, id)).filter((e): e is MeetEntryEvent => Boolean(e)),
    parentNotes: commitment.parentNotes || "",
    hostCutNote: commitment.hostCutNote,
    estimatedFee: commitment.estimatedFee,
    finalFee: commitment.finalFee,
    paymentStatus: commitment.paymentStatus,
    paymentDueAt: due,
    paymentReportedAt: commitment.paymentReportedAt,
    paidAt: commitment.paidAt,
    isTestData: commitment.isTestData,
    updatedAt: commitment.updatedAt,
  };
}

export function serializeMeetEntries(meet: Meet, commitments: MeetCommitment[], swimmers: MeetSwimmer[]): MeetEntriesPayload {
  const byId = new Map(swimmers.map((s) => [s.id, s]));
  const due = meetPaymentDueAt(meet.entriesConfirmedAt);
  return {
    meet: {
      id: meet.id,
      name: meet.name,
      hostClub: meet.hostClub,
      meetType: meet.meetType,
      startDate: meet.startDate,
      endDate: meet.endDate,
      location: meet.location,
      course: meet.course,
      status: meet.status,
      isTestData: meet.isTestData,
      entriesConfirmedAt: meet.entriesConfirmedAt,
      paymentDueAt: due,
    },
    catalog: (meet.events || []).map((event) => ({
      id: event.id,
      eventNumber: event.eventNumber,
      sessionName: event.sessionName,
      label: eventLabel(event),
    })),
    entries: commitments.map((c) => serializeMeetEntry(meet, c, byId.get(c.swimmerId))),
  };
}

export interface MeetPaymentRow {
  meetId: string;
  meetName: string;
  hostClub: string;
  startDate: string;
  endDate: string;
  isTestData: boolean;
  swimmerId: string;
  swimmerName: string;
  finalFee: number;
  paymentStatus: NonNullable<MeetCommitment["paymentStatus"]>;
  paymentDueAt?: string;
  overdue: boolean;
  paidAt?: string;
  paymentReportedAt?: string;
  events: MeetEntryEvent[];
}

export function serializeMeetPayments(opts: {
  meet: Meet;
  commitments: MeetCommitment[];
  swimmers: MeetSwimmer[];
  nowIso?: string;
}): MeetPaymentRow[] {
  const byId = new Map(opts.swimmers.map((s) => [s.id, s]));
  const rows: MeetPaymentRow[] = [];
  for (const c of opts.commitments) {
    if (c.attendance !== "attend") continue;
    if (parentEventLabel(opts.meet.status) !== "confirmed") continue;
    const fee = c.finalFee || 0;
    if (fee <= 0) continue;
    const entry = serializeMeetEntry(opts.meet, c, byId.get(c.swimmerId));
    const status = c.paymentStatus || "invoice_ready";
    rows.push({
      meetId: opts.meet.id,
      meetName: opts.meet.name,
      hostClub: opts.meet.hostClub,
      startDate: opts.meet.startDate,
      endDate: opts.meet.endDate,
      isTestData: opts.meet.isTestData,
      swimmerId: c.swimmerId,
      swimmerName: `${entry.firstName} ${entry.lastName}`.trim() || c.swimmerId,
      finalFee: fee,
      paymentStatus: status,
      paymentDueAt: entry.paymentDueAt,
      overdue: status !== "paid" && isMeetPaymentOverdue(entry.paymentDueAt, opts.nowIso),
      paidAt: c.paidAt,
      paymentReportedAt: c.paymentReportedAt,
      events: entry.finalEvents,
    });
  }
  return rows;
}
