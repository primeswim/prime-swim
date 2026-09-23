import { SIBLING_TUITION_DISCOUNT_PERCENT } from "@/lib/swimmer-siblings";
import type { TuitionV2PriorMonthCredit } from "@/lib/tuition-v2/types";

export function priorMonthCreditNote(creditAmount: number): string {
  return `$${creditAmount} credit from previous month has been applied to this month's tuition.`;
}

export type PriorMonthCreditInput = {
  sessionCount: number;
  ratePerHour: number;
  siblingDiscountApplied?: boolean;
  siblingDiscountPercent?: number;
  creditSessions: number;
};

export type PriorMonthCreditResult = {
  billedSessions: number;
  baseAmount: number;
  amount: number;
  creditAmount: number;
  creditSessions: number;
  note: string;
};

function siblingPercent(input: Pick<PriorMonthCreditInput, "siblingDiscountApplied" | "siblingDiscountPercent">): number {
  if (!input.siblingDiscountApplied) return 0;
  return typeof input.siblingDiscountPercent === "number"
    ? input.siblingDiscountPercent
    : SIBLING_TUITION_DISCOUNT_PERCENT;
}

function amountAfterSibling(base: number, percent: number): number {
  if (percent <= 0) return base;
  return Math.round(base * (1 - percent / 100));
}

/** Recalculate tuition after reducing billed sessions (team-caused missed class last month). */
export function applyPriorMonthSessionCredit(input: PriorMonthCreditInput): PriorMonthCreditResult {
  const sessionCount = Math.max(0, Math.floor(Number(input.sessionCount) || 0));
  const creditSessions = Math.max(0, Math.floor(Number(input.creditSessions) || 0));
  const billedSessions = Math.max(0, sessionCount - creditSessions);
  const rate = Number.isFinite(input.ratePerHour) ? input.ratePerHour : 0;
  const percent = siblingPercent(input);

  const originalBase = Math.round(rate * sessionCount);
  const originalAmount = amountAfterSibling(originalBase, percent);
  const baseAmount = Math.round(rate * billedSessions);
  const amount = amountAfterSibling(baseAmount, percent);
  const creditAmount = Math.max(0, originalAmount - amount);

  return {
    billedSessions,
    baseAmount,
    amount,
    creditAmount,
    creditSessions,
    note: creditSessions > 0 && creditAmount > 0 ? priorMonthCreditNote(creditAmount) : "",
  };
}

export function toPriorMonthCredit(applied: PriorMonthCreditResult): TuitionV2PriorMonthCredit | null {
  if (applied.creditSessions <= 0 || applied.creditAmount <= 0) return null;
  return {
    sessions: applied.creditSessions,
    creditAmount: applied.creditAmount,
    note: applied.note,
  };
}

export function normalizePriorMonthCredit(raw: unknown): TuitionV2PriorMonthCredit | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const sessions = typeof v.sessions === "number" ? v.sessions : Number(v.sessions);
  const creditAmount = typeof v.creditAmount === "number" ? v.creditAmount : Number(v.creditAmount);
  if (!Number.isFinite(sessions) || sessions <= 0) return null;
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return null;
  return {
    sessions: Math.floor(sessions),
    creditAmount: Math.round(creditAmount),
    note: typeof v.note === "string" && v.note.trim() ? v.note.trim() : priorMonthCreditNote(Math.round(creditAmount)),
  };
}

export function isAutoPriorMonthCreditNote(note: string | undefined, credit: TuitionV2PriorMonthCredit | null | undefined): boolean {
  if (!note?.trim() || !credit) return false;
  return note.trim() === credit.note.trim() || note.trim() === priorMonthCreditNote(credit.creditAmount);
}
