import type { EligibilityStatus, InvitationStatus, Meet, MeetEvent, MeetGender, MeetSwimmer } from "./types";

export function ageOnDate(dateOfBirth: string, onDate: string): number {
  const dob = parseYmd(dateOfBirth);
  const day = parseYmd(onDate);
  if (!dob || !day) return -1;
  let age = day.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = day.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && day.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const alt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (alt) return new Date(Date.UTC(Number(alt[3]), Number(alt[1]) - 1, Number(alt[2])));
  return null;
}

export function normalizeGender(raw?: string | null): MeetGender | "unknown" {
  const v = (raw || "").trim().toLowerCase();
  if (["m", "male", "boy", "b"].includes(v)) return "male";
  if (["f", "female", "girl", "g"].includes(v)) return "female";
  if (["x", "mixed", "open"].includes(v)) return "mixed";
  return "unknown";
}

export function eventMatchesSwimmer(event: MeetEvent, age: number, gender: MeetGender | "unknown"): boolean {
  if (age < 0) return false;
  const min = Number.isFinite(event.minAge) ? event.minAge : 0;
  const max = Number.isFinite(event.maxAge) && event.maxAge > 0 ? event.maxAge : 109;
  if (age < min || age > max) return false;
  if (event.gender === "mixed") return true;
  if (gender === "unknown") return true;
  return event.gender === gender;
}

export function eventsForSwimmer(meet: Meet, swimmer: MeetSwimmer): MeetEvent[] {
  const age = ageOnDate(swimmer.childDateOfBirth, meet.startDate);
  const gender = normalizeGender(swimmer.childGender);
  return (meet.events || []).filter((event) => eventMatchesSwimmer(event, age, gender));
}

export function detectInvitationRequired(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("this meet is an invitational") || t.includes("entries received without an invitation")) {
    return true;
  }
  return /\binvitational\b/.test(t) && /invitation/.test(t);
}

export function extractEligibilityNotes(announcementText: string): string[] {
  const notes: string[] = [];
  const text = announcementText || "";
  if (detectInvitationRequired(text)) {
    notes.push("Invitational — Prime must be invited or the host will reject entries.");
  }
  if (/usa swimming/i.test(text) && /registered|membership|article 302/i.test(text)) {
    notes.push("USA Swimming + PNS membership required before the first day of the meet.");
  }
  if (/age groups are based on the age of the swimmer as of the first day/i.test(text)) {
    notes.push("Age groups are based on the swimmer’s age on the first day of the meet.");
  }
  if (/qualifying time|must have met the listed minimum/i.test(text)) {
    notes.push("Qualifying times apply. Coach/admin will confirm before host confirmation.");
  }
  if (/nt entries will not be accepted|no time/i.test(text) && /will not/i.test(text)) {
    notes.push("NT entries may not be accepted.");
  }
  return notes;
}

export function inferInvitationStatus(announcementText: string): InvitationStatus {
  const text = announcementText || "";
  if (detectInvitationRequired(text) || /\binvitational\b/i.test(text)) return "not_requested";
  if (/open to all swimmers|domiciled within pacific northwest/i.test(text)) return "not_required";
  // PNS titles like "SSCD Autumn Open" / "UPAC Fall Open" are usually open/approved meets.
  // Only trust this when the announcement does not also say invitational.
  if (/\bopen\b/i.test(text)) return "not_required";
  return "not_requested";
}

export function inferEligibilityStatus(announcementText: string): EligibilityStatus {
  if (detectInvitationRequired(announcementText)) return "invitation_required";
  if (/qualifying time/i.test(announcementText)) return "qualified_swimmers_only";
  return "likely_eligible";
}

export function swimmerEligibilitySummary(meet: Meet, swimmer: MeetSwimmer): {
  eligibleEventCount: number;
  ageOnMeet: number;
  notes: string[];
  canEnterAnyEvent: boolean;
} {
  const ageOnMeet = ageOnDate(swimmer.childDateOfBirth, meet.startDate);
  const eligible = eventsForSwimmer(meet, swimmer);
  const notes = [...meet.eligibilityNotes];
  if (ageOnMeet >= 0) notes.unshift(`This swimmer will be ${ageOnMeet} on ${meet.startDate}.`);
  if (meet.events.length > 0 && eligible.length === 0) {
    notes.push("Not eligible for any events in the current event file.");
  }
  return {
    eligibleEventCount: eligible.length,
    ageOnMeet,
    notes,
    canEnterAnyEvent: meet.events.length === 0 || eligible.length > 0,
  };
}
