import { eventLabel } from "./hytek-events";
import { isMeetPaymentOverdue, meetPaymentDueAt } from "./deadlines";
import type { Meet, MeetCommitment, MeetCourse, MeetEvent, MeetGender, MeetStroke, MeetSwimmer } from "./types";
import { finalSwimEventIds, parentEventLabel } from "./workflow";
import { weekdayDateLabel } from "./sessions";

export interface MeetEntryEvent {
  id: string;
  eventNumber: number;
  sessionName: string;
  label: string;
  distance: number;
  stroke: MeetStroke;
  gender: MeetGender;
  course: MeetCourse;
  minAge: number;
  maxAge: number;
  isRelay?: boolean;
}

export interface MeetEntryExport {
  swimmerId: string;
  firstName: string;
  lastName: string;
  usaSwimmingId?: string;
  birthDate?: string;
  gender?: string;
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
    distance: event.distance,
    stroke: event.stroke,
    gender: event.gender,
    course: event.course || meet.course,
    minAge: event.minAge,
    maxAge: event.maxAge,
    isRelay: event.isRelay,
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
    birthDate: swimmer?.childDateOfBirth,
    gender: swimmer?.childGender,
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
    catalog: (meet.events || []).map((event: MeetEvent) => ({
      id: event.id,
      eventNumber: event.eventNumber,
      sessionName: event.sessionName,
      label: eventLabel(event),
      distance: event.distance,
      stroke: event.stroke,
      gender: event.gender,
      course: event.course || meet.course,
      minAge: event.minAge,
      maxAge: event.maxAge,
      isRelay: event.isRelay,
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

function dayLabel(id: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return weekdayDateLabel(id);
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function attendingHostEntries(payload: MeetEntriesPayload) {
  return payload.entries.filter((entry) => entry.attendance === "attend");
}

export function canBuildHostSd3(payload: MeetEntriesPayload): boolean {
  return attendingHostEntries(payload).some((entry) => entry.finalEvents.some((event) => !event.isRelay));
}

export function hostPacketFilename(meet: Pick<MeetEntriesPayload["meet"], "name" | "startDate">, ext: "csv" | "txt" | "sd3"): string {
  const slug = (meet.name || "meet")
    .replace(/^\[TEST\]\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `prime-entries-${meet.startDate || "meet"}-${slug || "meet"}.${ext}`;
}

export function hostEntryCsv(payload: MeetEntriesPayload): string {
  const header = [
    "First name",
    "Last name",
    "USA Swimming ID",
    "Attendance",
    "Days",
    "Events",
    "Parent notes",
    "Estimated fee",
  ];
  const rows = attendingHostEntries(payload).map((entry) =>
      [
        entry.firstName,
        entry.lastName,
        entry.usaSwimmingId || "",
        entry.attendance,
        entry.days.map(dayLabel).join("; "),
        entry.finalEvents.map((event) => `${event.sessionName}: ${event.label}`).join("; ") || entry.parentNotes,
        entry.parentNotes,
        entry.estimatedFee != null ? entry.estimatedFee.toFixed(2) : "",
      ]
        .map((cell) => csvCell(String(cell || "")))
        .join(",")
    );
  return [header.join(","), ...rows].join("\n") + "\n";
}

export function hostEntryReportText(payload: MeetEntriesPayload): string {
  const attending = attendingHostEntries(payload);
  const eventCount = attending.reduce((n, entry) => n + entry.finalEvents.length, 0);
  const lines = [
    "PRIME SWIM ACADEMY — MEET ENTRY REPORT",
    payload.meet.name.replace(/^\[TEST\]\s*/i, ""),
    `Host: ${payload.meet.hostClub || "TBD"}`,
    `Dates: ${payload.meet.startDate}${payload.meet.endDate && payload.meet.endDate !== payload.meet.startDate ? ` – ${payload.meet.endDate}` : ""}`,
    payload.meet.location ? `Location: ${payload.meet.location}` : "",
    "",
    attending.length
      ? `${attending.length} swimmer${attending.length === 1 ? "" : "s"}, ${eventCount} individual event${eventCount === 1 ? "" : "s"}.`
      : "No Prime swimmers have Attended.",
    "",
  ];
  attending.forEach((entry, index) => {
    lines.push(`${index + 1}. ${`${entry.firstName} ${entry.lastName}`.trim() || entry.swimmerId}`);
    lines.push(`   USA Swimming ID: ${entry.usaSwimmingId || "on file"}`);
    if (entry.days.length) lines.push(`   Days: ${entry.days.map(dayLabel).join(", ")}`);
    if (entry.finalEvents.length) {
      const bySession = new Map<string, string[]>();
      for (const event of entry.finalEvents) {
        const list = bySession.get(event.sessionName) || [];
        list.push(event.label);
        bySession.set(event.sessionName, list);
      }
      for (const [session, events] of bySession) {
        lines.push(`   ${session}: ${events.join("; ")}`);
      }
    } else if (entry.parentNotes) {
      lines.push(`   Requested (no event file yet): ${entry.parentNotes}`);
    } else {
      lines.push("   Events: host event file not posted — no official events yet");
    }
    if (entry.parentNotes) lines.push(`   Notes: ${entry.parentNotes}`);
    lines.push("");
  });
  lines.push("Please confirm these entries or list any cuts. Prime Swim Academy, prime.swim.us@gmail.com");
  return lines.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n").trim() + "\n";
}
