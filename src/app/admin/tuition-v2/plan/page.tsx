"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { TuitionV2HubNav } from "@/components/tuition-v2-hub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SWIMMER_LEVELS } from "@/lib/swimmer-levels";
import type {
  TuitionV2LevelPlan,
  TuitionV2LevelTemplate,
  TuitionV2LevelTemplateMap,
  TuitionV2MonthDoc,
  TuitionV2SchedulePeriod,
  TuitionV2Session,
  TuitionV2SwimmerEnrollment,
  TuitionV2SwimmerResponse,
  TuitionV2TrainingDate,
  TuitionV2WeeklySlot,
} from "@/lib/tuition-v2/types";
import { getNextMonth, monthLabel, monthToApiPath, normalizeBillingMonth } from "@/lib/tuition-v2/shared-ui";
import { getBillableSessionsForSwimmer } from "@/lib/tuition-v2/calculate-engine";
import { resolveSessionsForMonth, schedulePeriodCoverage } from "@/lib/tuition-v2/session-generator";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TrainingDayRow = {
  id: string;
  swimmerName: string;
  level: string;
  regularWeekdays: number[];
};

function getDatesInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

function formatDateShort(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusBadgeVariant(status: TuitionV2MonthDoc["status"]) {
  switch (status) {
    case "approved":
      return "default";
    case "computed":
      return "secondary";
    case "sent":
      return "outline";
    default:
      return "secondary";
  }
}

function emptySlot(): TuitionV2WeeklySlot {
  return { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" };
}

function emptySchedulePeriod(month: string): TuitionV2SchedulePeriod {
  const dates = getDatesInMonth(month);
  return {
    startDate: dates[0] ?? `${month}-01`,
    endDate: dates[dates.length - 1] ?? `${month}-01`,
    trainingDates: [],
  };
}

function emptyTrainingDate(month: string): TuitionV2TrainingDate {
  return { date: `${month}-01`, timeSlot: "7-8PM", location: "Mary Wayte Pool" };
}

function monthLastDate(month: string): string {
  const dates = getDatesInMonth(month);
  return dates[dates.length - 1] ?? `${month}-31`;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Schedule periods may start/end near billing month boundaries (e.g. Sep dates on an Oct plan). */
function planPeriodDateMin(billingMonth: string): string {
  return `${addMonths(billingMonth, -1)}-01`;
}

function planPeriodDateMax(billingMonth: string): string {
  return monthLastDate(addMonths(billingMonth, 1));
}

export default function TuitionV2PlanPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading…</div>}>
      <TuitionV2PlanContent />
    </Suspense>
  );
}

