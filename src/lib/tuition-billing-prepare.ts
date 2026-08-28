import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { TuitionCalculateRow } from "@/lib/tuition-calculate";
import {
  TUITION_BILLING_COLLECTION,
  TUITION_BILLING_ROWS_SUBCOL,
  billingMonthLabel,
  defaultDueDateForBilledMonth,
} from "@/lib/tuition-billing-shared";
import { SIBLING_TUITION_DISCOUNT_PERCENT } from "@/lib/swimmer-siblings";

export type PrepareBillingCounts = {
  created: number;
  updated: number;
  skipped: number;
  totalRows: number;
};

function siblingFieldsFromCalc(r: {
  tuition: number;
  baseTuition?: number;
  siblingDiscountApplied?: boolean;
  siblingDiscountPercent?: number;
}) {
  if (!r.siblingDiscountApplied) {
    return {
      siblingDiscountApplied: false,
      baseAmount: null,
      siblingDiscountPercent: null,
    };
  }
  return {
    siblingDiscountApplied: true,
    baseAmount: r.baseTuition ?? r.tuition,
    siblingDiscountPercent: r.siblingDiscountPercent ?? SIBLING_TUITION_DISCOUNT_PERCENT,
  };
}

/** Normalize rows sent from the Calculate Tuition UI preview. */
export function normalizeClientCalculateRows(raw: unknown): TuitionCalculateRow[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionCalculateRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const swimmerId = String(r.swimmerId || "").trim();
    if (!swimmerId) continue;
    const tuition = typeof r.tuition === "number" ? r.tuition : Number(r.tuition);
    if (!Number.isFinite(tuition) || tuition < 0) continue;
    const scheduleLines = Array.isArray(r.scheduleLines)
      ? r.scheduleLines.map((line) => String(line))
      : [];
    out.push({
      swimmerId,
      swimmerName: String(r.swimmerName || swimmerId),
      level: String(r.level || ""),
      parentName: String(r.parentName || ""),
      parentEmail: String(r.parentEmail || ""),
      trainingWeekdays: Array.isArray(r.trainingWeekdays)
        ? r.trainingWeekdays.filter((n): n is number => typeof n === "number")
        : [],
      sessionCount: typeof r.sessionCount === "number" ? r.sessionCount : 0,
      ratePerHour: typeof r.ratePerHour === "number" ? r.ratePerHour : 0,
      tuition: Math.round(tuition),
      baseTuition: typeof r.baseTuition === "number" ? r.baseTuition : undefined,
      siblingDiscountPercent:
        typeof r.siblingDiscountPercent === "number" ? r.siblingDiscountPercent : undefined,
      siblingDiscountApplied: r.siblingDiscountApplied === true,
      scheduleLines,
      timeSlot: String(r.timeSlot || ""),
      location: String(r.location || ""),
      needsConfig: r.needsConfig === true,
    });
  }
  return out;
}

/** @deprecated Use applyTuitionOverridesMap with TuitionOverridesMap */
export function applyPreviewTuitionOverrides(
  calculated: TuitionCalculateRow[],
  previewRows: TuitionCalculateRow[]
): TuitionCalculateRow[] {
  if (previewRows.length === 0) return calculated;
  const byId = new Map(previewRows.map((r) => [r.swimmerId, r]));
  return calculated.map((row) => {
    const saved = byId.get(row.swimmerId);
    if (!saved) return row;
    return {
      ...row,
      tuition: saved.tuition,
      baseTuition: saved.baseTuition,
      siblingDiscountApplied: saved.siblingDiscountApplied,
      siblingDiscountPercent: saved.siblingDiscountPercent,
    };
  });
}

export async function upsertBillingRowsFromCalculate(
  db: Firestore,
  month: string,
  results: TuitionCalculateRow[],
  options: { overwriteUnpaidComputed: boolean }
): Promise<PrepareBillingCounts> {
  const monthParent = billingMonthLabel(month);
  const defaultDue = defaultDueDateForBilledMonth(month);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const col = db.collection(TUITION_BILLING_COLLECTION).doc(month).collection(TUITION_BILLING_ROWS_SUBCOL);

  for (const r of results) {
    const ref = col.doc(r.swimmerId);
    const existing = await ref.get();
    const practiceText = r.scheduleLines.join("\n");
    const siblingFields = siblingFieldsFromCalc(r);

    if (!existing.exists) {
      await ref.set({
        month,
        swimmerName: r.swimmerName,
        level: r.level,
        parentName: r.parentName,
        parentEmail: r.parentEmail,
        amount: r.tuition,
        ...siblingFields,
        practiceText,
        dueDate: defaultDue,
        months: monthParent,
        afterFeeNote: "",
        paid: false,
        paidOn: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created += 1;
      continue;
    }

    const d = existing.data()!;
    if (d.paid === true) {
      skipped += 1;
      continue;
    }

    if (options.overwriteUnpaidComputed) {
      await ref.update({
        swimmerName: r.swimmerName,
        level: r.level,
        parentName: r.parentName,
        parentEmail: r.parentEmail || d.parentEmail,
        amount: r.tuition,
        ...siblingFields,
        practiceText,
        months: monthParent,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { created, updated, skipped, totalRows: results.length };
}
