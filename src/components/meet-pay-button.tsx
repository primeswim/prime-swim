"use client";

import { Button } from "@/components/ui/button";

const primaryBtn =
  "pointer-events-auto bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-md px-5";

export function MeetPayPrimeButton({
  busy,
  onClick,
}: {
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      disabled={busy}
      className={primaryBtn}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {busy ? "Saving…" : "I have sent payment"}
    </Button>
  );
}

export function MeetPaymentStatusNote({ status }: { status?: string }) {
  if (status === "payment_reported") {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Payment reported — waiting for Prime to confirm.
      </p>
    );
  }
  if (status === "paid") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Paid</p>
    );
  }
  return null;
}
