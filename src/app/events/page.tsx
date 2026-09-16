"use client";

import { Suspense } from "react";
import { CalendarListPage } from "@/components/calendar-list-page";

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Loading calendar…</div>}>
      <CalendarListPage />
    </Suspense>
  );
}
