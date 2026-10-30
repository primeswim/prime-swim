import { createHash } from "node:crypto";
import type { PnsScanMeet, PnsScanResult } from "./service";

export type PendingPnsAlert = PnsScanMeet & { kind: "created" | "updated" };
export type PnsSyncStatus = {
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastError?: string | null;
  lastResult?: PnsScanResult;
  notificationStatus?: "quiet" | "sent" | "failed";
  notificationError?: string | null;
  lastNotifiedAt?: string;
  notifiedKeys?: string[];
  pendingAlerts?: PendingPnsAlert[];
};
function alertKey(alert: PendingPnsAlert): string {
  return `${alert.id}:${alert.revision || JSON.stringify([alert.name, [...alert.diffs].sort()])}`;
}
export interface PnsSyncDependencies {
  scan(): Promise<PnsScanResult>;
  readStatus(): Promise<PnsSyncStatus>;
  saveStatus(status: Partial<PnsSyncStatus>): Promise<void>;
  sendAlert(stats: PnsScanResult, idempotencyKey: string): Promise<void>;
  now?: () => string;
}
/** Persist pending notifications before sending, so delivery failures can be retried. */
export async function runPnsSync(deps: PnsSyncDependencies) {
  const now = deps.now ?? (() => new Date().toISOString());
  const previous = await deps.readStatus();
  await deps.saveStatus({ lastStartedAt: now() });
  let stats: PnsScanResult;
  try { stats = await deps.scan(); }
  catch (error) {
    await deps.saveStatus({lastFailedAt: now(), lastError: error instanceof Error ? error.message : "PNS scan failed"});
    throw error;
  }
  const notified = new Set(previous.notifiedKeys ?? []);
  const candidates = new Map<string, PendingPnsAlert>();
  for (const alert of [...(previous.pendingAlerts ?? []),
    ...stats.createdMeets.map(m=>({...m,kind:"created" as const})),
    ...stats.updatedMeets.map(m=>({...m,kind:"updated" as const}))]) {
    if (!notified.has(alertKey(alert))) candidates.set(alertKey(alert), alert);
  }
  const pendingAlerts = [...candidates.values()];
  await deps.saveStatus({lastSucceededAt: now(), lastError: null, lastResult: stats, pendingAlerts});
  if (!pendingAlerts.length) {
    await deps.saveStatus({notificationStatus: "quiet", notificationError: null});
    return {...stats, notification: "quiet" as const};
  }
  const createdMeets = pendingAlerts.filter(m=>m.kind==="created");
  const updatedMeets = pendingAlerts.filter(m=>m.kind==="updated");
  const alertStats = {...stats, created:createdMeets.length, updated:updatedMeets.length, createdMeets,updatedMeets};
  const key = `pns-${createHash("sha256").update([...candidates.keys()].sort().join("\n")).digest("hex")}`;
  try {
    await deps.sendAlert(alertStats, key);
    for (const token of candidates.keys()) notified.add(token);
    await deps.saveStatus({notificationStatus:"sent",notificationError:null,lastNotifiedAt:now(),
      notifiedKeys:[...notified].slice(-1000),pendingAlerts:[]});
    return {...stats, notification: "sent" as const};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin notification failed";
    await deps.saveStatus({notificationStatus:"failed",notificationError:message});
    return {...stats,notification:"failed" as const,notificationError:message};
  }
}
