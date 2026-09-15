import type { MeetCourse, MeetEvent, MeetGender, MeetStroke } from "./types";
import { inferSessionName, sessionNameForMeetDay } from "./sessions";

const STROKE_MAP: Record<string, MeetStroke> = {
  A: "free",
  "1": "free",
  FREE: "free",
  FREESTYLE: "free",
  B: "back",
  "2": "back",
  BACK: "back",
  BACKSTROKE: "back",
  C: "breast",
  "3": "breast",
  BREAST: "breast",
  BREASTSTROKE: "breast",
  D: "fly",
  "4": "fly",
  FLY: "fly",
  BUTTERFLY: "fly",
  E: "im",
  "5": "im",
  IM: "im",
  MEDLEY: "im",
};

const GENDER_MAP: Record<string, MeetGender> = {
  M: "male",
  B: "male",
  F: "female",
  G: "female",
  W: "female",
  X: "mixed",
  MIXED: "mixed",
  OPEN: "mixed",
};

function parseStroke(raw: string): MeetStroke {
  return STROKE_MAP[(raw || "").trim().toUpperCase()] || "unknown";
}

function parseGender(raw: string): MeetGender {
  return GENDER_MAP[(raw || "").trim().toUpperCase()] || "mixed";
}

function parseCourse(raw: string): MeetCourse {
  const v = (raw || "").trim().toUpperCase();
  if (v === "Y" || v === "SCY" || v === "YO" || v === "2" || v.startsWith("Y")) return "scy";
  if (v === "S" || v === "M" || v === "SCM" || v === "1" || v.startsWith("S")) return "scm";
  if (v === "L" || v === "LCM" || v === "LSY" || v === "3" || v.startsWith("L")) return "lcm";
  return "unknown";
}

function normalizeAge(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function looksLikeEv3(headerLine: string, rest: string[]): boolean {
  if (/MEET MANAGER/i.test(headerLine)) return true;
  return rest.some((line) => /\*>\s*$/.test(line));
}

function toYmd(raw: string): string {
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  return raw.trim();
}

export interface ParsedHytekMeet {
  meetName: string;
  startDate: string;
  endDate: string;
  course: MeetCourse;
  location: string;
  events: MeetEvent[];
}

function splitSemi(line: string): string[] {
  return line.replace(/\r$/, "").split(";");
}

function parseEv3EventFile(lines: string[]): ParsedHytekMeet {
  const header = splitSemi(lines[0].replace(/\*>$/, ""));
  if (header.length < 6) throw new Error("EV3 header is not a Hy-Tek meet line.");
  const meetName = header[0] || "Untitled meet";
  const location = header[1] || "";
  const startDate = toYmd(header[2] || "");
  const endDate = toYmd(header[3] || header[2] || "");
  const course = parseCourse(header[5] || header[25] || "");

  const events: MeetEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitSemi(lines[i].replace(/\*>$/, ""));
    if (cols.length < 10) continue;
    const eventNumber = Number(cols[0]);
    if (!Number.isFinite(eventNumber)) continue;
    const eventCode = (cols[1] || String(eventNumber)).trim();
    const sessionNum = Number(cols[3] || 1);
    const isRelay = (cols[4] || "").toUpperCase().startsWith("R");
    const gender = parseGender(cols[5]);
    const minAge = normalizeAge(cols[6], 0);
    const maxAge = normalizeAge(cols[7], 109);
    const distance = Number(cols[8] || 0);
    const stroke = parseStroke(cols[9] || "");
    const feeRaw = cols[14] || "";
    const eventFee = feeRaw && !Number.isNaN(Number(feeRaw)) ? Number(feeRaw) : undefined;
    const eventCourse = parseCourse(cols[25] || "") || course;
    events.push({
      id: `e${eventCode}`,
      eventNumber,
      sessionName: sessionNameForMeetDay(sessionNum, startDate, endDate),
      gender,
      minAge,
      maxAge: maxAge < minAge ? 109 : maxAge,
      distance,
      stroke,
      course: eventCourse === "unknown" ? course : eventCourse,
      eventFee,
      isRelay,
    });
  }
  if (!events.length) throw new Error("No parseable events in EV3 file.");
  return { meetName, startDate, endDate, course, location, events };
}

