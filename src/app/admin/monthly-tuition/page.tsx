"use client";

import React, { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import Header from "@/components/header";
import {
  Calendar,
  Calculator,
  DollarSign,
  Copy,
  ChevronDown,
  ChevronRight,
  Settings,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react";
import type { LevelConfigMap } from "@/lib/tuition-defaults";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalculateRow = {
  swimmerId: string;
  swimmerName: string;
  level: string;
  trainingWeekdays: number[];
  sessionCount: number;
  ratePerHour: number;
  tuition: number;
  scheduleLines: string[];
  timeSlot: string;
  location: string;
  needsConfig?: boolean;
};

type SwimmerConfigRow = {
  id: string;
  swimmerName: string;
  level: string;
  trainingWeekdays: number[];
  trainingTimeSlot: string | null;
  trainingLocation: string | null;
  ratePerHourOverride: number | null;
};

function getNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDatesInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  const lastDay = new Date(y, m, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return out;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function MonthlyTuitionPage() {
  const isAdmin = useIsAdminFromDB();
  const [selectedMonth, setSelectedMonth] = useState(getNextMonth);
  const [noTrainingDates, setNoTrainingDates] = useState<string[]>([]);
  const [savingNoTraining, setSavingNoTraining] = useState(false);
  const [levelConfig, setLevelConfig] = useState<LevelConfigMap | null>(null);
  const [savingLevelConfig, setSavingLevelConfig] = useState(false);
  const [results, setResults] = useState<CalculateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<CalculateRow | null>(null);
  const [editForm, setEditForm] = useState({
    trainingWeekdays: [] as number[],
    trainingTimeSlot: "",
    trainingLocation: "",
    ratePerHourOverride: "" as string | number,
  });
  const [savingSwimmer, setSavingSwimmer] = useState(false);
  const [swimmerList, setSwimmerList] = useState<SwimmerConfigRow[]>([]);
  const [loadingSwimmerList, setLoadingSwimmerList] = useState(false);
  const [savingSwimmerId, setSavingSwimmerId] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const loadMonthConfig = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const res = await fetch(`/api/admin/tuition/month-config?month=${encodeURIComponent(selectedMonth)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setNoTrainingDates(data.noTrainingDates || []);
    }
  }, [selectedMonth, fetchToken]);

  const loadLevelConfig = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const res = await fetch("/api/admin/tuition/level-config", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLevelConfig(data.levels || null);
    }
  }, [fetchToken]);

  useEffect(() => {
    if (!isAdmin) return;
    loadMonthConfig();
  }, [isAdmin, selectedMonth, loadMonthConfig]);

  useEffect(() => {
    if (!isAdmin) return;
    loadLevelConfig();
  }, [isAdmin, loadLevelConfig]);

  const loadSwimmerList = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    setLoadingSwimmerList(true);
    try {
      const res = await fetch("/api/admin/tuition/swimmers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSwimmerList(data.swimmers || []);
      }
    } finally {
      setLoadingSwimmerList(false);
    }
  }, [fetchToken]);

  const updateSwimmerInList = (id: string, patch: Partial<SwimmerConfigRow>) => {
    setSwimmerList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const toggleSwimmerWeekday = (id: string, wd: number) => {
    setSwimmerList((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const has = s.trainingWeekdays.includes(wd);
        const next = has ? s.trainingWeekdays.filter((n) => n !== wd) : [...s.trainingWeekdays, wd].sort((a, b) => a - b);
        return { ...s, trainingWeekdays: next };
      })
    );
  };

  const saveSwimmerInList = async (row: SwimmerConfigRow) => {
    const token = await fetchToken();
    if (!token) return;
    setSavingSwimmerId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition/swimmers/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trainingWeekdays: row.trainingWeekdays }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        return;
      }
    } finally {
      setSavingSwimmerId(null);
    }
  };

  const saveNoTraining = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSavingNoTraining(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tuition/month-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: selectedMonth, noTrainingDates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        return;
      }
    } finally {
      setSavingNoTraining(false);
    }
  };

  const runCalculate = async () => {
    const token = await fetchToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition/calculate?month=${encodeURIComponent(selectedMonth)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to calculate");
        return;
      }
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleNoTraining = (date: string) => {
    setNoTrainingDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()
    );
  };

  const copySchedule = (row: CalculateRow) => {
    const text = row.scheduleLines.join("\n");
    void navigator.clipboard.writeText(text);
  };

  const copyAmountAndSchedule = (row: CalculateRow) => {
    const text = `Amount: $${row.tuition}\n\nSchedule:\n${row.scheduleLines.join("\n")}`;
    void navigator.clipboard.writeText(text);
  };

  const openEdit = (row: CalculateRow) => {
    setEditingRow(row);
    setEditForm({
      trainingWeekdays: [...row.trainingWeekdays],
      trainingTimeSlot: row.timeSlot,
      trainingLocation: row.location,
      ratePerHourOverride: "",
    });
  };

  const toggleEditWeekday = (wd: number) => {
    setEditForm((prev) => ({
      ...prev,
      trainingWeekdays: prev.trainingWeekdays.includes(wd)
        ? prev.trainingWeekdays.filter((n) => n !== wd)
        : [...prev.trainingWeekdays, wd].sort((a, b) => a - b),
    }));
  };

  const saveSwimmerConfig = async () => {
    if (!editingRow) return;
    const token = await fetchToken();
    if (!token) return;
    setSavingSwimmer(true);
    setError("");
    try {
      const body: {
        trainingWeekdays: number[];
        trainingTimeSlot: string | null;
        trainingLocation: string | null;
        ratePerHourOverride: number | null;
      } = {
        trainingWeekdays: editForm.trainingWeekdays,
        trainingTimeSlot: editForm.trainingTimeSlot.trim() || null,
        trainingLocation: editForm.trainingLocation.trim() || null,
        ratePerHourOverride:
          editForm.ratePerHourOverride === "" || editForm.ratePerHourOverride === null
            ? null
            : Number(editForm.ratePerHourOverride),
      };
      const res = await fetch(`/api/admin/tuition/swimmers/${editingRow.swimmerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
        return;
      }
      setEditingRow(null);
      await runCalculate();
    } finally {
      setSavingSwimmer(false);
    }
  };

  const saveLevelConfig = async () => {
    if (!levelConfig) return;
    const token = await fetchToken();
    if (!token) return;
    setSavingLevelConfig(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tuition/level-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ levels: levelConfig }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save level config");
        return;
      }
    } finally {
      setSavingLevelConfig(false);
    }
  };

  const datesInMonth = getDatesInMonth(selectedMonth);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-600" />
            Monthly Tuition & Schedule
          </h1>
          <p className="text-slate-600">
            Calculate next month&apos;s tuition and training schedule by level and training days. Set no-training dates, then run calculation.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Tabs defaultValue="main" onValueChange={(v) => v === "swimmers" && swimmerList.length === 0 && !loadingSwimmerList && loadSwimmerList()}>
          <TabsList>
            <TabsTrigger value="main">Tuition & Schedule</TabsTrigger>
            <TabsTrigger value="swimmers">
              <Users className="w-4 h-4 mr-1" />
              Swimmer training days
            </TabsTrigger>
            <TabsTrigger value="levels">
              <Settings className="w-4 h-4 mr-1" />
              Level Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="space-y-6 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Month & No-Training Dates
                </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Month</Label>
                      <Input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <Button onClick={saveNoTraining} disabled={savingNoTraining} variant="outline">
                      {savingNoTraining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save No-Training Dates
                    </Button>
                    <Button onClick={runCalculate} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
                      Calculate Tuition
                    </Button>
                  </div>
                  <Label className="text-slate-600">Select dates when there is no training (pool closed / conflict):</Label>
                  <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-2 mt-2">
                    {datesInMonth.map((dateStr) => {
                      const [y, m, d] = dateStr.split("-").map(Number);
                      const dayNum = d;
                      const checked = noTrainingDates.includes(dateStr);
                      return (
                        <label
                          key={dateStr}
                          className={`flex flex-col items-center rounded border p-2 cursor-pointer text-xs ${
                            checked ? "bg-red-100 border-red-300" : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNoTraining(dateStr)}
                            className="sr-only"
                          />
                          <span className="font-medium">{dayNum}</span>
                          <span className="text-slate-500">{new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}</span>
                        </label>
                      );
                    })}
                  </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{monthLabel(selectedMonth)} — Results</CardTitle>
              </CardHeader>
              <CardContent>
                  {results.length === 0 ? (
                    <p className="text-slate-500 py-4">Click &quot;Calculate Tuition&quot; to see results.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b text-slate-600">
                            <th className="p-2 w-8"></th>
                            <th className="p-2 font-semibold">Swimmer</th>
                            <th className="p-2 font-semibold">Level</th>
                            <th className="p-2 font-semibold">Training Days</th>
                            <th className="p-2 font-semibold text-right">Sessions</th>
                            <th className="p-2 font-semibold text-right">$/hr</th>
                            <th className="p-2 font-semibold text-right">Tuition</th>
                            <th className="p-2 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((row) => (
                            <React.Fragment key={row.swimmerId}>
                              <tr
                                className={`border-b ${row.needsConfig ? "bg-amber-50" : ""}`}
                              >
                                <td className="p-2">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedId(expandedId === row.swimmerId ? null : row.swimmerId)}
                                    className="p-0.5"
                                  >
                                    {expandedId === row.swimmerId ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-2 font-medium">{row.swimmerName}</td>
                                <td className="p-2">{row.level || "—"}</td>
                                <td className="p-2">
                                  {row.trainingWeekdays.length > 0
                                    ? row.trainingWeekdays.map((wd) => WEEKDAYS[wd]).join(", ")
                                    : "—"}
                                </td>
                                <td className="p-2 text-right">{row.sessionCount}</td>
                                <td className="p-2 text-right">${row.ratePerHour}</td>
                                <td className="p-2 text-right font-medium">${row.tuition}</td>
                                <td className="p-2">
                                  <div className="flex flex-wrap gap-1">
                                    <Button size="sm" variant="outline" onClick={() => openEdit(row)} title="Edit training config">
                                      Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => copySchedule(row)} title="Copy schedule">
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => copyAmountAndSchedule(row)} title="Copy amount & schedule">
                                      All
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {expandedId === row.swimmerId && (
                                <tr className="bg-slate-50">
                                  <td colSpan={8} className="p-3">
                                    <div className="text-sm font-medium text-slate-700 mb-1">Training schedule:</div>
                                    <pre className="bg-white border rounded p-3 text-xs whitespace-pre-wrap font-sans">
                                      {row.scheduleLines.length > 0 ? row.scheduleLines.join("\n") : "No sessions this month."}
                                    </pre>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swimmers" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Swimmer training days
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Only swimmers with a group (level) are listed. Set which weekdays each swimmer trains (time & location come from level config).
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={loadSwimmerList} disabled={loadingSwimmerList}>
                    {loadingSwimmerList ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Refresh list
                  </Button>
                </div>
                {loadingSwimmerList && swimmerList.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">Loading swimmers…</p>
                ) : swimmerList.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">No swimmers with group assignment. Assign a level to swimmers first.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b text-slate-600">
                          <th className="p-2 font-semibold">Swimmer</th>
                          <th className="p-2 font-semibold">Level</th>
                          {WEEKDAYS.map((d) => (
                            <th key={d} className="p-1 text-center font-semibold w-12">{d.slice(0, 2)}</th>
                          ))}
                          <th className="p-2 font-semibold">Save</th>
                        </tr>
                      </thead>
                      <tbody>
                        {swimmerList.map((row) => (
                          <tr key={row.id} className="border-b">
                            <td className="p-2 font-medium">{row.swimmerName}</td>
                            <td className="p-2">{row.level}</td>
                            {WEEKDAYS.map((_, wd) => (
                              <td key={wd} className="p-1 text-center">
                                <Checkbox
                                  checked={row.trainingWeekdays.includes(wd)}
                                  onCheckedChange={() => toggleSwimmerWeekday(row.id, wd)}
                                />
                              </td>
                            ))}
                            <td className="p-2">
                              <Button
                                size="sm"
                                onClick={() => saveSwimmerInList(row)}
                                disabled={savingSwimmerId === row.id}
                              >
                                {savingSwimmerId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
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

          <TabsContent value="levels" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Level config — $/hr, days & schedule (time & location per weekday)</CardTitle>
                <p className="text-sm text-slate-500">Each level can have different time and location per weekday. Default time/location is used as fallback (e.g. make-up days).</p>
              </CardHeader>
              <CardContent>
                  {levelConfig ? (
                    <div className="space-y-6">
                      {Object.entries(levelConfig).map(([level, cfg]) => (
                        <div key={level} className="border rounded-lg p-4 bg-slate-50/50 space-y-3">
                          <div className="font-semibold text-slate-800">{level}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
                            <div>
                              <Label className="text-xs">$/hr</Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={cfg.defaultRatePerHour}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev ? { ...prev, [level]: { ...cfg, defaultRatePerHour: Number(e.target.value) || 0 } } : null
                                  )}
                                className="w-20"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Days/wk</Label>
                              <Input
                                type="number"
                                min={0}
                                max={7}
                                value={cfg.daysPerWeek}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev ? { ...prev, [level]: { ...cfg, daysPerWeek: Number(e.target.value) || 0 } } : null
                                  )}
                                className="w-16"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Min days</Label>
                              <Input
                                type="number"
                                min={0}
                                max={7}
                                value={cfg.minDaysPerWeek}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev ? { ...prev, [level]: { ...cfg, minDaysPerWeek: Number(e.target.value) || 0 } } : null
                                  )}
                                className="w-16"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Reduced $/hr</Label>
                              <Input
                                type="number"
                                min={0}
                                placeholder="—"
                                value={cfg.reducedRatePerHour ?? ""}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          [level]: {
                                            ...cfg,
                                            reducedRatePerHour: e.target.value === "" ? null : Number(e.target.value) || null,
                                          },
                                        }
                                      : null
                                  )}
                                className="w-20"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Default time</Label>
                              <Input
                                value={cfg.defaultTimeSlot}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev ? { ...prev, [level]: { ...cfg, defaultTimeSlot: e.target.value } } : null
                                  )}
                                placeholder="7-8PM"
                                className="w-24"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Default location</Label>
                              <Input
                                value={cfg.defaultLocation}
                                onChange={(e) =>
                                  setLevelConfig((prev) =>
                                    prev ? { ...prev, [level]: { ...cfg, defaultLocation: e.target.value } } : null
                                  )}
                                placeholder="Mary Wayte Pool"
                                className="min-w-[140px]"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs block mb-2">Schedule (weekday → time & location)</Label>
                            <div className="space-y-2">
                              {(cfg.schedule ?? []).map((slot, idx) => (
                                <div key={`${level}-${idx}`} className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={slot.weekday}
                                    onChange={(e) => {
                                      const wd = Number(e.target.value);
                                      setLevelConfig((prev) => {
                                        if (!prev) return null;
                                        const schedule = [...(prev[level]?.schedule ?? [])];
                                        schedule[idx] = { ...slot, weekday: wd };
                                        return { ...prev, [level]: { ...prev[level], schedule } };
                                      });
                                    }}
                                    className="border rounded px-2 py-1.5 text-sm w-24"
                                  >
                                    {WEEKDAYS.map((label, wd) => (
                                      <option key={wd} value={wd}>{label}</option>
                                    ))}
                                  </select>
                                  <Input
                                    value={slot.timeSlot}
                                    onChange={(e) => {
                                      setLevelConfig((prev) => {
                                        if (!prev) return null;
                                        const schedule = [...(prev[level]?.schedule ?? [])];
                                        schedule[idx] = { ...slot, timeSlot: e.target.value };
                                        return { ...prev, [level]: { ...prev[level], schedule } };
                                      });
                                    }}
                                    placeholder="7-8PM"
                                    className="w-24"
                                  />
                                  <Input
                                    value={slot.location}
                                    onChange={(e) => {
                                      setLevelConfig((prev) => {
                                        if (!prev) return null;
                                        const schedule = [...(prev[level]?.schedule ?? [])];
                                        schedule[idx] = { ...slot, location: e.target.value };
                                        return { ...prev, [level]: { ...prev[level], schedule } };
                                      });
                                    }}
                                    placeholder="Mary Wayte Pool"
                                    className="min-w-[140px]"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() => {
                                      setLevelConfig((prev) => {
                                        if (!prev) return null;
                                        const schedule = (prev[level]?.schedule ?? []).filter((_, i) => i !== idx);
                                        return { ...prev, [level]: { ...prev[level], schedule } };
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setLevelConfig((prev) => {
                                    if (!prev) return null;
                                    const schedule = [...(prev[level]?.schedule ?? []), { weekday: 1, timeSlot: "7-8PM", location: "Mary Wayte Pool" }];
                                    return { ...prev, [level]: { ...prev[level], schedule } };
                                  });
                                }}
                              >
                                Add slot
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button onClick={saveLevelConfig} disabled={savingLevelConfig}>
                        {savingLevelConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Level Config
                      </Button>
                    </div>
                  ) : (
                    <p className="text-slate-500">Loading level config…</p>
                  )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
          <DialogContent showCloseButton className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit training config — {editingRow?.swimmerName}</DialogTitle>
            </DialogHeader>
            {editingRow && (
              <div className="space-y-4 py-2">
                <div>
                  <Label>Training days (week)</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {WEEKDAYS.map((label, wd) => (
                      <label key={wd} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={editForm.trainingWeekdays.includes(wd)}
                          onCheckedChange={() => toggleEditWeekday(wd)}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-time">Time slot</Label>
                  <Input
                    id="edit-time"
                    value={editForm.trainingTimeSlot}
                    onChange={(e) => setEditForm((p) => ({ ...p, trainingTimeSlot: e.target.value }))}
                    placeholder="e.g. 7-8PM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location</Label>
                  <Input
                    id="edit-location"
                    value={editForm.trainingLocation}
                    onChange={(e) => setEditForm((p) => ({ ...p, trainingLocation: e.target.value }))}
                    placeholder="e.g. Mary Wayte Pool"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rate">Rate per hour override (optional)</Label>
                  <Input
                    id="edit-rate"
                    type="number"
                    min={0}
                    step={1}
                    value={editForm.ratePerHourOverride}
                    onChange={(e) => setEditForm((p) => ({ ...p, ratePerHourOverride: e.target.value }))}
                    placeholder="Leave empty to use level default"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRow(null)}>
                Cancel
              </Button>
              <Button onClick={saveSwimmerConfig} disabled={savingSwimmer}>
                {savingSwimmer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
