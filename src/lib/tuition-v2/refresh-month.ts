import type { Firestore } from "firebase-admin/firestore";
import { loadInvoices, recalculateInvoices } from "@/lib/tuition-v2/invoice-service";
import { syncActiveSwimmerEnrollmentsIfStale } from "@/lib/tuition-v2/enrollment-service";
import { saveTrainingRoster } from "@/lib/training-roster";
import type { TrainingRosterDoc } from "@/lib/training-roster-types";
import type { TuitionV2Invoice, TuitionV2MonthDoc } from "@/lib/tuition-v2/types";
import { getNextMonth } from "@/lib/tuition-v2/shared-ui";

/** Current calendar month + next month (typical open billing windows). */
export function openBillingMonths(now = new Date()): string[] {
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const next = getNextMonth();
  return cur === next ? [cur] : [cur, next];
}

export function enrollmentIdsMissingInvoices(
  enrollmentIds: string[],
  invoiceSwimmerIds: string[]
): string[] {
  const have = new Set(invoiceSwimmerIds);
  return enrollmentIds.filter((id) => !have.has(id));
}

export type RefreshMonthDerivedOptions = {
  /** Who triggered the refresh (email). */
  actor: string;
  /**
   * Full swimmer roster sync into enrollments. Expensive — only for explicit
   * force-refresh / first open, not every plan save.
   */
  syncRoster?: boolean;
  /** Optional level filter for invoice writes only. */
  levels?: string[];
};

export type RefreshMonthDerivedResult = {
  month: TuitionV2MonthDoc;
  invoices: TuitionV2Invoice[];
  invoiceCount: number;
  levelsFilter: string[] | null;
  roster: TrainingRosterDoc;
};

/**
 * After plan / responses / training-days / session edits, rebuild invoices and
 * the attendance training roster from the same live session math.
 */
export async function refreshMonthDerivedData(
  db: Firestore,
  month: string,
  options: RefreshMonthDerivedOptions
): Promise<RefreshMonthDerivedResult> {
  const invoices = await recalculateInvoices(db, month, {
    levels: options.levels,
    syncRoster: options.syncRoster === true,
  });
  const roster =
    invoices.wroteCount > 0
      ? await saveTrainingRoster(db, month, options.actor)
      : {
          month,
          generatedAt: "",
          generatedBy: options.actor,
          sessionCount: 0,
          slotCount: 0,
          uniqueSwimmerCount: 0,
          slots: [],
        };
  return {
    month: invoices.month,
    invoices: invoices.invoices,
    invoiceCount: invoices.count,
    levelsFilter: invoices.levelsFilter,
    roster,
  };
}

/**
 * Pull new roster members into enrollments, then rebuild invoices only if
 * someone is missing (new swimmer) or the month has never been computed.
 */
export async function ensureMonthInvoicesCurrent(
  db: Firestore,
  month: string,
  actor: string
): Promise<{ invoices: TuitionV2Invoice[]; refreshed: boolean }> {
  const rosterDelta = await syncActiveSwimmerEnrollmentsIfStale(db);
  const existing = await loadInvoices(db, month);
  const rosterChanged =
    rosterDelta.created.length +
      rosterDelta.deactivated.length +
      rosterDelta.levelChanged.length >
    0;
  if (!rosterChanged && existing.length > 0) {
    return { invoices: existing, refreshed: false };
  }
  const refreshed = await refreshMonthDerivedData(db, month, { actor, syncRoster: false });
  return { invoices: refreshed.invoices, refreshed: true };
}
