import type { Meet, MeetEvent, MeetSession } from "./types";

export type MeetDayOption = { id: string; label: string };

function ymdDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const date = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function weekdayLong(ymd: string): string {
  const date = ymdDate(ymd);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function weekdayDateLabel(ymd: string): string {
  const date = ymdDate(ymd);
  if (!date) return ymd;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function enumerateMeetDates(startDate: string, endDate?: string): string[] {
  const start = (startDate || "").slice(0, 10);
  const end = (endDate || startDate || "").slice(0, 10);
  const first = ymdDate(start);
  const last = ymdDate(end) || first;
  if (!first || !last) return [];
  const dates: string[] = [];
  const cur = new Date(first);
  while (cur <= last && dates.length < 14) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function sessionIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Hy-Tek HYV often has no weekday; label sessions from the meet's actual dates. */
export function inferSessionName(eventNumber: number, endDate: string, startDate: string): string {
  const startDay = weekdayLong(startDate);
  const endDay = weekdayLong(endDate);
  if (endDate && endDate !== startDate) {
    if (eventNumber >= 26) return endDay || "Day 2";
    return startDay || "Day 1";
  }
  return startDay || "Session 1";
}

/** EV3 session index 1, 2, … mapped onto the meet's actual dates (Saturday, Sunday). */
export function sessionNameForMeetDay(sessionNum: number, startDate: string, endDate: string): string {
  const dates = enumerateMeetDates(startDate, endDate);
  const n = Number.isFinite(sessionNum) && sessionNum > 0 ? sessionNum : 1;
  if (dates.length === 0) return `Session ${n}`;
  const ymd = dates[Math.min(n - 1, dates.length - 1)];
  const day = weekdayLong(ymd);
  if (n > dates.length && day) return `${day} session ${n}`;
  return day || `Session ${n}`;
}

/**
 * Days families can check. TeamUnify/SportsEngine do not assume weekend:
 * they use the meet start/end dates, then session names from the event file.
 */
export function meetDayOptions(
  meet: Pick<Meet, "startDate" | "endDate"> & {
    sessions?: MeetSession[];
    events?: MeetEvent[];
  }
): MeetDayOption[] {
  const dates = enumerateMeetDates(meet.startDate, meet.endDate);
  if (dates.length > 0) {
    return dates.map((ymd) => ({ id: ymd, label: weekdayDateLabel(ymd) }));
  }
  if (meet.sessions && meet.sessions.length > 0) {
    return meet.sessions.map((session) => ({
      id: session.id || sessionIdFromName(session.name),
      label: session.date ? `${session.name} · ${weekdayDateLabel(session.date)}` : session.name,
    }));
  }
  const fromEvents = [...new Set((meet.events || []).map((event) => event.sessionName).filter(Boolean))];
  if (fromEvents.length > 0) {
    return fromEvents.map((name) => ({ id: sessionIdFromName(name), label: name }));
  }
  return [];
}

export function keepValidMeetDayIds(
  meet: Parameters<typeof meetDayOptions>[0],
  ids: string[]
): string[] {
  const valid = new Set(meetDayOptions(meet).map((day) => day.id));
  return ids.filter((id) => valid.has(id));
}

/** True when an attending swimmer must pick days again (none left, or some selected days are gone). */
export function attendingNeedsNewDays(
  meet: Parameters<typeof meetDayOptions>[0],
  commitment: { attendance?: string; availableSessionIds?: string[] }
): boolean {
  if (commitment.attendance !== "attend" && commitment.attendance !== "incomplete") return false;
  const ids = commitment.availableSessionIds || [];
  const kept = keepValidMeetDayIds(meet, ids);
  if (ids.length === 0) return true;
  return kept.length !== ids.length;
}

export type MeetDateStampInfo = {
  month: string;
  day: string;
  endDay?: string;
  year: string;
  rangeLabel: string;
};

/** SMAC-style left date stamp: month bar, big start day, optional end day, year. */
export function meetDateStamp(startDate: string, endDate?: string): MeetDateStampInfo {
  const startYmd = (startDate || "").slice(0, 10);
  const endYmd = (endDate || startDate || "").slice(0, 10);
  const start = ymdDate(startYmd);
  const end = ymdDate(endYmd) || start;
  if (!start) {
    return { month: "", day: startYmd || "TBD", year: "", rangeLabel: startYmd || "Date TBD" };
  }
  const month = start.toLocaleDateString("en-US", { month: "short" });
  const year = String(start.getFullYear());
  const dayNum = start.getDate();
  const day = String(dayNum).padStart(2, "0");
  const sameDay = !end || start.getTime() === end.getTime();
  if (sameDay) {
    return {
      month,
      day,
      year,
      rangeLabel: `${month} ${dayNum}, ${year}`,
    };
  }
  const endDayNum = end.getDate();
  const endDay = String(endDayNum).padStart(2, "0");
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const rangeLabel = sameMonth
    ? `${month} ${dayNum}–${endDayNum}, ${year}`
    : `${month} ${dayNum} – ${end.toLocaleDateString("en-US", { month: "short" })} ${endDayNum}, ${end.getFullYear()}`;
  return { month, day, endDay, year, rangeLabel };
}
