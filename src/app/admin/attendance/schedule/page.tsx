"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  monthLabel,
  monthToApiPath,
  normalizeBillingMonth,
} from "@/lib/tuition-v2/shared-ui";
import type { TrainingRosterDoc, TrainingRosterSlot } from "@/lib/training-roster-types";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw, Users } from "lucide-react";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function datesInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) out.push(`${y}-${pad2(m)}-${pad2(d)}`);
  return out;
}

/** Calendar cells: leading/trailing nulls for empty days outside the month. */
function buildCalendarCells(month: string): (string | null)[] {
  const dates = datesInMonth(month);
  if (dates.length === 0) return [];
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (const d of dates) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dayNumber(ymd: string): number {
  return Number(ymd.slice(8, 10));
}

function formatDayTitle(ymd: string, weekdayLabel: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const label = new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return weekdayLabel ? `${label}` : label;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function shortLevel(level: string): string {
  return level
    .replace("Beginner", "Beg")
    .replace("Performance", "Perf")
    .replace("Bronze", "Brz")
    .replace("Silver", "Sil")
    .replace("Gold", "Gld")
    .replace("Platinum", "Pla");
}

export default function TrainingSchedulePage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading…</div>}>
      <TrainingScheduleContent />
    </Suspense>
  );
}

function TrainingScheduleContent() {
  const isAdmin = useIsAdminFromDB();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const fromUrl = searchParams.get("month");
    if (fromUrl && normalizeBillingMonth(fromUrl)) return fromUrl;
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  });
  const [roster, setRoster] = useState<TrainingRosterDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const load = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const month = normalizeBillingMonth(selectedMonth);
    if (!month) return;
    setLoading(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/training-roster/${monthToApiPath(month)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setRoster(null);
        setStatusMsg(data.error || "No saved roster yet — click Generate.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to load roster");
        setRoster(null);
        return;
      }
      setRoster(data.roster);
    } finally {
      setLoading(false);
    }
  }, [fetchToken, selectedMonth]);

  const generate = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const month = normalizeBillingMonth(selectedMonth);
    if (!month) return;
    setGenerating(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/training-roster/${monthToApiPath(month)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Generate failed");
        return;
      }
      setRoster(data.roster);
      setStatusMsg(
        `Saved roster for ${monthLabel(month)}: ${data.roster?.slotCount ?? 0} time slots, ${data.roster?.uniqueSwimmerCount ?? 0} swimmers.`
      );
    } finally {
      setGenerating(false);
    }
  }, [fetchToken, selectedMonth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  useEffect(() => {
    router.replace(`/admin/attendance/schedule?month=${encodeURIComponent(selectedMonth)}`);
  }, [selectedMonth, router]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TrainingRosterSlot[]>();
    if (!roster) return map;
    for (const slot of roster.slots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return map;
  }, [roster]);

  const calendarCells = useMemo(() => buildCalendarCells(selectedMonth), [selectedMonth]);

  const selectedSlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];
  const selectedWeekdayLabel = selectedSlots[0]?.weekdayLabel ?? "";

  const todayYmd = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8 px-4">Admin access required.</div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-600" />
              Monthly Training Schedule
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Calendar view of who trains when. Click a day for times, pools, levels, and names.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link href="/admin/attendance" className="text-blue-600 hover:underline">
                ← Mark attendance
              </Link>
              <Link href="/admin/tuition-v2/plan" className="text-blue-600 hover:underline">
                V2 Monthly Plan
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading || generating}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Load saved
          </Button>
          <Button onClick={() => void generate()} disabled={loading || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            Generate &amp; save
          </Button>
          {roster && (
            <span className="text-sm text-slate-600 ml-1">
              <Badge variant="secondary" className="mr-2">
                {monthLabel(roster.month)}
              </Badge>
              {roster.slotCount} slots · {roster.uniqueSwimmerCount} swimmers
              {roster.generatedAt && (
                <span className="text-xs text-muted-foreground ml-2">
                  Saved {new Date(roster.generatedAt).toLocaleString()}
                </span>
              )}
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        {statusMsg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {statusMsg}
          </div>
        )}

        {!roster && !loading && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No roster saved for {monthLabel(selectedMonth)} yet. Set up the month in Tuition V2
              Plan, then click <strong>Generate &amp; save</strong>.
            </CardContent>
          </Card>
        )}

        {(roster || loading) && (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-slate-50">
              {WEEKDAY_HEADERS.map((w) => (
                <div
                  key={w}
                  className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
              {calendarCells.map((date, idx) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[7.5rem] border-b border-r bg-slate-50/40 last:border-r-0"
                    />
                  );
                }
                const slots = slotsByDate.get(date) ?? [];
                const dayTotal = slots.reduce((s, slot) => s + slot.totalCount, 0);
                const hasTraining = slots.length > 0;
                const isToday = date === todayYmd;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-[7.5rem] border-b border-r p-1.5 text-left align-top transition-colors hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300 ${
                      hasTraining ? "bg-white" : "bg-slate-50/30"
                    } ${isToday ? "ring-2 ring-inset ring-blue-400" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-blue-600 text-white"
                            : hasTraining
                              ? "text-slate-800"
                              : "text-slate-400"
                        }`}
                      >
                        {dayNumber(date)}
                      </span>
                      {hasTraining && (
                        <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                          {dayTotal}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {slots.slice(0, 3).map((slot) => (
                        <div
                          key={`${slot.timeSlot}|${slot.location}`}
                          className="rounded bg-blue-50 px-1 py-0.5 text-[10px] leading-tight text-blue-900 truncate"
                          title={`${slot.timeSlot} · ${slot.location} · ${slot.totalCount} kids`}
                        >
                          <span className="font-semibold">{slot.timeSlot}</span>
                          <span className="text-blue-700/80"> · {slot.totalCount}</span>
                        </div>
                      ))}
                      {slots.length > 3 && (
                        <div className="text-[10px] text-slate-500 pl-0.5">+{slots.length - 3} more</div>
                      )}
                      {slots.length === 1 && slots[0].levels.length > 0 && (
                        <div className="text-[9px] text-slate-500 truncate px-0.5">
                          {slots[0].levels.map((l) => `${shortLevel(l.level)} ${l.count}`).join(" · ")}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedDate
                  ? formatDayTitle(selectedDate, selectedWeekdayLabel)
                  : "Day details"}
              </DialogTitle>
            </DialogHeader>
            {selectedDate && selectedSlots.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">No training sessions this day.</p>
            )}
            <div className="space-y-4">
              {selectedSlots.map((slot) => (
                <div
                  key={`${slot.date}|${slot.timeSlot}|${slot.location}`}
                  className="rounded-lg border bg-slate-50/80 p-3 space-y-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-semibold text-slate-900">{slot.timeSlot}</span>
                    <span className="text-sm text-slate-600">{slot.location}</span>
                    <Badge className="ml-auto" variant="secondary">
                      Total {slot.totalCount}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {slot.levels.map((lg) => (
                      <Badge key={lg.level} variant="outline" className="font-normal">
                        {lg.level}: {lg.count}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {slot.levels.map((lg) => (
                      <div key={lg.level} className="rounded-md border bg-white p-2.5">
                        <div className="text-xs font-semibold text-slate-700 mb-1.5">
                          {lg.level}{" "}
                          <span className="text-muted-foreground font-normal">({lg.count})</span>
                        </div>
                        {lg.attendees.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No attendees</p>
                        ) : (
                          <ul className="text-sm text-slate-800 space-y-0.5">
                            {lg.attendees.map((a) => (
                              <li key={a.swimmerId}>{a.swimmerName}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
