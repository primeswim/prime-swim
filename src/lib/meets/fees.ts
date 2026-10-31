import type { Meet, MeetEvent, MeetFeeSchedule } from "./types";

export function extractFeeHints(announcementText: string): {
  surcharge?: number;
  individualEventFee?: number;
  maxEventsMeet?: number;
  maxEventsBySession?: Record<string, number>;
} {
  const text = announcementText || "";
  const surcharge = /surcharge[:\s]+\$?\s*(\d+(?:\.\d+)?)/i.exec(text);
  const individual = /individual events?[:\s]+\$?\s*(\d+(?:\.\d+)?)/i.exec(text);
  const meetMax = /up to eight \(8\) events|meet max(?:imum)?[:\s]+(\d+)/i.exec(text);
  const sat = /no more than five \(5\) on saturday|saturday[:\s]+(\d+)/i.exec(text);
  const sun = /three \(3\) events on sunday|sunday[:\s]+(\d+)/i.exec(text);
  const maxEventsBySession: Record<string, number> = {};
  if (sat) maxEventsBySession.Saturday = 5;
  if (sun) maxEventsBySession.Sunday = 3;
  const hints: {
    surcharge?: number;
    individualEventFee?: number;
    maxEventsMeet?: number;
    maxEventsBySession?: Record<string, number>;
  } = {};
  if (surcharge) hints.surcharge = Number(surcharge[1]);
  if (individual) hints.individualEventFee = Number(individual[1]);
  if (meetMax) hints.maxEventsMeet = 8;
  if (Object.keys(maxEventsBySession).length) hints.maxEventsBySession = maxEventsBySession;
  return hints;
}

