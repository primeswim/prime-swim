import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { getMeetService } from "./server";
import { adminAlertRecipients, composePnsAdminAlert } from "./pns-notify";
import { runPnsSync, type PnsSyncStatus } from "./pns-sync";

const statusRef = () => adminDb.collection("meet_sync_status").doc("pns");
export async function readPnsSyncStatus(): Promise<PnsSyncStatus> {
  const snap = await statusRef().get();
  return (snap.data() ?? {}) as PnsSyncStatus;
}
export async function runTrackedPnsSync() {
  const ref = statusRef();
  const acquired = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (Number(snap.data()?.leaseUntil || 0) > Date.now()) return false;
    tx.set(ref, {leaseUntil:Date.now()+120_000}, {merge:true});
    return true;
  });
  if (!acquired) throw new Error("A PNS scan is already running. Try again shortly.");
  try {
    return await runPnsSync({
      readStatus: readPnsSyncStatus,
      saveStatus: async patch => { await ref.set(patch, {merge:true}); },
      scan: () => getMeetService().scanLivePns(),
      sendAlert: async (stats,key) => {
        if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
        const message = composePnsAdminAlert(stats,"https://www.primeswimacademy.com/admin/meets");
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
          from:"Prime Swim Academy <noreply@primeswimacademy.com>",
          to:adminAlertRecipients(),subject:message.subject,text:message.text,
        }, {idempotencyKey:key});
        if (result.error) throw new Error(result.error.message);
      },
    });
  } finally { await ref.set({leaseUntil:0},{merge:true}); }
}
