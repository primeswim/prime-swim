import type { Firestore } from "firebase-admin/firestore";
import { normalizeInvoice } from "@/lib/tuition-v2/invoice-service";
import { normalizeMonthDoc } from "@/lib/tuition-v2/month-service";
import { TUITION_V2_INVOICES_SUBCOL, TUITION_V2_MONTHS_COLLECTION } from "@/lib/tuition-v2/constants";
import {
  parentTuitionCandidateMonths,
  parentTuitionPrepMonth,
  pickParentTuitionForSwimmer,
  toParentTuitionView,
  type ParentTuitionMonthPick,
  type ParentTuitionView,
} from "@/lib/tuition-v2/parent-tuition";

function invoicesCol(db: Firestore, month: string) {
  return db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).collection(TUITION_V2_INVOICES_SUBCOL);
}

export async function loadParentTuitionForSwimmers(
  db: Firestore,
  swimmerIds: string[],
  now = new Date()
): Promise<{
  candidateMonths: string[];
  billingMonth: string;
  bySwimmerId: Record<string, ParentTuitionView>;
}> {
  const candidateMonths = parentTuitionCandidateMonths(now);
  const monthSnaps = await Promise.all(
    candidateMonths.map((m) => db.collection(TUITION_V2_MONTHS_COLLECTION).doc(m).get())
  );
  const monthStatuses = candidateMonths.map((m, i) => normalizeMonthDoc(m, monthSnaps[i].data()).status);

  const ids = swimmerIds.filter((id) => typeof id === "string" && id.trim() && !id.includes("/"));
  const bySwimmerId: Record<string, ParentTuitionView> = {};

  await Promise.all(
    ids.map(async (id) => {
      const snaps = await Promise.all(candidateMonths.map((m) => invoicesCol(db, m).doc(id).get()));
      const packed: ParentTuitionMonthPick[] = candidateMonths.map((m, i) => ({
        month: m,
        monthStatus: monthStatuses[i],
        invoice: normalizeInvoice(id, snaps[i].exists ? snaps[i].data() : undefined),
      }));
      const picked = pickParentTuitionForSwimmer(packed, now);
      bySwimmerId[id] = toParentTuitionView(picked.month, picked.monthStatus, picked.invoice);
    })
  );

  return {
    candidateMonths,
    billingMonth: parentTuitionPrepMonth(now),
    bySwimmerId,
  };
}