function money(n?: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function computeMeetEntryFee(opts: {
  surcharge?: number;
  individualEventFee?: number;
  events: Array<{ eventFee?: number }>;
}): { surcharge: number; events: number; total: number } {
  const surcharge = money(opts.surcharge);
  const fallback = money(opts.individualEventFee);
  const events = money(
    opts.events.reduce((sum, event) => {
      const fee = Number(event.eventFee);
      return sum + (Number.isFinite(fee) && fee > 0 ? fee : fallback);
    }, 0)
  );
  return { surcharge, events, total: money(surcharge + events) };
}

export function computeHostFee(opts: {
  surcharge?: number;
  individualEventFee?: number;
  eventCount: number;
}): { surcharge: number; events: number; total: number } {
  return computeMeetEntryFee({
    surcharge: opts.surcharge,
    individualEventFee: opts.individualEventFee,
    events: Array.from({ length: Math.max(0, opts.eventCount) }, () => ({})),
  });
}

export function resolveMeetFeeRates(meet: {
  surcharge?: number;
  individualEventFee?: number;
  announcementText?: string;
}): { surcharge?: number; individualEventFee?: number } {
  const hints = extractFeeHints(meet.announcementText || "");
  return {
    surcharge: Number(meet.surcharge) > 0 ? Number(meet.surcharge) : hints.surcharge,
    individualEventFee: Number(meet.individualEventFee) > 0 ? Number(meet.individualEventFee) : hints.individualEventFee,
  };
}

export function validateFeeSchedule(value: unknown): asserts value is MeetFeeSchedule {
  const s = value as MeetFeeSchedule;
  const validAmount = (n: unknown) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000;
  const validNumbers = (ns: unknown) => Array.isArray(ns) && ns.every(n => Number.isInteger(n) && n > 0);
  if (!s || !["per_event", "flat"].includes(s.mode) || !validAmount(s.flatFee) || s.flatFee < 0 ||
      !Array.isArray(s.eventPrices) || !Array.isArray(s.charges) ||
      s.eventPrices.some(r => !r || typeof r.label !== "string" || !validAmount(r.amount) || r.amount < 0 || !validNumbers(r.eventNumbers) || !r.eventNumbers.length) ||
      s.charges.some(r => !r || typeof r.label !== "string" || !r.label.trim() || !validAmount(r.amount) ||
        !["swimmer", "day", "session", "percent"].includes(r.unit) || (r.eventNumbers != null && !validNumbers(r.eventNumbers)) || (r.swimmerIds != null && (!Array.isArray(r.swimmerIds) || r.swimmerIds.some(id => typeof id !== "string" || !id))))) {
    throw new Error("Enter valid host pricing, amounts, and event numbers.");
  }
  const numbers = s.eventPrices.flatMap(r => r.eventNumbers);
  if (new Set(numbers).size !== numbers.length) throw new Error("An event can have only one price override.");
}

export function feeForMeetEvents(
  meet: Pick<Meet, "surcharge" | "individualEventFee" | "events" | "announcementText"> &
    Partial<Pick<Meet, "feeSchedule" | "sessions" | "startDate" | "endDate">>,
  eventIds: string[],
  swimmerId?: string
): { surcharge: number; events: number; total: number } {
  const rates = resolveMeetFeeRates(meet);
  const selectedIds = new Set(eventIds);
  const selected = (meet.events || []).filter(event => selectedIds.has(event.id));
  const schedule = meet.feeSchedule;
  const fee = computeMeetEntryFee({
    surcharge: rates.surcharge,
    individualEventFee: rates.individualEventFee,
    events: selected.map(event => {
      const override = schedule?.eventPrices.find(r => r.eventNumbers.includes(event.eventNumber));
      // Zero is a valid explicit override (e.g. waived or included events).
      if (override) return { eventFee: override.amount };
      return event;
    }),
  });
  if (!schedule) return fee;
  let eventTotal = schedule.mode === "flat" ? 0 : money(selected.reduce((sum, event) => {
    const override = schedule.eventPrices.find(r => r.eventNumbers.includes(event.eventNumber));
    return sum + (override ? override.amount : event.eventFee != null && event.eventFee > 0 ? event.eventFee : rates.individualEventFee || 0);
  }, 0));
  let extra = money(schedule.mode === "flat" ? schedule.flatFee : 0);
  const base = money(fee.surcharge + eventTotal + extra);
  for (const charge of schedule.charges) {
    if (charge.swimmerIds?.length && (!swimmerId || !charge.swimmerIds.includes(swimmerId))) continue;
    const matched = charge.eventNumbers?.length ? selected.filter(e => charge.eventNumbers!.includes(e.eventNumber)) : selected;
    if (charge.eventNumbers?.length && !matched.length) continue;
    let count = 1;
    if (charge.unit === "session") count = new Set(matched.map(e => e.sessionName)).size;
    if (charge.unit === "day") {
      const days = matched.map(e => {
        const session = meet.sessions?.find(s => s.name === e.sessionName || s.id === e.sessionName);
        return session?.date?.slice(0, 10) || (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(e.sessionName) ? e.sessionName.toLowerCase() : undefined) ||
          (meet.startDate === meet.endDate ? meet.startDate?.slice(0, 10) : undefined);
      });
      if (days.some(d => !d)) throw new Error("Assign dates to sessions before using per-day host fees.");
      count = new Set(days).size;
    }
    extra += charge.unit === "percent" ? money(base * charge.amount / 100) : money(charge.amount * count);
  }
  eventTotal = money(eventTotal);
  return { surcharge: money(fee.surcharge + extra), events: eventTotal, total: Math.max(0, money(fee.surcharge + extra + eventTotal)) };
}

export function typicalIndividualEventFee(events: Array<{ eventFee?: number; isRelay?: boolean }>): number | undefined {
  const fees = events
    .filter((event) => !event.isRelay)
    .map((event) => Number(event.eventFee))
    .filter((fee) => Number.isFinite(fee) && fee > 0);
  if (!fees.length) return undefined;
  const counts = new Map<number, number>();
  for (const fee of fees) counts.set(fee, (counts.get(fee) || 0) + 1);
  let best = fees[0];
  let bestCount = 0;
  for (const [fee, count] of counts) {
    if (count > bestCount || (count === bestCount && fee < best)) {
      best = fee;
      bestCount = count;
    }
  }
  return best;
}

export function meetHasInvoiceRates(meet: {
  surcharge?: number;
  individualEventFee?: number;
  announcementText?: string;
  events?: Array<{ eventFee?: number }>;
  feeSchedule?: MeetFeeSchedule;
}): boolean {
  if (meet.feeSchedule && (meet.feeSchedule.flatFee > 0 || meet.feeSchedule.charges.some(r => r.amount > 0) || meet.feeSchedule.eventPrices.some(r => r.amount > 0))) return true;
  const rates = resolveMeetFeeRates(meet);
  if (Number(rates.surcharge) > 0 || Number(rates.individualEventFee) > 0) return true;
  return (meet.events || []).some((event) => Number(event.eventFee) > 0);
}

export function exceedsEventLimits(opts: {
  selectedCount: number;
  maxEventsMeet?: number;
  sessionCounts: Record<string, number>;
  maxEventsBySession?: Record<string, number>;
}): { ok: boolean; reason: string } {
  if (opts.maxEventsMeet != null && opts.selectedCount > opts.maxEventsMeet) {
    return { ok: false, reason: `Meet limit is ${opts.maxEventsMeet} events.` };
  }
  for (const [session, count] of Object.entries(opts.sessionCounts)) {
    const max = opts.maxEventsBySession?.[session];
    if (max != null && count > max) {
      return { ok: false, reason: `${session} limit is ${max} events.` };
    }
  }
  return { ok: true, reason: "" };
}
