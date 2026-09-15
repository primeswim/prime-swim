import { attendingHostEntries, canBuildHostSd3, type MeetEntriesPayload, type MeetEntryEvent, type MeetEntryExport } from "./entries";
import type { MeetCourse, MeetGender, MeetStroke } from "./types";

const TEAM_CODE = "PNPRIM";
const TEAM_NAME = "Prime Swim Academy";
const TEAM_ABBR = "PRIME";

function pad(value: string, len: number, align: "left" | "right" = "left"): string {
  const text = String(value ?? "").slice(0, len);
  return align === "right" ? text.padStart(len, " ") : text.padEnd(len, " ");
}

function rec(fields: Array<{ start: number; len: number; value: string; align?: "left" | "right" }>): string {
  const chars = Array.from({ length: 160 }, () => " ");
  for (const field of fields) {
    const slice = pad(field.value, field.len, field.align || "left");
    for (let i = 0; i < slice.length && field.start - 1 + i < 160; i++) {
      chars[field.start - 1 + i] = slice[i];
    }
  }
  return chars.join("") + "\r\n";
}

function mdY(iso?: string): string {
  const ymd = (iso || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return "        ";
  return `${m[2]}${m[3]}${m[1]}`;
}

function sdifName(last: string, first: string): string {
  const clean = (value: string) => value.replace(/^\[TEST\]\s*/i, "").replace(/,/g, " ").trim().toUpperCase();
  const family = clean(last);
  const given = clean(first);
  if (!family && !given) return "SWIMMER";
  return family ? `${family}, ${given}`.trim() : given;
}

function sex(gender?: string): string {
  const v = (gender || "").toLowerCase();
  if (v === "male" || v === "m" || v === "boy") return "M";
  if (v === "female" || v === "f" || v === "girl") return "F";
  return "M";
}

function eventSex(gender: MeetGender): string {
  if (gender === "male") return "M";
  if (gender === "female") return "F";
  return "X";
}

function strokeCode(stroke: MeetStroke, isRelay?: boolean): string {
  if (isRelay) return stroke === "im" ? "7" : "6";
  if (stroke === "free") return "1";
  if (stroke === "back") return "2";
  if (stroke === "breast") return "3";
  if (stroke === "fly") return "4";
  if (stroke === "im") return "5";
  return "1";
}

function courseCode(course: MeetCourse): string {
  if (course === "scm") return "S";
  if (course === "lcm") return "L";
  return "Y";
}

function ageCode(minAge: number, maxAge: number): string {
  const low = !minAge || minAge <= 0 ? "UN" : String(Math.min(minAge, 99)).padStart(2, "0");
  const high = !maxAge || maxAge >= 109 ? "OV" : String(Math.min(maxAge, 99)).padStart(2, "0");
  return `${low}${high}`;
}

function meetTypeCode(meetType: MeetEntriesPayload["meet"]["meetType"]): string {
  if (meetType === "championship") return "3";
  if (meetType === "invitational") return "1";
  return "B";
}

function usa12(id?: string): string {
  return (id || "").replace(/\s+/g, "").slice(0, 12);
}

function usa14(id?: string): string {
  return (id || "").replace(/\s+/g, "").slice(0, 14);
}

function d0(entry: MeetEntryExport, event: MeetEntryEvent, meet: MeetEntriesPayload["meet"], age: string): string {
  return rec([
    { start: 1, len: 2, value: "D0" },
    { start: 3, len: 1, value: "1" },
    { start: 12, len: 28, value: sdifName(entry.lastName, entry.firstName) },
    { start: 40, len: 12, value: usa12(entry.usaSwimmingId) },
    { start: 52, len: 1, value: "A" },
    { start: 53, len: 3, value: "USA" },
    { start: 56, len: 8, value: mdY(entry.birthDate) },
    { start: 64, len: 2, value: age, align: "right" },
    { start: 66, len: 1, value: sex(entry.gender) },
    { start: 67, len: 1, value: eventSex(event.gender) },
    { start: 68, len: 4, value: String(event.distance || 0), align: "right" },
    { start: 72, len: 1, value: strokeCode(event.stroke, event.isRelay) },
    { start: 73, len: 4, value: String(event.eventNumber || 0), align: "right" },
    { start: 77, len: 4, value: ageCode(event.minAge, event.maxAge) },
    { start: 81, len: 8, value: mdY(meet.startDate) },
    { start: 89, len: 8, value: "NT" },
    { start: 97, len: 1, value: courseCode(event.course || meet.course) },
  ]);
}

function d3(entry: MeetEntryExport): string {
  return rec([
    { start: 1, len: 2, value: "D3" },
    { start: 3, len: 14, value: usa14(entry.usaSwimmingId) },
    { start: 17, len: 15, value: sdifName("", entry.firstName).replace(/^, /, "") },
  ]);
}

function ageOnMeet(birthDate: string | undefined, startDate: string): string {
  const birth = (birthDate || "").slice(0, 10);
  const meet = (startDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(meet)) return "  ";
  let age = Number(meet.slice(0, 4)) - Number(birth.slice(0, 4));
  if (meet.slice(5) < birth.slice(5)) age -= 1;
  return String(Math.max(0, age));
}

/** Standard SD3 for Meet Manager File → Import → Entries. Same file TeamUnify "Save Standard SD3" produces. */
export function hostEntrySd3(payload: MeetEntriesPayload): string {
  if (!canBuildHostSd3(payload)) {
    throw new Error("Cannot build SD3 until attending swimmers have official events from the host Event File.");
  }
  const meet = payload.meet;
  const created = mdY(new Date().toISOString());
  const splash: Array<{ entry: MeetEntryExport; event: MeetEntryEvent }> = [];
  for (const entry of attendingHostEntries(payload)) {
    for (const event of entry.finalEvents) {
      if (event.isRelay) continue;
      splash.push({ entry, event });
    }
  }
  const swimmerIds = [...new Set(splash.map((row) => row.entry.swimmerId))];
  const lines = [
    rec([
      { start: 1, len: 2, value: "A0" },
      { start: 3, len: 1, value: "1" },
      { start: 4, len: 8, value: "V3" },
      { start: 12, len: 2, value: "01" },
      { start: 44, len: 20, value: "Prime Swim Academy" },
      { start: 64, len: 10, value: "1.0" },
      { start: 74, len: 20, value: "Prime Swim entries" },
      { start: 94, len: 12, value: "0000000000" },
      { start: 106, len: 8, value: created },
      { start: 156, len: 2, value: "PN" },
    ]),
    rec([
      { start: 1, len: 2, value: "B1" },
      { start: 3, len: 1, value: "1" },
      { start: 12, len: 30, value: meet.name.replace(/^\[TEST\]\s*/i, "") },
      { start: 86, len: 20, value: meet.location || "TBD" },
      { start: 118, len: 3, value: "USA" },
      { start: 121, len: 1, value: meetTypeCode(meet.meetType) },
      { start: 122, len: 8, value: mdY(meet.startDate) },
      { start: 130, len: 8, value: mdY(meet.endDate || meet.startDate) },
      { start: 150, len: 1, value: courseCode(meet.course) },
    ]),
    rec([
      { start: 1, len: 2, value: "C1" },
      { start: 3, len: 1, value: "1" },
      { start: 12, len: 6, value: TEAM_CODE },
      { start: 18, len: 30, value: TEAM_NAME },
      { start: 48, len: 16, value: TEAM_ABBR },
      { start: 140, len: 3, value: "USA" },
    ]),
    rec([
      { start: 1, len: 2, value: "C2" },
      { start: 3, len: 1, value: "1" },
      { start: 12, len: 6, value: TEAM_CODE },
      { start: 18, len: 30, value: "Meet entries" },
      { start: 60, len: 6, value: String(splash.length), align: "right" },
      { start: 66, len: 6, value: String(swimmerIds.length), align: "right" },
      { start: 89, len: 16, value: TEAM_ABBR },
    ]),
  ];
  let lastSwimmer = "";
  for (const row of splash) {
    lines.push(d0(row.entry, row.event, meet, ageOnMeet(row.entry.birthDate, meet.startDate)));
    if (row.entry.swimmerId !== lastSwimmer) {
      lines.push(d3(row.entry));
      lastSwimmer = row.entry.swimmerId;
    }
  }
  lines.push(
    rec([
      { start: 1, len: 2, value: "Z0" },
      { start: 3, len: 1, value: "1" },
      { start: 12, len: 2, value: "01" },
      { start: 14, len: 30, value: "Prime Swim Academy entries" },
      { start: 44, len: 3, value: "1", align: "right" },
      { start: 47, len: 3, value: "1", align: "right" },
      { start: 50, len: 4, value: "2", align: "right" },
      { start: 54, len: 4, value: "1", align: "right" },
      { start: 58, len: 6, value: String(splash.length), align: "right" },
      { start: 64, len: 6, value: String(swimmerIds.length), align: "right" },
    ])
  );
  return lines.join("");
}
