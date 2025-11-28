// ./src/app/survey/activity-result/page.tsx
"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, ListChecks, Download, Users, Calendar, MapPin, RefreshCw } from "lucide-react";
import { SwimmerLevel, getLevelGroup } from "@/lib/swimmer-levels";
import Header from "@/components/header";

interface DemandRow {
  location: string;
  label: string;
  dateKey: string;
  swimmers: {
    key: string;
    swimmerName: string;
    parentEmail: string;
    parentPhone: string;
    level: SwimmerLevel | string;
    submittedAt?: number; // Timestamp in milliseconds
    submissionId?: string;
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
  a.download = `${location.replaceAll(" ", "_")}-activity-roster.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHeadcountCSV(rows: DemandRow[]) {
  const header = ["Location", "Date/Time", "Unique Swimmers"];
  const lines = [header.join(",")];
  const sorted = rows
    .slice()
    .sort((a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label));
  sorted.forEach((r) => {
    // Count unique swimmers
    const uniqueSwimmers = new Set(r.swimmers.map((s) => s.key));
    lines.push(
      [r.location, r.label, String(uniqueSwimmers.size)]
        .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "activity-headcount.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- 级别统计（改进版） ---------- */
function LevelDistribution({ byLevel }: { byLevel: Record<string, number> }) {
  // Group levels by group (Bronze, Silver, etc.)
  const grouped = useMemo(() => {
    const groups: Record<string, { total: number; levels: Array<{ level: string; count: number }> }> = {};
    
    Object.entries(byLevel).forEach(([level, count]) => {
      const group = getLevelGroup(level as SwimmerLevel);
      if (!groups[group]) {
        groups[group] = { total: 0, levels: [] };
      }
      groups[group].total += count;
      groups[group].levels.push({ level, count });
    });
    
    return groups;
  }, [byLevel]);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Level Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(grouped).map(([group, data]) => (
            <div key={group} className="border rounded-lg p-4 bg-gradient-to-br from-slate-50 to-white">
              <div className="font-bold text-lg text-slate-800 mb-2">{group}</div>
              <div className="text-2xl font-bold text-blue-600 mb-3">{data.total}</div>
              <div className="space-y-1 text-sm">
                {data.levels.map(({ level, count }) => (
                  <div key={level} className="flex justify-between text-slate-600">
                    <span>{level.replace(`${group} `, "")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- 人数统计（改进版） ---------- */
function HeadcountStats({ rows }: { rows: DemandRow[] }) {
  // Count unique swimmers per location (not preferences)
  const byLoc = useMemo(() => {
    const base: Record<string, { sessions: number; uniqueSwimmers: Set<string> }> = {};
    for (const r of rows) {
      const b = (base[r.location] ||= { sessions: 0, uniqueSwimmers: new Set() });
      b.sessions += 1;
      // Add unique swimmers for this session
      r.swimmers.forEach((s) => {
        b.uniqueSwimmers.add(s.key); // Use key to identify unique swimmers
      });
    }
    return Object.entries(base)
      .map(([loc, data]) => ({
        location: loc,
        sessions: data.sessions,
        uniqueSwimmers: data.uniqueSwimmers.size,
      }))
      .sort((a, b) => a.location.localeCompare(b.location));
  }, [rows]);

  // Count unique swimmers per session
  const perSession = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label))
      .map((r) => {
        // Count unique swimmers in this session
        const uniqueSwimmers = new Set(r.swimmers.map((s) => s.key));
        return {
          location: r.location,
          label: r.label,
          uniqueSwimmers: uniqueSwimmers.size,
        };
      });
  }, [rows]);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Headcount by Location & Time
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportHeadcountCSV(rows)}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary by location */}
        <div>
          <h3 className="font-semibold text-slate-800 mb-3">Summary by Location</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {byLoc.map((item) => (
              <div key={item.location} className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-slate-600" />
                  <span className="font-medium text-slate-800">{item.location}</span>
                </div>
                <div className="text-sm text-slate-600">
                  <div>{item.sessions} session(s)</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">{item.uniqueSwimmers} unique swimmers</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Per session table */}
        <div>
          <h3 className="font-semibold text-slate-800 mb-3">Per Session Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold">Date/Time</th>
                <th className="p-3 font-semibold text-center">Unique Swimmers</th>
                </tr>
              </thead>
              <tbody>
                {perSession.map((r, idx) => (
                  <tr key={r.location + r.label} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-3 whitespace-nowrap">{r.location}</td>
                    <td className="p-3">{r.label}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        r.uniqueSwimmers === 0 ? "bg-slate-100 text-slate-600" :
                        r.uniqueSwimmers < 5 ? "bg-amber-100 text-amber-700" :
                        r.uniqueSwimmers < 10 ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {r.uniqueSwimmers}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- 详细名单（改进版） ---------- */
function RosterByLocation({ rows }: { rows: DemandRow[] }) {
  const grouped = groupByLocation(rows);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Detailed Roster by Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(grouped).map(([loc, sessions]) => {
          // Calculate unique swimmers and total interests for this location
          const uniqueSwimmerKeys = new Set<string>();
          let totalInterests = 0;
          
          sessions.forEach((s) => {
            totalInterests += s.swimmers.length; // Total preferences/interests
            s.swimmers.forEach((swimmer) => {
              uniqueSwimmerKeys.add(swimmer.key); // Unique swimmers
            });
          });
          
          return (
            <div key={loc} className="border-2 rounded-lg border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b-2 border-slate-200">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-800">{loc}</h3>
                <span className="text-sm text-slate-600">
                  {uniqueSwimmerKeys.size} unique swimmer{uniqueSwimmerKeys.size !== 1 ? "s" : ""}, {totalInterests} interest{totalInterests !== 1 ? "s" : ""}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportLocationCSV(loc, sessions)}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {sessions.map((s) => (
                <div key={s.label} className="border rounded-lg border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-800">{s.label}</span>
                    </div>
                    <span className="text-sm text-slate-600 font-medium">
                      {s.swimmers.length} swimmer{s.swimmers.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="p-4">
                    {s.swimmers.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No signups for this session</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-600 border-b">
                            <th className="p-3 font-semibold">Swimmer Name</th>
                            <th className="p-3 font-semibold">Level</th>
                            <th className="p-3 font-semibold">Submitted At</th>
                            <th className="p-3 font-semibold">Parent Email</th>
                            <th className="p-3 font-semibold">Parent Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.swimmers
                            .slice()
                            .sort((a, b) => {
                              // Sort by submission time (first come first serve), then by name
                              if (a.submittedAt && b.submittedAt) {
                                return a.submittedAt - b.submittedAt;
                              }
                              if (a.submittedAt) return -1;
                              if (b.submittedAt) return 1;
                              return a.swimmerName.localeCompare(b.swimmerName);
                            })
                            .map((w, idx) => {
                              const submittedDate = w.submittedAt 
                                ? new Date(w.submittedAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : "Unknown";
                              return (
                                <tr key={w.key} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="p-3 font-medium text-slate-800">{w.swimmerName}</td>
                                  <td className="p-3">
                                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                      {w.level}
                                    </span>
                                  </td>
                                  <td className="p-3 text-sm text-slate-600">
                                    {submittedDate}
                                  </td>
                                  <td className="p-3">
                                    <a
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                                      href={`mailto:${w.parentEmail}`}
                                    >
                                      <Mail className="w-4 h-4" />
                                      {w.parentEmail}
                                    </a>
                                  </td>
                                  <td className="p-3">
                                    {w.parentPhone ? (
                                      <a
                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                                        href={`tel:${w.parentPhone}`}
                                      >
                                        <Phone className="w-4 h-4" />
                                        {w.parentPhone}
                                      </a>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---------- 页面主体（内部组件） ---------- */
function ArrangementPageContent() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [data, setData] = useState<AggregatePayload | null>(null);
  const searchParams = useSearchParams();
  const initialSeason = searchParams.get("season") || "";
  const [season, setSeason] = useState<string>(initialSeason);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const loadData = async (seasonValue: string) => {
    if (!seasonValue.trim()) return;
    
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }

      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/clinic/admin/aggregate?season=${encodeURIComponent(seasonValue)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push("/not-authorized");
          return;
        }
        throw new Error("Failed to load data");
      }
      
      const json = (await res.json()) as AggregatePayload;
      setData(json);
    } catch (err) {
      console.error("Load data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      
      // Check admin
      const email = (user.email || "").toLowerCase();
      const adminSnap = await getDoc(doc(db, "admin", email));
      if (!adminSnap.exists()) {
        router.push("/not-authorized");
        return;
      }
      
      setIsAdmin(true);
      setChecked(true);
      
      // Load data if season is set
      if (season) {
        await loadData(season);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Update season when URL param changes
  useEffect(() => {
    const urlSeason = searchParams.get("season");
    if (urlSeason && urlSeason !== season) {
      setSeason(urlSeason);
      if (isAdmin) {
        loadData(urlSeason);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isAdmin]);

  const handleReload = () => {
    if (season) {
      loadData(season);
    }
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-slate-600">Checking admin access…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Activity Submissions</h1>
          <p className="text-slate-600">View and analyze activity preferences by location and time</p>
        </div>

        {/* Season Selector */}
        <Card className="mb-6 border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="season" className="text-sm font-semibold text-slate-700 mb-2 block">
                  Season
                </Label>
                <Input
                  id="season"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="e.g. Winter Break 2025–26"
                  className="w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && season) {
                      loadData(season);
                    }
                  }}
                />
              </div>
              <Button 
                onClick={handleReload} 
                disabled={!season.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Load Data
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Display */}
        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading data...</p>
          </div>
        ) : !data ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-20 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600">Enter a season and click &quot;Load Data&quot; to view submissions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Unique Swimmers</p>
                      <p className="text-3xl font-bold text-blue-700">{data.uniqueSwimmers}</p>
                    </div>
                    <Users className="w-10 h-10 text-blue-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Sessions</p>
                      <p className="text-3xl font-bold text-green-700">{data.rows.length}</p>
                    </div>
                    <Calendar className="w-10 h-10 text-green-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Total Preferences</p>
                      <p className="text-3xl font-bold text-purple-700">
                        {data.rows.reduce((sum, r) => sum + r.swimmers.length, 0)}
                      </p>
                    </div>
                    <ListChecks className="w-10 h-10 text-purple-600 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Level Distribution */}
            <LevelDistribution byLevel={data.byLevel} />

            {/* Headcount Stats */}
            <HeadcountStats rows={data.rows} />

            {/* Detailed Roster */}
            <RosterByLocation rows={data.rows} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 页面主体（导出） ---------- */
export default function ArrangementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <ArrangementPageContent />
    </Suspense>
  );
}
