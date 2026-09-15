export function extractFeeHints(announcementText: string): {
  surcharge?: number;
  individualEventFee?: number;
  maxEventsMeet?: number;
  maxEventsBySession?: Record<string, number>;
} {
  const text = announcementText || "";
  const surcharge = /surcharge[:\s]+\$?(\d+(?:\.\d+)?)/i.exec(text);
  const individual = /individual event[:\s]+\$?(\d+(?:\.\d+)?)/i.exec(text);
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

export function computeHostFee(opts: {
  surcharge?: number;
  individualEventFee?: number;
  eventCount: number;
}): { surcharge: number; events: number; total: number } {
  const surcharge = Number(opts.surcharge) || 0;
  const individualEventFee = Number(opts.individualEventFee) || 0;
  const events = Math.max(0, opts.eventCount) * individualEventFee;
  return { surcharge, events, total: surcharge + events };
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
