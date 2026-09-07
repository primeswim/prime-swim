import { monthLabel } from "@/lib/tuition-v2/shared-ui";
import type { TuitionV2Invoice, TuitionV2MonthStatus } from "@/lib/tuition-v2/types";

export type ParentTuitionStatus = "calculating" | "ready" | "paid";

export type ParentTuitionView = {
  month: string;
  monthLabel: string;
  status: ParentTuitionStatus;
  statusLabel: string;
  amount: number | null;
  dueDate: string | null;
  paid: boolean;
  practiceText: string | null;
};

export type ParentTuitionInvoiceHint = Pick<
  TuitionV2Invoice,
  "emailStatus" | "firstInvoiceSentAt" | "paid" | "publishedToApp"
> | null;

function ymFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Previous, current, and next calendar months (oldest → newest). */
export function parentTuitionCandidateMonths(now = new Date()): string[] {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return [ymFromDate(prev), ymFromDate(cur), ymFromDate(next)];
}

/**
 * Month shown as 核算中 when nothing is published yet.
 * From the 15th onward, the upcoming month is the active billing cycle.
 */
export function parentTuitionPrepMonth(now = new Date()): string {
  if (now.getDate() >= 15) {
    return ymFromDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  }
  return ymFromDate(now);
}

export function isMonthPublishedToApp(status: string | undefined): boolean {
  return status === "approved" || status === "sent" || status === "closed";
}

/**
 * Per-invoice app visibility. New invoices and docs without the flag stay
 * 核算中 until staff Publish or Send. Month-level approved/sent does not
 * unlock unpublished kids.
 */
export function isInvoicePublishedToApp(invoice: ParentTuitionInvoiceHint): boolean {
  return invoice?.publishedToApp === true;
}

/** Recalc keeps In app only when billing is unchanged and already published. */
export function keepPublishedToAppAfterRecalc(
  existing: { publishedToApp?: boolean } | undefined,
  billingUnchanged: boolean
): boolean {
  return !!existing && billingUnchanged && existing.publishedToApp === true;
}

export function invoiceNeedsAppPublish(invoice: ParentTuitionInvoiceHint): boolean {
  return !!invoice && !isInvoicePublishedToApp(invoice);
}

function filterInvoices(
  invoices: TuitionV2Invoice[],
  filter: { swimmerIds?: string[]; levels?: string[] } = {}
): TuitionV2Invoice[] {
  const idSet = filter.swimmerIds?.length ? new Set(filter.swimmerIds) : null;
  const levelSet = filter.levels?.length ? new Set(filter.levels) : null;
  return invoices.filter((inv) => {
    if (idSet && !idSet.has(inv.swimmerId)) return false;
    if (levelSet && !levelSet.has(inv.level)) return false;
    return true;
  });
}

export function invoicesNeedingAppPublish(
  invoices: TuitionV2Invoice[],
  filter: { swimmerIds?: string[]; levels?: string[] } = {}
): TuitionV2Invoice[] {
  return filterInvoices(invoices, filter).filter((inv) => invoiceNeedsAppPublish(inv));
}

export function invoicesPublishedToApp(
  invoices: TuitionV2Invoice[],
  filter: { swimmerIds?: string[]; levels?: string[] } = {}
): TuitionV2Invoice[] {
  return filterInvoices(invoices, filter).filter((inv) => isInvoicePublishedToApp(inv));
}

/**
 * Amount is parent-visible only after this invoice is published to the app,
 * emailed, or (legacy) paid. Drafts stay hidden.
 */
export function isTuitionVisibleToParents(
  _monthStatus: TuitionV2MonthStatus | string | undefined,
  invoice: ParentTuitionInvoiceHint
): boolean {
  return isInvoicePublishedToApp(invoice);
}

export type ParentTuitionMonthPick = {
  month: string;
  monthStatus: string;
  invoice: TuitionV2Invoice | null;
};

/** One current-period row per child: latest published, else the prep month as 核算中. */
export function pickParentTuitionForSwimmer(
  months: ParentTuitionMonthPick[],
  now = new Date()
): ParentTuitionMonthPick {
  for (let i = months.length - 1; i >= 0; i--) {
    if (isTuitionVisibleToParents(months[i].monthStatus, months[i].invoice)) {
      return months[i];
    }
  }
  const prep = parentTuitionPrepMonth(now);
  return months.find((m) => m.month === prep) ?? months[months.length - 1] ?? months[0];
}

export function toParentTuitionView(
  month: string,
  monthStatus: string | undefined,
  invoice: TuitionV2Invoice | null
): ParentTuitionView {
  const visible = isTuitionVisibleToParents(monthStatus, invoice);
  if (!visible || !invoice) {
    return {
      month,
      monthLabel: monthLabel(month),
      status: "calculating",
      statusLabel: "核算中",
      amount: null,
      dueDate: null,
      paid: false,
      practiceText: null,
    };
  }
  const paid = invoice.paid === true;
  return {
    month,
    monthLabel: monthLabel(month),
    status: paid ? "paid" : "ready",
    statusLabel: paid ? "已支付" : "待支付",
    amount: invoice.amount,
    dueDate: invoice.dueDate ?? null,
    paid,
    practiceText: invoice.practiceText ?? null,
  };
}
