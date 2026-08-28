import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { TuitionCalculateRow } from "@/lib/tuition-calculate";
import { normalizeClientCalculateRows } from "@/lib/tuition-billing-prepare";

export const TUITION_MONTH_CONFIG_COLLECTION = "tuition_month_config";

/** Compact per-swimmer manual tuition (no schedules or parent info). */
export type TuitionAmountOverride = {
  tuition: number;
  /** Set when admin manually edits tuition on Calculate Tuition */
  manual?: boolean;
  /** @deprecated Legacy auto-saved sibling snapshots — ignored when stale */
  baseTuition?: number;
  siblingDiscountApplied?: boolean;
  siblingDiscountPercent?: number;
};

export type TuitionOverridesMap = Record<string, TuitionAmountOverride>;

export function rowToTuitionOverride(
  row: TuitionCalculateRow,
  options?: { manual?: boolean }
): TuitionAmountOverride {
  return {
    tuition: row.tuition,
    ...(options?.manual ? { manual: true } : {}),
  };
}

export function normalizeTuitionOverridesMap(raw: unknown): TuitionOverridesMap {
  if (!raw || typeof raw !== "object") return {};
  const out: TuitionOverridesMap = {};
  for (const [swimmerId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!swimmerId || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const tuition = typeof v.tuition === "number" ? v.tuition : Number(v.tuition);
    if (!Number.isFinite(tuition) || tuition < 0) continue;
    const entry: TuitionAmountOverride = { tuition: Math.round(tuition) };
    if (typeof v.baseTuition === "number") entry.baseTuition = v.baseTuition;
    if (v.siblingDiscountApplied === true) {
      entry.siblingDiscountApplied = true;
      if (typeof v.siblingDiscountPercent === "number") {
        entry.siblingDiscountPercent = v.siblingDiscountPercent;
      }
    }
    out[swimmerId] = entry;
  }
  return out;
}

/** Build overrides for swimmers manually edited away from the last calculated baseline. */
export function buildTuitionOverridesFromEdits(
  rows: TuitionCalculateRow[],
  baselineById: Map<string, number>,
  editedSwimmerIds: Iterable<string>
): TuitionOverridesMap {
  const out: TuitionOverridesMap = {};
  for (const swimmerId of editedSwimmerIds) {
    const row = rows.find((r) => r.swimmerId === swimmerId);
    if (!row) continue;
    const baseline = baselineById.get(swimmerId);
    if (baseline !== undefined && row.tuition === baseline && !row.siblingDiscountApplied) {
      continue;
    }
    out[swimmerId] = rowToTuitionOverride(row, { manual: true });
  }
  return out;
}

/** True when a saved override should change the freshly calculated row. */
export function shouldApplyTuitionOverride(
  calculated: TuitionCalculateRow,
  saved: TuitionAmountOverride
): boolean {
  // Legacy auto-saved sibling discount snapshots must not block updated policy.
  if (saved.siblingDiscountApplied && !calculated.siblingDiscountApplied) {
    return false;
  }
  if (saved.manual === true) {
    return saved.tuition !== calculated.tuition;
  }
  // Legacy entry with sibling metadata: only apply while discount still active.
  if (saved.siblingDiscountApplied) {
    return (
      calculated.siblingDiscountApplied === true && saved.tuition !== calculated.tuition
    );
  }
  return saved.tuition !== calculated.tuition;
}

export function applyTuitionOverridesMap(
  calculated: TuitionCalculateRow[],
  overrides: TuitionOverridesMap
): TuitionCalculateRow[] {
  const ids = Object.keys(overrides);
  if (ids.length === 0) return calculated;
  return calculated.map((row) => {
    const saved = overrides[row.swimmerId];
    if (!saved || !shouldApplyTuitionOverride(row, saved)) return row;
    return {
      ...row,
      tuition: saved.tuition,
    };
  });
}

function overridesFromLegacyPreviewRows(data: Record<string, unknown> | undefined): TuitionOverridesMap {
  if (!data) return {};
  const rows = normalizeClientCalculateRows(data.previewRows);
  const out: TuitionOverridesMap = {};
  for (const row of rows) {
    out[row.swimmerId] = rowToTuitionOverride(row);
  }
  return out;
}

export function loadTuitionOverridesFromDoc(data: Record<string, unknown> | undefined): TuitionOverridesMap {
  if (!data) return {};
  if (data.tuitionOverrides && typeof data.tuitionOverrides === "object") {
    return normalizeTuitionOverridesMap(data.tuitionOverrides);
  }
  return overridesFromLegacyPreviewRows(data);
}

export async function loadMonthTuitionOverrides(
  db: Firestore,
  month: string
): Promise<TuitionOverridesMap> {
  const snap = await db.collection(TUITION_MONTH_CONFIG_COLLECTION).doc(month).get();
  if (!snap.exists) return {};
  return loadTuitionOverridesFromDoc(snap.data());
}

export async function mergeMonthTuitionOverrides(
  db: Firestore,
  month: string,
  patch: TuitionOverridesMap,
  clearIds: string[] = []
): Promise<TuitionOverridesMap> {
  const ref = db.collection(TUITION_MONTH_CONFIG_COLLECTION).doc(month);
  const snap = await ref.get();
  const current = loadTuitionOverridesFromDoc(snap.data());
  const next = { ...current, ...patch };
  for (const id of clearIds) {
    delete next[id];
  }

  const write: Record<string, unknown> = {
    tuitionOverrides: next,
    tuitionOverridesUpdatedAt: new Date().toISOString(),
    previewRows: FieldValue.delete(),
  };

  await ref.set(write, { merge: true });
  return next;
}

export async function calculateWithSavedTuitionOverrides(
  db: Firestore,
  month: string,
  calculated: TuitionCalculateRow[]
): Promise<TuitionCalculateRow[]> {
  const overrides = await loadMonthTuitionOverrides(db, month);
  return applyTuitionOverridesMap(calculated, overrides);
}
