import type { Meet, MeetEvent } from "./types";

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

export function feeForMeetEvents(
  meet: Pick<Meet, "surcharge" | "individualEventFee" | "events" | "announcementText">,
  eventIds: string[]
): { surcharge: number; events: number; total: number } {
  const rates = resolveMeetFeeRates(meet);
  const byId = new Map((meet.events || []).map((event) => [event.id, event]));
  return computeMeetEntryFee({
    surcharge: rates.surcharge,
    individualEventFee: rates.individualEventFee,
    events: eventIds.map((id) => byId.get(id)).filter((event): event is MeetEvent => Boolean(event)),
  });
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
}): boolean {
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