export function parseHytekEventFile(content: string): ParsedHytekMeet {
  const lines = content.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("Event file has no events.");

  const header = splitSemi(lines[0].replace(/\*>$/, ""));
  if (header.length < 5) throw new Error("Event file header is not a Hy-Tek meet line.");
  if (looksLikeEv3(lines[0], lines.slice(1))) return parseEv3EventFile(lines);

  const meetName = header[0] || "Untitled meet";
  const startDate = toYmd(header[1] || "");
  const endDate = toYmd(header[2] || header[1] || "");
  const course = parseCourse(header[4] || "");
  const location = header[5] || "";

  const events: MeetEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitSemi(lines[i].replace(/\*>$/, ""));
    if (cols.length < 8) continue;
    const eventNumber = Number(cols[0]);
    if (!Number.isFinite(eventNumber)) continue;
    const gender = parseGender(cols[2]);
    const isRelay = (cols[3] || "").toUpperCase().startsWith("R");
    const minAge = normalizeAge(cols[4], 0);
    const maxAge = normalizeAge(cols[5], 109);
    const distance = Number(cols[6] || 0);
    const stroke = parseStroke(cols[7] || "");
    const feeRaw = cols[10] || cols[11] || "";
    const eventFee = feeRaw && !Number.isNaN(Number(feeRaw)) ? Number(feeRaw) : undefined;
    events.push({
      id: `e${eventNumber}`,
      eventNumber,
      sessionName: inferSessionName(eventNumber, endDate, startDate),
      gender,
      minAge,
      maxAge: maxAge < minAge ? 109 : maxAge,
      distance,
      stroke,
      course,
      eventFee,
      isRelay,
    });
  }

  if (!events.length) throw new Error("No parseable events in file.");
  return { meetName, startDate, endDate, course, location, events };
}

export function strokeLabel(stroke: MeetStroke | string): string {
  if (stroke === "im") return "IM";
  if (stroke === "unknown" || !stroke) return "Stroke";
  return stroke[0].toUpperCase() + stroke.slice(1);
}

export function genderLabel(gender: MeetGender | string): string {
  if (gender === "female") return "Girls";
  if (gender === "male") return "Boys";
  return "Mixed";
}

/** Hy-Tek stores 0 / 109 as open ends. Show USA Swimming age groups, not "0-10". */
export function ageGroupLabel(minAge: number, maxAge: number): string {
  const noMin = !Number.isFinite(minAge) || minAge <= 0;
  const noMax = !Number.isFinite(maxAge) || maxAge >= 99;
  if (noMin && noMax) return "Open";
  if (noMin) return `${maxAge} & Under`;
  if (noMax) return `${minAge} & Over`;
  if (minAge === maxAge) return `${minAge}`;
  return `${minAge}-${maxAge}`;
}

/** Event without the number, for tables that already have a # column. */
export function eventName(event: Pick<MeetEvent, "gender" | "minAge" | "maxAge" | "distance" | "stroke" | "isRelay">): string {
  const parts = [
    genderLabel(event.gender),
    ageGroupLabel(event.minAge, event.maxAge),
    String(event.distance),
    strokeLabel(event.stroke),
  ];
  if (event.isRelay) parts.push("Relay");
  return parts.join(" ");
}

/** Full label, e.g. "#1 Girls 10 & Under 100 Back". */
export function eventLabel(event: MeetEvent): string {
  return `#${event.eventNumber} ${eventName(event)}`;
}

/** Compact label for parent cards, e.g. "50 Fly". */
export function shortEventLabel(event: Pick<MeetEvent, "distance" | "stroke">): string {
  return `${event.distance} ${strokeLabel(event.stroke)}`;
}