function TuitionV2PlanContent() {
  const isAdmin = useIsAdminFromDB();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(
    () => searchParams.get("month") || getNextMonth()
  );
  const [monthDoc, setMonthDoc] = useState<TuitionV2MonthDoc | null>(null);
  const [levelPlans, setLevelPlans] = useState<TuitionV2LevelPlan[]>([]);
  const [sessionOverrides, setSessionOverrides] = useState<TuitionV2Session[]>([]);
  const [swimmerRows, setSwimmerRows] = useState<
    { enrollment: TuitionV2SwimmerEnrollment; response: TuitionV2SwimmerResponse }[]
  >([]);
  const [noTrainingDates, setNoTrainingDates] = useState<string[]>([]);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [expandedSwimmer, setExpandedSwimmer] = useState<string | null>(null);
  const [swimmerSearch, setSwimmerSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);
  const [savingNoTraining, setSavingNoTraining] = useState(false);
  const [savingResponses, setSavingResponses] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [templateSource, setTemplateSource] = useState<string>("");
  const [levelTemplates, setLevelTemplates] = useState<TuitionV2LevelTemplateMap>({});
  const [expandedTemplateLevel, setExpandedTemplateLevel] = useState<string | null>(null);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [trainingDayList, setTrainingDayList] = useState<TrainingDayRow[]>([]);
  const [loadingTrainingDays, setLoadingTrainingDays] = useState(false);
  const [savingTrainingDayId, setSavingTrainingDayId] = useState<string | null>(null);

  const templateSourceLabel =
    templateSource === "v2_saved"
      ? "V2 saved templates"
      : templateSource === "not_initialized"
        ? "Not initialized — configure in Level Templates tab"
        : "";

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const loadMonth = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const month = normalizeBillingMonth(selectedMonth);
    if (!month) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load month");
        return;
      }
      const data = await res.json();
      setMonthDoc(data.month);
      setLevelPlans(data.levelPlans || []);
      setSessionOverrides(data.sessions || []);
      setNoTrainingDates(data.month?.noTrainingDates || []);
    } finally {
      setLoading(false);
    }
  }, [fetchToken, selectedMonth]);

  useEffect(() => {
    if (isAdmin) void loadMonth();
  }, [isAdmin, loadMonth]);

  useEffect(() => {
    router.replace(`/admin/tuition-v2/plan?month=${encodeURIComponent(selectedMonth)}`);
  }, [selectedMonth, router]);

  const loadSwimmerResponses = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const month = normalizeBillingMonth(selectedMonth);
    if (!month) return;
    const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}/swimmer-responses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSwimmerRows(data.swimmers || []);
  }, [fetchToken, selectedMonth]);

  useEffect(() => {
    if (isAdmin) void loadSwimmerResponses();
  }, [isAdmin, loadSwimmerResponses]);

  const loadTrainingDayList = useCallback(async (syncRoster = false) => {
    const token = await fetchToken();
    if (!token) return;
    setLoadingTrainingDays(true);
    try {
      const url = syncRoster
        ? "/api/admin/tuition-v2/enrollments?sync=1"
        : "/api/admin/tuition-v2/enrollments";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTrainingDayList(data.swimmers || []);
        if (syncRoster) setStatusMsg("Roster synced from active swimmers.");
      }
    } finally {
      setLoadingTrainingDays(false);
    }
  }, [fetchToken]);

  useEffect(() => {
    if (isAdmin) void loadTrainingDayList();
  }, [isAdmin, loadTrainingDayList]);

  const toggleTrainingDayWeekday = (id: string, wd: number) => {
    setTrainingDayList((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const has = s.regularWeekdays.includes(wd);
        const next = has
          ? s.regularWeekdays.filter((n) => n !== wd)
          : [...s.regularWeekdays, wd].sort((a, b) => a - b);
        return { ...s, regularWeekdays: next };
      })
    );
  };

  const saveTrainingDays = async (row: TrainingDayRow) => {
    const token = await fetchToken();
    if (!token) return;
    setSavingTrainingDayId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/enrollments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ regularWeekdays: row.regularWeekdays }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save training days");
        return;
      }
      setSwimmerRows((prev) =>
        prev.map(({ enrollment, response }) =>
          enrollment.swimmerId === row.id
            ? { enrollment: { ...enrollment, regularWeekdays: row.regularWeekdays }, response }
            : { enrollment, response }
        )
      );
      setStatusMsg(`Training days saved for ${row.swimmerName}.`);
    } finally {
      setSavingTrainingDayId(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const token = await fetchToken();
      if (!token) return;
      const res = await fetch("/api/admin/tuition-v2/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.source) setTemplateSource(data.source);
        if (data.levels) setLevelTemplates(data.levels);
      }
    })();
  }, [isAdmin, fetchToken]);

  const datesInMonth = useMemo(() => getDatesInMonth(selectedMonth), [selectedMonth]);

  const resolvedSessions = useMemo(
    () => resolveSessionsForMonth(selectedMonth, levelPlans, sessionOverrides, noTrainingDates),
    [selectedMonth, levelPlans, sessionOverrides, noTrainingDates]
  );

  const periodCoverage = useMemo(
    () => schedulePeriodCoverage(levelPlans, selectedMonth),
    [levelPlans, selectedMonth]
  );

  const billableSessionsForSwimmer = useCallback(
    (enrollment: TuitionV2SwimmerEnrollment, response: TuitionV2SwimmerResponse) =>
      getBillableSessionsForSwimmer(
        enrollment,
        resolvedSessions,
        response,
        periodCoverage.explicit,
        periodCoverage.periodDatesByLevel
      ),
    [resolvedSessions, periodCoverage]
  );

  const activeSessions = useMemo(
    () => resolvedSessions.filter((s) => !s.cancelled),
    [resolvedSessions]
  );

  const toggleNoTraining = (date: string, checked: boolean) => {
    setNoTrainingDates((prev) => {
      if (checked) return [...new Set([...prev, date])].sort();
      return prev.filter((d) => d !== date);
    });
  };

  const saveNoTraining = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSavingNoTraining(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ noTrainingDates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save no-training dates");
        return;
      }
      const data = await res.json();
      setMonthDoc(data.month);
      setStatusMsg("No-training dates saved.");
    } finally {
      setSavingNoTraining(false);
    }
  };

  const saveLevelPlans = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSavingPlans(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/level-plans`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ levelPlans }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save level plans");
        return;
      }
      const data = await res.json();
      setLevelPlans(data.levelPlans || []);
      const periodCount = (data.levelPlans || []).reduce(
        (sum: number, p: TuitionV2LevelPlan) => sum + (p.schedulePeriods?.length ?? 0),
        0
      );
      setStatusMsg(`Level plans saved (${periodCount} schedule period(s) across all levels).`);
      await loadMonth();
    } finally {
      setSavingPlans(false);
    }
  };

  const toggleSessionCancelled = async (session: TuitionV2Session, cancelled: boolean) => {
    const token = await fetchToken();
    if (!token) return;
    const res = await fetch(
      `/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/sessions/${encodeURIComponent(session.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelled }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update session");
      return;
    }
    const data = await res.json();
    setSessionOverrides((prev) => {
      const has = prev.some((s) => s.id === session.id);
      if (has) return prev.map((s) => (s.id === session.id ? data.session : s));
      return [...prev, data.session];
    });
    await loadMonth();
  };

  const seedTemplates = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSeedingTemplates(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tuition-v2/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "seed_defaults" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to seed templates");
        return;
      }
      const data = await res.json();
      setLevelTemplates(data.levels || {});
      setTemplateSource("v2_saved");
      setStatusMsg("V2 level templates initialized with defaults. Review and save.");
    } finally {
      setSeedingTemplates(false);
    }
  };

  const saveTemplates = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSavingTemplates(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tuition-v2/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ levels: levelTemplates, syncMonth: selectedMonth }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save templates");
        return;
      }
      const data = await res.json();
      setLevelTemplates(data.levels || {});
      setTemplateSource("v2_saved");
      if (data.levelPlans) {
        setLevelPlans((prev) =>
          prev.map((plan) => {
            const synced = (data.levelPlans as TuitionV2LevelPlan[]).find((p) => p.level === plan.level);
            if (!synced) return plan;
            return {
              ...plan,
              weeklySlots: synced.weeklySlots,
            };
          })
        );
      }
      setStatusMsg(
        "V2 level templates saved. Weekly schedule synced to this month; your schedule periods and notes were kept."
      );
    } finally {
      setSavingTemplates(false);
    }
  };

  const updateTemplate = (level: string, patch: Partial<TuitionV2LevelTemplate>) => {
    setLevelTemplates((prev) => ({
      ...prev,
      [level]: { ...prev[level], ...patch },
    }));
  };

  const updateTemplateSlot = (level: string, index: number, patch: Partial<TuitionV2WeeklySlot>) => {
    setLevelTemplates((prev) => {
      const tpl = prev[level];
      if (!tpl) return prev;
      const weeklySlots = [...tpl.weeklySlots];
      weeklySlots[index] = { ...weeklySlots[index], ...patch };
      return { ...prev, [level]: { ...tpl, weeklySlots } };
    });
  };

  const addTemplateSlot = (level: string) => {
    setLevelTemplates((prev) => {
      const tpl = prev[level];
      if (!tpl) return prev;
      return { ...prev, [level]: { ...tpl, weeklySlots: [...tpl.weeklySlots, emptySlot()] } };
    });
  };

  const removeTemplateSlot = (level: string, index: number) => {
    setLevelTemplates((prev) => {
      const tpl = prev[level];
      if (!tpl) return prev;
      return {
        ...prev,
        [level]: { ...tpl, weeklySlots: tpl.weeklySlots.filter((_, i) => i !== index) },
      };
    });
  };

  const updatePlan = (level: string, patch: Partial<TuitionV2LevelPlan>) => {
    setLevelPlans((prev) =>
      prev.map((p) => (p.level === level ? { ...p, ...patch } : p))
    );
  };

  const updateWeeklySlot = (
    level: string,
    index: number,
    patch: Partial<TuitionV2WeeklySlot>
  ) => {
    setLevelPlans((prev) =>
      prev.map((p) => {
        if (p.level !== level) return p;
        const weeklySlots = [...p.weeklySlots];
        weeklySlots[index] = { ...weeklySlots[index], ...patch };
        return { ...p, weeklySlots };
      })
    );
  };

  const addWeeklySlot = (level: string) => {
    setLevelPlans((prev) =>
      prev.map((p) =>
        p.level === level ? { ...p, weeklySlots: [...p.weeklySlots, emptySlot()] } : p
      )
    );
  };

  const removeWeeklySlot = (level: string, index: number) => {
    setLevelPlans((prev) =>
      prev.map((p) =>
        p.level === level
          ? { ...p, weeklySlots: p.weeklySlots.filter((_, i) => i !== index) }
          : p
      )
    );
  };

  const addSchedulePeriod = (level: string) => {
    setLevelPlans((prev) =>
      prev.map((p) =>
        p.level === level
          ? { ...p, schedulePeriods: [...(p.schedulePeriods ?? []), emptySchedulePeriod(selectedMonth)] }
          : p
      )
    );
  };

  const removeSchedulePeriod = (level: string, periodIdx: number) => {
    setLevelPlans((prev) =>
      prev.map((p) =>
        p.level === level
          ? { ...p, schedulePeriods: (p.schedulePeriods ?? []).filter((_, i) => i !== periodIdx) }
          : p
      )
    );
  };

  const updateSchedulePeriod = (
    level: string,
    periodIdx: number,
    patch: Partial<TuitionV2SchedulePeriod>
  ) => {
    setLevelPlans((prev) =>
      prev.map((p) => {
        if (p.level !== level) return p;
        const schedulePeriods = [...(p.schedulePeriods ?? [])];
        schedulePeriods[periodIdx] = { ...schedulePeriods[periodIdx], ...patch };
        return { ...p, schedulePeriods };
      })
    );
  };

  const addTrainingDate = (level: string, periodIdx: number) => {
    setLevelPlans((prev) =>
      prev.map((p) => {
        if (p.level !== level) return p;
        const schedulePeriods = [...(p.schedulePeriods ?? [])];
        const period = { ...schedulePeriods[periodIdx] };
        period.trainingDates = [...period.trainingDates, emptyTrainingDate(selectedMonth)];
        schedulePeriods[periodIdx] = period;
        return { ...p, schedulePeriods };
      })
    );
  };

  const removeTrainingDate = (level: string, periodIdx: number, dateIdx: number) => {
    setLevelPlans((prev) =>
      prev.map((p) => {
        if (p.level !== level) return p;
        const schedulePeriods = [...(p.schedulePeriods ?? [])];
        const period = { ...schedulePeriods[periodIdx] };
        period.trainingDates = period.trainingDates.filter((_, i) => i !== dateIdx);
        schedulePeriods[periodIdx] = period;
        return { ...p, schedulePeriods };
      })
    );
  };

  const updateTrainingDate = (
    level: string,
    periodIdx: number,
    dateIdx: number,
    patch: Partial<TuitionV2TrainingDate>
  ) => {
    setLevelPlans((prev) =>
      prev.map((p) => {
        if (p.level !== level) return p;
        const schedulePeriods = [...(p.schedulePeriods ?? [])];
        const period = { ...schedulePeriods[periodIdx] };
        const trainingDates = [...period.trainingDates];
        trainingDates[dateIdx] = { ...trainingDates[dateIdx], ...patch };
        if (patch.date) {
          if (patch.date < period.startDate) period.startDate = patch.date;
          if (patch.date > period.endDate) period.endDate = patch.date;
        }
        period.trainingDates = trainingDates;
        schedulePeriods[periodIdx] = period;
        return { ...p, schedulePeriods };
      })
    );
  };

  const filteredSwimmers = useMemo(() => {
    const q = swimmerSearch.trim().toLowerCase();
    if (!q) return swimmerRows;
    return swimmerRows.filter(
      (r) =>
        r.enrollment.swimmerName.toLowerCase().includes(q) ||
        r.enrollment.level.toLowerCase().includes(q)
    );
  }, [swimmerRows, swimmerSearch]);

  const templateLevels = useMemo(
    () => SWIMMER_LEVELS.filter((level) => levelTemplates[level]),
    [levelTemplates]
  );

  const sessionsForLevel = useCallback(
    (level: string) =>
      resolvedSessions
        .filter((s) => s.level === level && !s.cancelled)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [resolvedSessions]
  );

  const toggleWeekdayAvailability = (swimmerId: string, weekday: number, unavailable: boolean) => {
    setSwimmerRows((prev) =>
      prev.map((row) => {
        if (row.enrollment.swimmerId !== swimmerId) return row;
        const weekdayAvailability = { ...(row.response.weekdayAvailability ?? {}) };
        if (unavailable) weekdayAvailability[weekday] = "unavailable";
        else delete weekdayAvailability[weekday];
        return {
          ...row,
          response: {
            ...row.response,
            weekdayAvailability:
              Object.keys(weekdayAvailability).length > 0 ? weekdayAvailability : undefined,
          },
        };
      })
    );
  };

  const saveSwimmerResponses = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSavingResponses(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/swimmer-responses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ responses: swimmerRows.map((r) => r.response) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save swimmer responses");
        return;
      }
      setStatusMsg("Swimmer responses saved.");
      await loadSwimmerResponses();
    } finally {
      setSavingResponses(false);
    }
  };

  const addAdjustment = (
    swimmerId: string,
    type: "skip_session" | "swap_session" | "add_session",
    fromSessionId?: string,
    toSessionId?: string
  ) => {
    setSwimmerRows((prev) =>
      prev.map((row) => {
        if (row.enrollment.swimmerId !== swimmerId) return row;
        const adjustments = [...(row.response.adjustments ?? [])];
        adjustments.push({ type, fromSessionId, toSessionId, note: "" });
        return { ...row, response: { ...row.response, adjustments } };
      })
    );
  };

  const removeAdjustment = (swimmerId: string, index: number) => {
    setSwimmerRows((prev) =>
      prev.map((row) => {
        if (row.enrollment.swimmerId !== swimmerId) return row;
        const adjustments = (row.response.adjustments ?? []).filter((_, i) => i !== index);
        return { ...row, response: { ...row.response, adjustments } };
      })
    );
  };

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8 px-4">Admin access required.</div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tuition V2 — Monthly Plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Single place to set training schedules for billing. V1 tuition is unchanged.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="month" className="sr-only">
              Month
            </Label>
            <Input
              id="month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" size="icon" onClick={() => void loadMonth()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant(monthDoc?.status ?? "planning")}>
            {monthDoc?.status ?? "planning"}
          </Badge>
          <span className="text-sm text-muted-foreground">{monthLabel(selectedMonth)}</span>
          {monthDoc?.lastSessionsGeneratedAt && (
            <span className="text-xs text-muted-foreground">
              Sessions: {new Date(monthDoc.lastSessionsGeneratedAt).toLocaleString()}
            </span>
          )}
        </div>

        {(monthDoc?.status === "sent" || monthDoc?.status === "computed") && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            Schedule changes — recalculate in Review before sending updated amounts.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        {statusMsg && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {statusMsg}
          </div>
        )}

        <TuitionV2HubNav month={selectedMonth} />

        <Tabs defaultValue="level-templates">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="level-templates">Level Templates</TabsTrigger>
            <TabsTrigger value="level-plans">Level Plans</TabsTrigger>
            <TabsTrigger value="no-training">No-training</TabsTrigger>
            <TabsTrigger value="sessions">Sessions ({activeSessions.length})</TabsTrigger>
            <TabsTrigger value="training-days">Training Days</TabsTrigger>
            <TabsTrigger value="swimmers">Swimmer Responses</TabsTrigger>
          </TabsList>

          <TabsContent value="level-templates" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              V2-only level configuration (rates + weekly schedule). Stored in{" "}
              <code className="text-xs">tuition_v2_level_templates</code>. Saving templates also updates
              this month&apos;s default weekly schedule in Level Plans — schedule periods are not
              cleared.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void seedTemplates()} disabled={seedingTemplates}>
                {seedingTemplates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Initialize with defaults
              </Button>
              <Button onClick={() => void saveTemplates()} disabled={savingTemplates}>
                {savingTemplates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save V2 templates
              </Button>
            </div>
            {templateSource === "not_initialized" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Templates not saved yet. Initialize with defaults or edit below, then save before loading
                monthly level plans.
              </div>
            )}
            {(templateLevels.length ? templateLevels : SWIMMER_LEVELS).map((level) => {
              const tpl = levelTemplates[level];
              if (!tpl) return null;
              const open = expandedTemplateLevel === level;
              return (
                <Card key={level}>
                  <CardHeader
                    className="cursor-pointer py-4"
                    onClick={() => setExpandedTemplateLevel(open ? null : level)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {level}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        ${tpl.defaultRatePerHour}/hr · min {tpl.minDaysPerWeek} days
                        {tpl.reducedRatePerHour != null ? ` · reduced $${tpl.reducedRatePerHour}/hr` : ""}
                      </span>
                    </div>
                  </CardHeader>
                  {open && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Default rate ($/hr)</Label>
                          <Input
                            type="number"
                            value={tpl.defaultRatePerHour}
                            onChange={(e) =>
                              updateTemplate(level, { defaultRatePerHour: Number(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Min days/week</Label>
                          <Input
                            type="number"
                            value={tpl.minDaysPerWeek}
                            onChange={(e) =>
                              updateTemplate(level, { minDaysPerWeek: Number(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Reduced rate ($/hr, optional)</Label>
                          <Input
                            type="number"
                            value={tpl.reducedRatePerHour ?? ""}
                            placeholder="Same as default"
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              updateTemplate(level, {
                                reducedRatePerHour: v === "" ? null : Number(v) || null,
                              });
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Weekly schedule</Label>
                        <div className="mt-2 space-y-2">
                          {tpl.weeklySlots.map((slot, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2">
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value={slot.weekday}
                                onChange={(e) =>
                                  updateTemplateSlot(level, idx, { weekday: Number(e.target.value) })
                                }
                              >
                                {WEEKDAYS.map((name, wd) => (
                                  <option key={wd} value={wd}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                              <Input
                                className="w-32"
                                value={slot.timeSlot}
                                onChange={(e) =>
                                  updateTemplateSlot(level, idx, { timeSlot: e.target.value })
                                }
                                placeholder="Time"
                              />
                              <Input
                                className="flex-1 min-w-[160px]"
                                value={slot.location}
                                onChange={(e) =>
                                  updateTemplateSlot(level, idx, { location: e.target.value })
                                }
                                placeholder="Pool"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTemplateSlot(level, idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => addTemplateSlot(level)}>
                            <Plus className="h-4 w-4 mr-1" /> Add slot
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="no-training" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  No-training dates — {monthLabel(selectedMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Check dates when the team does not train (holidays, breaks). Sessions update automatically when saved.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {datesInMonth.map((date) => {
                    const wd = new Date(date + "T12:00:00").getDay();
                    const checked = noTrainingDates.includes(date);
                    return (
                      <label
                        key={date}
                        className={`flex items-center gap-2 rounded border p-2 text-sm cursor-pointer ${
                          checked ? "border-red-300 bg-red-50" : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleNoTraining(date, Boolean(v))}
                        />
                        <span>
                          {WEEKDAYS[wd]} {formatDateShort(date)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <Button onClick={() => void saveNoTraining()} disabled={savingNoTraining}>
                  {savingNoTraining ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save no-training dates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="level-plans" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Monthly schedule source: <strong>{templateSourceLabel || "loading…"}</strong>. Saving
              level templates automatically updates this month&apos;s default weekly schedule. Schedule
              periods and training dates you add here are kept.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveLevelPlans()} disabled={savingPlans}>
                {savingPlans ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save level plans
              </Button>
            </div>

            {SWIMMER_LEVELS.map((level) => {
              const plan = levelPlans.find((p) => p.level === level);
              if (!plan) return null;
              const open = expandedLevel === level;
              return (
                <Card key={level}>
                  <CardHeader
                    className="cursor-pointer py-4"
                    onClick={() => setExpandedLevel(open ? null : level)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {level}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {plan.weeklySlots.length} default slot(s)
                        {(plan.schedulePeriods?.length ?? 0) > 0
                          ? ` · ${plan.schedulePeriods!.length} schedule period(s)`
                          : ""}
                      </span>
                    </div>
                  </CardHeader>
                  {open && (
                    <CardContent className="space-y-6 border-t pt-4">
                      <div>
                        <Label className="text-sm font-medium">Default weekly schedule (outside schedule periods)</Label>
                        <div className="mt-2 space-y-2">
                          {plan.weeklySlots.map((slot, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2">
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value={slot.weekday}
                                onChange={(e) =>
                                  updateWeeklySlot(level, idx, { weekday: Number(e.target.value) })
                                }
                              >
                                {WEEKDAYS.map((name, wd) => (
                                  <option key={wd} value={wd}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                              <Input
                                className="w-32"
                                value={slot.timeSlot}
                                onChange={(e) => updateWeeklySlot(level, idx, { timeSlot: e.target.value })}
                                placeholder="Time"
                              />
                              <Input
                                className="flex-1 min-w-[160px]"
                                value={slot.location}
                                onChange={(e) => updateWeeklySlot(level, idx, { location: e.target.value })}
                                placeholder="Pool"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeWeeklySlot(level, idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => addWeeklySlot(level)}>
                            <Plus className="h-4 w-4 mr-1" /> Add slot
                          </Button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Schedule periods</Label>
                          <Button variant="outline" size="sm" onClick={() => addSchedulePeriod(level)}>
                            <Plus className="h-4 w-4 mr-1" /> Add period
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Within each period, default weekly schedule is ignored. Add only the
                          specific training dates (date, time, pool) that actually happen. Period
                          dates can span into adjacent months; only dates inside{" "}
                          {monthLabel(selectedMonth)} are billed for this month.
                        </p>
                        {(plan.schedulePeriods ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground mt-2">
                            No schedule periods — default weekly schedule applies all month.
                          </p>
                        )}
                        {(plan.schedulePeriods ?? []).map((period, periodIdx) => (
                          <div key={periodIdx} className="mt-3 rounded border p-3 space-y-3 bg-muted/30">
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <Label className="text-xs">Period start</Label>
                                <Input
                                  type="date"
                                  value={period.startDate}
                                  min={planPeriodDateMin(selectedMonth)}
                                  max={planPeriodDateMax(selectedMonth)}
                                  onChange={(e) =>
                                    updateSchedulePeriod(level, periodIdx, { startDate: e.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Period end</Label>
                                <Input
                                  type="date"
                                  value={period.endDate}
                                  min={period.startDate || planPeriodDateMin(selectedMonth)}
                                  max={planPeriodDateMax(selectedMonth)}
                                  onChange={(e) =>
                                    updateSchedulePeriod(level, periodIdx, { endDate: e.target.value })
                                  }
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSchedulePeriod(level, periodIdx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium">Training dates in this period</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTrainingDate(level, periodIdx)}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add training date
                                </Button>
                              </div>
                              {period.trainingDates.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  No training dates — nothing generates inside this period until you add them.
                                </p>
                              )}
                              {period.trainingDates.map((training, dateIdx) => (
                                <div
                                  key={dateIdx}
                                  className="mt-2 flex flex-wrap items-end gap-2 rounded border p-2 bg-background"
                                >
                                  <div>
                                    <Label className="text-xs">Date</Label>
                                    <Input
                                      type="date"
                                      value={training.date}
                                      min={period.startDate || planPeriodDateMin(selectedMonth)}
                                      max={period.endDate || planPeriodDateMax(selectedMonth)}
                                      onChange={(e) =>
                                        updateTrainingDate(level, periodIdx, dateIdx, {
                                          date: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Time</Label>
                                    <Input
                                      className="w-32"
                                      value={training.timeSlot}
                                      onChange={(e) =>
                                        updateTrainingDate(level, periodIdx, dateIdx, {
                                          timeSlot: e.target.value,
                                        })
                                      }
                                      placeholder="7-8PM"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-[160px]">
                                    <Label className="text-xs">Pool</Label>
                                    <Input
                                      value={training.location}
                                      onChange={(e) =>
                                        updateTrainingDate(level, periodIdx, dateIdx, {
                                          location: e.target.value,
                                        })
                                      }
                                      placeholder="Mary Wayte Pool"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeTrainingDate(level, periodIdx, dateIdx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div>
                        <Label className="text-sm">Notes</Label>
                        <Input
                          value={plan.notes ?? ""}
                          onChange={(e) => updatePlan(level, { notes: e.target.value })}
                          placeholder="e.g. Norwood not open until 9/15"
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session preview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Derived live from level plans and no-training dates. Uncheck Active to cancel a
                  specific session. Save level plans to refresh.
                </p>
              </CardHeader>
              <CardContent>
                {resolvedSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No sessions — save level plans for this month first.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-2">Date</th>
                          <th className="py-2 pr-2">Level</th>
                          <th className="py-2 pr-2">Time</th>
                          <th className="py-2 pr-2">Pool</th>
                          <th className="py-2 pr-2">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedSessions.map((s) => (
                          <tr
                            key={s.id}
                            className={`border-b ${s.cancelled ? "opacity-50 line-through" : ""}`}
                          >
                            <td className="py-2 pr-2">
                              {WEEKDAYS[s.weekday]} {formatDateShort(s.date)}
                              {s.extraTraining ? (
                                <span className="text-xs text-muted-foreground ml-1">period</span>
                              ) : null}
                            </td>
                            <td className="py-2 pr-2">{s.level}</td>
                            <td className="py-2 pr-2">{s.timeSlot}</td>
                            <td className="py-2 pr-2">{s.location}</td>
                            <td className="py-2 pr-2">
                              <Checkbox
                                checked={!s.cancelled}
                                onCheckedChange={(v) => void toggleSessionCancelled(s, !Boolean(v))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training-days" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Swimmer training days
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Default weekdays each swimmer trains (used for tuition calculation). Stored in V2
                  enrollment only — does not use V1 swimmer config.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadTrainingDayList(true)}
                    disabled={loadingTrainingDays}
                  >
                    Sync roster
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadTrainingDayList(false)}
                    disabled={loadingTrainingDays}
                  >
                    {loadingTrainingDays ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Refresh list
                  </Button>
                </div>
                {loadingTrainingDays && trainingDayList.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">Loading swimmers…</p>
                ) : trainingDayList.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    No active swimmers with a group assignment. Assign a level to swimmers first.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b text-muted-foreground">
                          <th className="p-2 font-semibold">Swimmer</th>
                          <th className="p-2 font-semibold">Level</th>
                          {WEEKDAYS.map((d) => (
                            <th key={d} className="p-1 text-center font-semibold w-12">
                              {d.slice(0, 2)}
                            </th>
                          ))}
                          <th className="p-2 font-semibold">Save</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingDayList.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="p-2 font-medium">{row.swimmerName}</td>
                            <td className="p-2">{row.level}</td>
                            {WEEKDAYS.map((_, wd) => (
                              <td key={wd} className="p-1 text-center">
                                <Checkbox
                                  checked={row.regularWeekdays.includes(wd)}
                                  onCheckedChange={() => toggleTrainingDayWeekday(row.id, wd)}
                                />
                              </td>
                            ))}
                            <td className="p-2">
                              <Button
                                size="sm"
                                onClick={() => void saveTrainingDays(row)}
                                disabled={savingTrainingDayId === row.id}
                              >
                                {savingTrainingDayId === row.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swimmers" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              All active (non-frozen) swimmers are included automatically. Record family
              communication: weekday conflicts and temporary skip/swap/add for this month.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search swimmer…"
                value={swimmerSearch}
                onChange={(e) => setSwimmerSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={() => void saveSwimmerResponses()} disabled={savingResponses}>
                {savingResponses ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save swimmer responses
              </Button>
            </div>
            {filteredSwimmers.map(({ enrollment, response }) => {
              const open = expandedSwimmer === enrollment.swimmerId;
              const levelSessions = sessionsForLevel(enrollment.level);
              const billablePreview = billableSessionsForSwimmer(enrollment, response);
              const plan = levelPlans.find((p) => p.level === enrollment.level);
              const explicitPlanDates = [
                ...new Set(
                  (plan?.schedulePeriods ?? []).flatMap((period) =>
                    period.trainingDates
                      .map((t) => t.date)
                      .filter((d) => d.startsWith(`${selectedMonth}-`))
                  )
                ),
              ].sort();
              const billableDates = new Set(billablePreview.map((s) => s.date));
              const planDatesNotBillable = explicitPlanDates.filter((d) => !billableDates.has(d));
              const skipIds = new Set(
                (response.adjustments ?? [])
                  .filter((a) => a.type === "skip_session" && a.fromSessionId)
                  .map((a) => a.fromSessionId!)
              );
              return (
                <Card key={enrollment.swimmerId}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => setExpandedSwimmer(open ? null : enrollment.swimmerId)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {enrollment.swimmerName} — {enrollment.level}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        Regular:{" "}
                        {enrollment.regularWeekdays.map((wd) => WEEKDAYS[wd]).join(", ") || "none"}
                      </span>
                    </div>
                  </CardHeader>
                  {open && (
                    <CardContent className="space-y-4 border-t pt-4">
                      <div>
                        <Label className="text-sm">Billable sessions (preview)</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Schedule-period override dates bill even when not on regular training days.
                          Save responses, then recalculate in Review.
                        </p>
                        {billablePreview.length === 0 ? (
                          <p className="text-sm text-muted-foreground mt-2">None — check training days or level plan schedule periods.</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-sm">
                            {billablePreview.map((s) => (
                              <li key={s.id} className="flex items-center gap-2">
                                <span>
                                  {WEEKDAYS[s.weekday]} {formatDateShort(s.date)} · {s.timeSlot} · {s.location}
                                  {s.extraTraining ? " · period" : ""}
                                </span>
                                {skipIds.has(s.id) && (
                                  <span className="text-xs text-amber-700">skipped</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {explicitPlanDates.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Period dates in level plan:{" "}
                            {explicitPlanDates.map((d) => formatDateShort(d)).join(", ")}
                          </p>
                        )}
                        {planDatesNotBillable.length > 0 && (
                          <p className="text-xs text-amber-700 mt-1">
                            In plan but not billable (no-training or cancelled):{" "}
                            {planDatesNotBillable.map((d) => formatDateShort(d)).join(", ")}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm">Cannot attend weekday (this month)</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {WEEKDAYS.map((name, wd) => (
                            <label key={wd} className="flex items-center gap-1 text-sm">
                              <Checkbox
                                checked={response.weekdayAvailability?.[wd] === "unavailable"}
                                onCheckedChange={(v) =>
                                  toggleWeekdayAvailability(enrollment.swimmerId, wd, Boolean(v))
                                }
                              />
                              {name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Temporary adjustments</Label>
                        {(response.adjustments ?? []).map((adj, idx) => (
                          <div key={idx} className="text-xs mt-1 flex items-center gap-2">
                            <span>
                              {adj.type}
                              {adj.fromSessionId ? ` from ${adj.fromSessionId}` : ""}
                              {adj.toSessionId ? ` → ${adj.toSessionId}` : ""}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAdjustment(enrollment.swimmerId, idx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <select
                            id={`skip-${enrollment.swimmerId}`}
                            className="border rounded px-2 py-1 text-sm max-w-md"
                            defaultValue=""
                          >
                            <option value="">Skip session…</option>
                            {(billablePreview.length > 0 ? billablePreview : levelSessions).map((s) => (
                              <option key={s.id} value={s.id}>
                                {formatDateShort(s.date)} {s.timeSlot}
                                {s.extraTraining ? " (period)" : ""}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const sel = document.getElementById(
                                `skip-${enrollment.swimmerId}`
                              ) as HTMLSelectElement;
                              if (sel?.value)
                                addAdjustment(enrollment.swimmerId, "skip_session", sel.value);
                            }}
                          >
                            Add skip
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <select
                            id={`swap-from-${enrollment.swimmerId}`}
                            className="border rounded px-2 py-1 text-sm"
                            defaultValue=""
                          >
                            <option value="">Swap from…</option>
                            {levelSessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {formatDateShort(s.date)}
                              </option>
                            ))}
                          </select>
                          <select
                            id={`swap-to-${enrollment.swimmerId}`}
                            className="border rounded px-2 py-1 text-sm"
                            defaultValue=""
                          >
                            <option value="">Swap to…</option>
                            {levelSessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {formatDateShort(s.date)}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const from = document.getElementById(
                                `swap-from-${enrollment.swimmerId}`
                              ) as HTMLSelectElement;
                              const to = document.getElementById(
                                `swap-to-${enrollment.swimmerId}`
                              ) as HTMLSelectElement;
                              if (from?.value && to?.value)
                                addAdjustment(
                                  enrollment.swimmerId,
                                  "swap_session",
                                  from.value,
                                  to.value
                                );
                            }}
                          >
                            Add swap
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
