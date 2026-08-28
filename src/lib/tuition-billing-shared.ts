/** Firestore path: tuition_billing_by_month/{YYYY-MM}/rows/{swimmerId} */

export const TUITION_BILLING_COLLECTION = "tuition_billing_by_month";
export const TUITION_BILLING_ROWS_SUBCOL = "rows";

export type TuitionBillingRow = {
  month: string;
  swimmerId: string;
  swimmerName: string;
  level: string;
  parentName: string;
  parentEmail: string;
  amount: number;
  /** Full tuition before sibling discount, when applicable */
  baseAmount?: number | null;
  siblingDiscountPercent?: number | null;
  siblingDiscountApplied?: boolean;
  practiceText: string;
  dueDate: string;
  /** e.g. ["February 2026"] for the invoice email */
  months: string[];
  afterFeeNote: string;
  paid: boolean;
  paidOn: string | null;
  createdAtMillis?: number;
  updatedAtMillis?: number;
  firstInvoiceSentAtMillis?: number;
  lastSentAtMillis?: number;
  lastEmailKind?: string | null;
  reminder2dSentAtMillis?: number;
  reminder1dSentAtMillis?: number;
  pastDueSentAtMillis?: number;
  lastManualReminderAtMillis?: number;
};

export function billingMonthLabel(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return [label];
}

/** Default tuition due date: 1st of the billed month */
export function defaultDueDateForBilledMonth(ym: string): string {
  return `${ym}-01`;
}

/** Local-midnight day difference from today to YYYY-MM-DD (due date). Negative = overdue. */
export function daysUntilLocalYmd(dueYmd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueYmd);
  if (!m) return null;
  const [, ys, mos, ds] = m;
  const due = new Date(Number(ys), Number(mos) - 1, Number(ds));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (24 * 3600 * 1000));
}

/** Pick email variant from due date (local calendar). Used by billing send (auto) and admin UI preview. */
export function pickBillingVariantByDueDate(dueYmd: string): {
  variant: "invoice" | "reminder" | "past_due";
  daysUntilDue?: number;
} {
  const du = daysUntilLocalYmd(dueYmd);
  if (du === null) return { variant: "invoice" };
  if (du < 0) return { variant: "past_due" };
  if (du <= 2) return { variant: "reminder", daysUntilDue: du };
  return { variant: "invoice" };
}

export function billingVariantPreviewLabel(
  dueYmd: string
): { variant: "invoice" | "reminder" | "past_due"; label: string } {
  const { variant, daysUntilDue } = pickBillingVariantByDueDate(dueYmd);
  if (variant === "past_due") return { variant, label: "Past due" };
  if (variant === "reminder") {
    const days =
      typeof daysUntilDue === "number"
        ? daysUntilDue === 0
          ? "today"
          : `${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} left`
        : "";
    return { variant, label: `Reminder (${days})` };
  }
  return { variant, label: "Invoice / due notice" };
}

/** True when current date is in the week ending on last day of month (prep window for invoices). */
export function isBillingPrepWeekForNextMonth(monthBeingBilled: string): boolean {
  const [y, m] = monthBeingBilled.split("-").map(Number);
  const firstOfBillMonth = new Date(y, m - 1, 1);
  const lastBefore = new Date(firstOfBillMonth.getTime());
  lastBefore.setDate(lastBefore.getDate() - 1);
  const startWindow = new Date(lastBefore.getFullYear(), lastBefore.getMonth(), lastBefore.getDate() - 6);
  startWindow.setHours(0, 0, 0, 0);
  lastBefore.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= startWindow && today <= lastBefore;
}
