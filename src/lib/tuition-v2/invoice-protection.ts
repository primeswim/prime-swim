import type { TuitionV2Invoice } from "./types";
/** Enrollment-date edits must not silently rewrite a bill already finalized by staff. */
export function isFinalizedTuitionInvoice(invoice: TuitionV2Invoice | undefined): boolean {
  return !!invoice && (invoice.paid || invoice.emailStatus === "sent" ||
    invoice.publishedToApp === true || invoice.manualOverride != null);
}
