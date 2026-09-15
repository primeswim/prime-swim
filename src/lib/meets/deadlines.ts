const TZ = "America/Los_Angeles";

export function effectiveHostDeadline(input: {
  hostConfirmedDeadline?: string;
  announcementEntryDeadline?: string;
  pnsPublishedDeadline?: string;
}): string | undefined {
  return input.hostConfirmedDeadline || input.announcementEntryDeadline || input.pnsPublishedDeadline;
}

export function suggestPrimeDeadline(effectiveHost: string | undefined, daysBefore = 7): string | undefined {
  if (!effectiveHost) return undefined;
  const datePart = effectiveHost.slice(0, 10);
  const d = new Date(`${datePart}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() - daysBefore);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59:00`;
}

export function deadlineConflict(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a.slice(0, 10) !== b.slice(0, 10);
}

export function defaultTimezone(): string {
  return TZ;
}

export function pacificYmd(nowIso?: string): string {
  if (!nowIso) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(nowIso)) return nowIso;
  if (!/Z|[+-]\d{2}:\d{2}$/.test(nowIso)) return nowIso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowIso));
}

/** Families can RSVP through the Prime Deadline calendar day. RSVP closes the next Pacific day. */
export function isPrimeDeadlinePassed(deadline?: string, nowIso?: string): boolean {
  if (!deadline) return false;
  const deadlineDay = deadline.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDay)) return false;
  return pacificYmd(nowIso) > deadlineDay;
}

export const DEFAULT_MEET_PAYMENT_DAYS = 7;

export function addCalendarDays(ymdOrIso: string, days: number): string {
  const ymd = ymdOrIso.slice(0, 10);
  const [year, month, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Invoice due date: one Pacific week after Admin shows confirmed events to families. */
export function meetPaymentDueAt(entriesConfirmedAt?: string, days = DEFAULT_MEET_PAYMENT_DAYS): string | undefined {
  if (!entriesConfirmedAt) return undefined;
  return `${addCalendarDays(pacificYmd(entriesConfirmedAt), days)}T23:59:00`;
}

export function isMeetPaymentOverdue(dueAt?: string, nowIso?: string): boolean {
  if (!dueAt) return false;
  return pacificYmd(nowIso) > dueAt.slice(0, 10);
}
