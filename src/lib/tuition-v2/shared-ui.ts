export const TUITION_V2_ENROLLMENT_COLLECTION = "tuition_v2_swimmer_enrollment";
export const TUITION_V2_INVOICES_SUBCOL = "invoices";
export const TUITION_V2_SWIMMER_RESPONSES_SUBCOL = "swimmer_responses";

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function defaultDueDateForMonth(ym: string): string {
  return `${ym}-01`;
}

export function getNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Validate YYYY-MM billing month (client + server). */
export function normalizeBillingMonth(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
  const m = Number(trimmed.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return trimmed;
}

/** Use in API paths — hyphen in YYYY-MM can break some routers (2026-09 → 2026). */
export function monthToApiPath(month: string): string {
  const normalized = normalizeBillingMonth(month);
  if (!normalized) return encodeURIComponent(month);
  return normalized.replace("-", "_");
}

export function formatSessionLine(date: string, timeSlot: string, location: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const mmdd = `${String(mo).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
  return `${mmdd} ${timeSlot} ${location}`;
}

/** Month has calculated invoices and is ready for Email hub send/resend. */
export function monthReadyToSendEmail(status: string | undefined): boolean {
  return status === "computed" || status === "sent" || status === "approved";
}
