// app/admin/attendance/report/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/header";
import { Users, TrendingDown, Download, Loader2, CalendarDays } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Swimmer {
  id: string;
  childFirstName: string;
  childLastName: string;
  level?: string;
  isFrozen?: boolean;
}

interface AttendanceRecord {
  id: string;
  date: string;
  swimmerId: string;
  swimmerName: string;
  status: "attended" | "absent" | "make-up" | "trial";
}

interface AttendanceStats {
  swimmerId: string;
  swimmerName: string;
  level?: string;
  totalDays: number;
  attended: number;
  absent: number;
  makeUp: number;
  trial: number;
  netAbsent: number; // absent - make-up (can be negative)
  attendanceRate: number;
}

export default function AttendanceReportPage() {
  const isAdmin = useIsAdminFromDB();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return new Date().getFullYear().toString();
  });
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [displayMode, setDisplayMode] = useState<"swimmer" | "day">("swimmer"); // swimmer = stats table, day = who attended each day
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load swimmers
  useEffect(() => {
    const loadSwimmers = async () => {
      try {
        const snap = await getDocs(collection(db, "swimmers"));
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Swimmer[];
        setSwimmers(data.sort((a, b) => {
          const nameA = `${a.childFirstName} ${a.childLastName}`;
          const nameB = `${b.childFirstName} ${b.childLastName}`;
          return nameA.localeCompare(nameB);
        }));
      } catch (err) {
        console.error("Load swimmers error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      loadSwimmers();
    }
  }, [isAdmin]);

  // Load attendance
  useEffect(() => {
    const loadAttendance = async () => {
      if (!isAdmin) return;

      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const param = viewMode === "month" ? `month=${encodeURIComponent(selectedMonth)}` : `year=${encodeURIComponent(selectedYear)}`;
        const url = `/api/attendance?${param}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAttendance(data.records || []);
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("Failed to load attendance:", errorData);
        }
      } catch (err) {
        console.error("Load attendance error:", err);
      }
    };

    loadAttendance();
  }, [selectedMonth, selectedYear, viewMode, isAdmin]);

  // Calculate statistics
  const stats = useMemo(() => {
    const statsMap: Record<string, AttendanceStats> = {};

    // Initialize all swimmers (exclude frozen swimmers)
    swimmers.forEach((swimmer) => {
      // Skip frozen swimmers
      if (swimmer.isFrozen) return;
      
      const swimmerName = `${swimmer.childFirstName} ${swimmer.childLastName}`;
      statsMap[swimmer.id] = {
        swimmerId: swimmer.id,
        swimmerName,
        level: swimmer.level,
        totalDays: 0,
        attended: 0,
        absent: 0,
        makeUp: 0,
        trial: 0,
        netAbsent: 0,
        attendanceRate: 0,
      };
    });

    // Count attendance
    attendance.forEach((record) => {
      if (!statsMap[record.swimmerId]) {
        statsMap[record.swimmerId] = {
          swimmerId: record.swimmerId,
          swimmerName: record.swimmerName,
          level: undefined,
          totalDays: 0,
          attended: 0,
          absent: 0,
          makeUp: 0,
          trial: 0,
          netAbsent: 0,
          attendanceRate: 0,
        };
      }

      statsMap[record.swimmerId].totalDays++;
      if (record.status === "attended") {
        statsMap[record.swimmerId].attended++;
      } else if (record.status === "absent") {
        statsMap[record.swimmerId].absent++;
      } else if (record.status === "make-up") {
        statsMap[record.swimmerId].makeUp++;
      } else if (record.status === "trial") {
        statsMap[record.swimmerId].trial++;
      }
    });

    // Calculate net absent (absent - make-up) and attendance rate
    Object.values(statsMap).forEach((stat) => {
      stat.netAbsent = stat.absent - stat.makeUp;
      const total = stat.attended + stat.absent + stat.makeUp + stat.trial;
      if (total > 0) {
        stat.attendanceRate = (stat.attended / total) * 100;
      }
    });

    return Object.values(statsMap).sort((a, b) => {
      // Sort by net absent (highest first), then by attendance rate (lowest first), then by name
      if (a.netAbsent !== b.netAbsent) {
        return b.netAbsent - a.netAbsent;
      }
      if (a.attendanceRate !== b.attendanceRate) {
        return a.attendanceRate - b.attendanceRate;
      }
      return a.swimmerName.localeCompare(b.swimmerName);
    });
  }, [attendance, swimmers]);

  // swimmerId -> level for grouping by day
  const swimmerIdToLevel = useMemo(() => {
    const m: Record<string, string> = {};
    swimmers.forEach((s) => {
      m[s.id] = (s.level && s.level.trim()) ? s.level.trim() : "Unknown";
    });
    return m;
  }, [swimmers]);

  // Group attendance by date, then by level (for "who attended each day" view)
  type DayByLevel = Record<string, { attended: string[]; absent: string[]; makeUp: string[]; trial: string[] }>;
  const attendanceByDay = useMemo(() => {
    const byDate: Record<string, DayByLevel> = {};
    attendance.forEach((record) => {
      const date = record.date;
      const level = swimmerIdToLevel[record.swimmerId] ?? "Unknown";
      if (!byDate[date]) {
        byDate[date] = {};
      }
      if (!byDate[date][level]) {
        byDate[date][level] = { attended: [], absent: [], makeUp: [], trial: [] };
      }
      const bucket = byDate[date][level];
      if (record.status === "attended") {
        bucket.attended.push(record.swimmerName);
      } else if (record.status === "absent") {
        bucket.absent.push(record.swimmerName);
      } else if (record.status === "make-up") {
        bucket.makeUp.push(record.swimmerName);
      } else if (record.status === "trial") {
        bucket.trial.push(record.swimmerName);
      }
    });
    // Sort names within each bucket; sort dates descending (newest first)
    Object.keys(byDate).forEach((date) => {
      Object.keys(byDate[date]).forEach((level) => {
        const b = byDate[date][level];
        b.attended.sort();
        b.absent.sort();
        b.makeUp.sort();
        b.trial.sort();
      });
    });
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [attendance, swimmerIdToLevel]);

  // Group by level
  const statsByLevel = useMemo(() => {
    const grouped: Record<string, AttendanceStats[]> = {};
    stats.forEach((stat) => {
      const level = stat.level || "Unknown";
      if (!grouped[level]) {
        grouped[level] = [];
      }
      grouped[level].push(stat);
    });
    return grouped;
  }, [stats]);

  const exportCSV = () => {
    const header = ["Swimmer Name", "Level", "Total Days", "Attended", "Absent", "Make-up", "Trial", "Net Absent", "Attendance Rate (%)"];
    const lines = [header.join(",")];
    
    stats.forEach((stat) => {
      lines.push(
        [
          stat.swimmerName,
          stat.level || "",
          stat.totalDays,
          stat.attended,
          stat.absent,
          stat.makeUp,
          stat.trial,
          stat.netAbsent,
          stat.attendanceRate.toFixed(1),
        ]
          .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
          .join(",")
      );
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const period = viewMode === "month" ? selectedMonth : selectedYear;
    a.download = `attendance-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-blue-600" />
            Attendance Report
          </h1>
          <p className="text-slate-600">View attendance by month or year — by swimmer (stats) or by day (who attended each day)</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="viewMode">Period</Label>
                <Select value={viewMode} onValueChange={(value) => setViewMode(value as "month" | "year")}>
                  <SelectTrigger id="viewMode" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="displayMode">Display</Label>
                <Select value={displayMode} onValueChange={(value) => setDisplayMode(value as "swimmer" | "day")}>
                  <SelectTrigger id="displayMode" className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swimmer">By swimmer (stats)</SelectItem>
                    <SelectItem value="day">By day (who attended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {viewMode === "month" ? (
                <div className="flex-1">
                  <Label htmlFor="month">Month</Label>
                  <Input
                    id="month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex-1">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min="2020"
                    max="2100"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={exportCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading...</p>
          </div>
        ) : displayMode === "day" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Who attended each day
            </h2>
            {attendanceByDay.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-slate-500">
                  No attendance records for the selected period.
                </CardContent>
              </Card>
            ) : (
              attendanceByDay.map(([date, dayDataByLevel]) => {
                const displayDate = (() => {
                  try {
                    const [y, m, d] = date.split("-").map(Number);
                    const dt = new Date(y, m - 1, d);
                    return dt.toLocaleDateString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  } catch {
                    return date;
                  }
                })();
                const levels = Object.keys(dayDataByLevel).sort((a, b) => a.localeCompare(b));
                const total = levels.reduce(
                  (sum, level) => {
                    const b = dayDataByLevel[level];
                    return sum + b.attended.length + b.absent.length + b.makeUp.length + b.trial.length;
                  },
                  0
                );
                return (
                  <Card key={date}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{displayDate}</span>
                        <span className="text-sm font-normal text-slate-500">{total} records</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {levels.map((level) => {
                        const b = dayDataByLevel[level];
                        const levelTotal = b.attended.length + b.absent.length + b.makeUp.length + b.trial.length;
                        if (levelTotal === 0) return null;
                        return (
                          <div key={level} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                            <div className="font-semibold text-slate-800 mb-1">{level} ({levelTotal})</div>
                            {b.attended.length > 0 && (
                              <div>
                                <span className="font-medium text-green-700">Attended ({b.attended.length}):</span>{" "}
                                <span className="text-slate-700">{b.attended.join(", ")}</span>
                              </div>
                            )}
                            {b.absent.length > 0 && (
                              <div>
                                <span className="font-medium text-red-700">Absent ({b.absent.length}):</span>{" "}
                                <span className="text-slate-700">{b.absent.join(", ")}</span>
                              </div>
                            )}
                            {b.makeUp.length > 0 && (
                              <div>
                                <span className="font-medium text-blue-700">Make-up ({b.makeUp.length}):</span>{" "}
                                <span className="text-slate-700">{b.makeUp.join(", ")}</span>
                              </div>
                            )}
                            {b.trial.length > 0 && (
                              <div>
                                <span className="font-medium text-purple-700">Trial ({b.trial.length}):</span>{" "}
                                <span className="text-slate-700">{b.trial.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grouped by Level */}
            {Object.entries(statsByLevel)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([level, levelStats]) => (
                <Card key={level}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {level} ({levelStats.length} swimmers)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-600 border-b">
                            <th className="p-3 font-semibold">Swimmer Name</th>
                            <th className="p-3 font-semibold text-center">Total Days</th>
                            <th className="p-3 font-semibold text-center">Attended</th>
                            <th className="p-3 font-semibold text-center">Absent</th>
                            <th className="p-3 font-semibold text-center">Make-up</th>
                            <th className="p-3 font-semibold text-center">Trial</th>
                            <th className="p-3 font-semibold text-center">Net Absent</th>
                            <th className="p-3 font-semibold text-center">Attendance Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelStats.map((stat, idx) => (
                            <tr key={stat.swimmerId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="p-3 font-medium text-slate-800">{stat.swimmerName}</td>
                              <td className="p-3 text-center">{stat.totalDays}</td>
                              <td className="p-3 text-center text-green-600 font-medium">{stat.attended}</td>
                              <td className="p-3 text-center text-red-600 font-medium">{stat.absent}</td>
                              <td className="p-3 text-center text-blue-600 font-medium">{stat.makeUp}</td>
                              <td className="p-3 text-center text-purple-600 font-medium">{stat.trial}</td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                    stat.netAbsent > 0
                                      ? "bg-red-100 text-red-700"
                                      : stat.netAbsent < 0
                                      ? "bg-green-100 text-green-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {stat.netAbsent > 0 ? "+" : ""}{stat.netAbsent}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                    stat.attendanceRate >= 90
                                      ? "bg-green-100 text-green-700"
                                      : stat.attendanceRate >= 70
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {stat.attendanceRate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

