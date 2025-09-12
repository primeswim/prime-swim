// ./src/app/survey/clinic-result/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, BarChart3, Phone, Mail, ListChecks } from "lucide-react";

type Level =
  | "beginner-kicks-bubbles"
  | "novice-25y-freestyle"
  | "intermediate-4-strokes-basic"
  | "advanced-legal-4-strokes";

interface DemandRow {
  location: string;
  label: string;
  dateKey: string;
  swimmers: {
    key: string;
    swimmerName: string;
    parentEmail: string;
    parentPhone: string;
    level: Level;
  }[];
}

interface AggregatePayload {
  rows: DemandRow[];
  byLevel: Record<string, number>;
  uniqueSwimmers: number;
  season: string | null;
}

/* ---------- 帮助函数 ---------- */
function groupByLocation(rows: DemandRow[]) {
  const map: Record<string, DemandRow[]> = {};
  for (const r of rows) {
    (map[r.location] ||= []).push(r);
  }
  for (const loc of Object.keys(map)) {
    map[loc].sort((a, b) => a.label.localeCompare(b.label));
  }
  return map;
}

function exportLocationCSV(location: string, sessions: DemandRow[]) {
  const header = ["Location", "Date/Time", "Swimmer", "Level", "Parent Email", "Parent Phone"];
  const lines = [header.join(",")];
  sessions.forEach((s) => {
    s.swimmers.forEach((w) => {
      lines.push(
        [location, s.label, w.swimmerName, w.level, w.parentEmail, w.parentPhone]
          .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
          .join(",")
      );
    });
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${location.replaceAll(" ", "_")}-clinic-roster.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 导出人数统计（所有场馆/时段） */
function exportHeadcountCSV(rows: DemandRow[]) {
  const header = ["Location", "Date/Time", "Headcount"];
  const lines = [header.join(",")];
  const sorted = rows
    .slice()
    .sort((a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label));
  sorted.forEach((r) => {
    lines.push(
      [r.location, r.label, String(r.swimmers.length)]
        .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clinic-headcount.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- 模拟器 (保留) ---------- */
function Simulator({ rows }: { rows: DemandRow[] }) {
  const [capPerLane, setCapPerLane] = useState<number>(4);
  const [lanesByLocation, setLanesByLocation] = useState<Record<string, number>>(() => {
    const locs = Array.from(new Set(rows.map((r) => r.location)));
    const o: Record<string, number> = {};
    locs.forEach((l) => (o[l] = 4));
    return o;
  });

  const perSession = useMemo(() => {
    return rows.map((r) => {
      const cap = (lanesByLocation[r.location] || 0) * capPerLane;
      const demand = r.swimmers.length;
      return { ...r, capacity: cap, demand, delta: demand - cap };
    });
  }, [rows, lanesByLocation, capPerLane]);

  function updateLane(location: string, v: number) {
    setLanesByLocation((prev) => ({ ...prev, [location]: Math.max(0, Math.min(16, Math.floor(v))) }));
  }

  function downloadCSV() {
    const header = ["Location", "Date/Time", "Demand", "Capacity", "Over(+)/Under(-)"];
    const lines = [header.join(",")];
    perSession.forEach((s) => {
      lines.push(
        [s.location, s.label, String(s.demand), String(s.capacity), String(s.delta)]
          .map((x) => `"${x.replaceAll('"', '""')}"`)
          .join(",")
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clinic-arrangement.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Arrangement Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Capacity per lane</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={capPerLane}
                onChange={(e) => setCapPerLane(Number(e.target.value || 0))}
              />
              <p className="text-xs text-slate-500 mt-1">Typical 3–6 depending on level/age.</p>
            </div>
            {Object.keys(lanesByLocation).map((loc) => (
              <div key={loc}>
                <Label>{loc} — Lanes</Label>
                <Input
                  type="number"
                  min={0}
                  max={16}
                  value={lanesByLocation[loc]}
                  onChange={(e) => updateLane(loc, Number(e.target.value || 0))}
                />
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <Button onClick={downloadCSV}>Export CSV (Summary)</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary by location */}
      <div className="grid md:grid-cols-2 gap-6">
        {Object.entries(
          rowsToPerSession(rows).reduce(
            (acc, s) => {
              const b =
                (acc[s.location] ||= {
                  sessions: 0,
                  demand: 0,
                  capacity: 0,
                  over: 0,
                  under: 0,
                });
              b.sessions += 1;
              b.demand += s.demand;
              b.capacity += s.capacity;
              b.over += Math.max(0, s.delta);
              b.under += Math.max(0, -s.delta);
              return acc;
            },
            {} as Record<
              string,
              { sessions: number; demand: number; capacity: number; over: number; under: number }
            >
          )
        ).map(([loc, t]) => (
          <Card key={loc} className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>{loc}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-600">
                Sessions: {t.sessions} · Demand: {t.demand} · Capacity: {t.capacity}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {t.over > 0 ? (
                  <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
                    <AlertTriangle className="w-4 h-4" /> Over by {t.over}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Under by {t.under}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // 将 rows 转换为含 capacity 的结构（复用上面的 perSession 形状）
  function rowsToPerSession(rows0: DemandRow[]) {
    return rows0.map((r) => {
      const cap = (lanesByLocation[r.location] || 0) * capPerLane;
      const demand = r.swimmers.length;
      return { ...r, capacity: cap, demand, delta: demand - cap };
    });
  }
}

/* ---------- 人数统计（新增） ---------- */
function HeadcountStats({ rows }: { rows: DemandRow[] }) {
  const byLoc = useMemo(() => {
    const base: Record<string, { sessions: number; headcount: number }> = {};
    for (const r of rows) {
      const b = (base[r.location] ||= { sessions: 0, headcount: 0 });
      b.sessions += 1;
      b.headcount += r.swimmers.length;
    }
    return Object.entries(base).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const perSession = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label))
      .map((r) => ({ location: r.location, label: r.label, headcount: r.swimmers.length }));
  }, [rows]);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="w-5 h-5" /> Headcount（人数统计）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 总览（按场馆） */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">Location</th>
                <th className="p-2">Sessions</th>
                <th className="p-2">Total Headcount</th>
              </tr>
            </thead>
            <tbody>
              {byLoc.map(([loc, v]) => (
                <tr key={loc} className="border-t">
                  <td className="p-2 whitespace-nowrap">{loc}</td>
                  <td className="p-2">{v.sessions}</td>
                  <td className="p-2">{v.headcount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Separator />

        {/* 明细（按场馆×时段） */}
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-800">Per Session</div>
          <Button size="sm" onClick={() => exportHeadcountCSV(rows)}>
            Export CSV (Headcount)
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="p-2">Location</th>
                <th className="p-2">Date/Time</th>
                <th className="p-2">Headcount</th>
              </tr>
            </thead>
            <tbody>
              {perSession.map((r) => (
                <tr key={r.location + r.label} className="border-t">
                  <td className="p-2 whitespace-nowrap">{r.location}</td>
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">{r.headcount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Roster（按场馆，含联系方式） ---------- */
function RosterByLocation({ rows }: { rows: DemandRow[] }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Roster by Location (with Contacts)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {Object.entries(groupByLocation(rows)).map(([loc, sessions]) => (
          <div key={loc} className="border rounded-lg border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
              <div className="font-semibold">{loc}</div>
              <Button size="sm" onClick={() => exportLocationCSV(loc, sessions)}>
                Export {loc} CSV
              </Button>
            </div>
            <div className="p-4 space-y-6">
              {sessions.map((s) => (
                <div key={s.label} className="border rounded-md border-slate-200">
                  <div className="px-3 py-2 border-b bg-white font-medium">{s.label}</div>
                  <div className="p-3 overflow-x-auto">
                    {s.swimmers.length === 0 ? (
                      <div className="text-sm text-slate-500">No signups for this session.</div>
                    ) : (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-600">
                            <th className="p-2">Swimmer</th>
                            <th className="p-2">Level</th>
                            <th className="p-2">Parent Email</th>
                            <th className="p-2">Parent Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.swimmers
                            .slice()
                            .sort((a, b) => a.swimmerName.localeCompare(b.swimmerName))
                            .map((w) => (
                              <tr key={w.key} className="border-t">
                                <td className="p-2">{w.swimmerName}</td>
                                <td className="p-2">{w.level}</td>
                                <td className="p-2">
                                  <a
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                    href={`mailto:${w.parentEmail}`}
                                  >
                                    <Mail className="w-4 h-4" />
                                    {w.parentEmail}
                                  </a>
                                </td>
                                <td className="p-2">
                                  <a
                                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                    href={`tel:${w.parentPhone}`}
                                  >
                                    <Phone className="w-4 h-4" />
                                    {w.parentPhone || "-"}
                                  </a>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- 页面主体 ---------- */
export default function ArrangementPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [data, setData] = useState<AggregatePayload | null>(null);
  const [season, setSeason] = useState<string>("Winter Break 2025–26");

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      // admin gate
      const email = (user.email || "").toLowerCase();
      const adminSnap = await getDoc(doc(db, "admin", email));
      if (!adminSnap.exists()) {
        router.push("/not-authorized");
        return;
      }
      setIsAdmin(true);

      // call protected API
      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/clinic/admin/aggregate?season=${encodeURIComponent(season)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        router.push("/not-authorized");
        return;
      }
      const json = (await res.json()) as AggregatePayload;
      setData(json);
      setChecked(true);
    });

    return () => unsub();
  }, [router, season]);

  if (!checked) return <p className="text-center mt-10">Checking admin access…</p>;
  if (!isAdmin) return null;
  if (!data) return <p className="mt-10 text-center">Loading data…</p>;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Clinic Submissions — Analysis & Arrangement</h1>
          <p className="text-slate-600 mt-1">Total unique swimmers: {data.uniqueSwimmers}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="block text-sm mb-1">Season</Label>
            <Input value={season} onChange={(e) => setSeason(e.target.value)} className="w-[240px]" />
          </div>
          <Button onClick={() => setChecked(false /* reload */)}>Reload</Button>
        </div>
      </div>

      {/* Level Distribution */}
      <Card className="border-0 shadow-md mb-8">
        <CardHeader>
          <CardTitle>Level Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {Object.entries(data.byLevel).map(([lvl, n]) => (
              <div key={lvl} className="p-3 rounded border bg-slate-50 border-slate-200">
                <div className="font-medium">{lvl}</div>
                <div className="text-slate-600">{n}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ✅ 新增：人数统计（Headcount） */}
      <HeadcountStats rows={data.rows} />

      {/* 模拟器 + 按场馆名单 */}
      <div className="mt-8 space-y-8">
        <Simulator rows={data.rows} />
        <RosterByLocation rows={data.rows} />
      </div>
    </div>
  );
}
