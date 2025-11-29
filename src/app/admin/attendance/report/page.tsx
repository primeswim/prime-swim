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
import { Users, TrendingDown, Download, Loader2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Swimmer {
  id: string;
  childFirstName: string;
  childLastName: string;
  level?: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  swimmerId: string;
  swimmerName: string;
  status: "present" | "absent" | "excused";
}

interface AttendanceStats {
  swimmerId: string;
  swimmerName: string;
  totalDays: number;
  present: number;
  absent: number;
  excused: number;
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
        const res = await fetch(`/api/attendance?${param}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setAttendance(data.records || []);
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

    // Initialize all swimmers
    swimmers.forEach((swimmer) => {
      const swimmerName = `${swimmer.childFirstName} ${swimmer.childLastName}`;
      statsMap[swimmer.id] = {
        swimmerId: swimmer.id,
        swimmerName,
        totalDays: 0,
        present: 0,
        absent: 0,
        excused: 0,
        attendanceRate: 0,
      };
    });

    // Count attendance
    attendance.forEach((record) => {
      if (!statsMap[record.swimmerId]) {
        statsMap[record.swimmerId] = {
          swimmerId: record.swimmerId,
          swimmerName: record.swimmerName,
          totalDays: 0,
          present: 0,
          absent: 0,
          excused: 0,
          attendanceRate: 0,
        };
      }

      statsMap[record.swimmerId].totalDays++;
      if (record.status === "present") {
        statsMap[record.swimmerId].present++;
      } else if (record.status === "absent") {
        statsMap[record.swimmerId].absent++;
      } else if (record.status === "excused") {
        statsMap[record.swimmerId].excused++;
      }
    });

    // Calculate attendance rate
    Object.values(statsMap).forEach((stat) => {
      const total = stat.present + stat.absent + stat.excused;
      if (total > 0) {
        stat.attendanceRate = (stat.present / total) * 100;
      }
    });

    return Object.values(statsMap).sort((a, b) => {
      // Sort by attendance rate (lowest first), then by name
      if (a.attendanceRate !== b.attendanceRate) {
        return a.attendanceRate - b.attendanceRate;
      }
      return a.swimmerName.localeCompare(b.swimmerName);
    });
  }, [attendance, swimmers]);

  const exportCSV = () => {
    const header = ["Swimmer Name", "Total Days", "Present", "Absent", "Excused", "Attendance Rate (%)"];
    const lines = [header.join(",")];
    
    stats.forEach((stat) => {
      lines.push(
        [
          stat.swimmerName,
          stat.totalDays,
          stat.present,
          stat.absent,
          stat.excused,
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
          <p className="text-slate-600">View attendance statistics by month or year</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <Label htmlFor="viewMode">View By</Label>
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Statistics ({stats.length} swimmers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600 border-b">
                      <th className="p-3 font-semibold">Swimmer Name</th>
                      <th className="p-3 font-semibold text-center">Total Days</th>
                      <th className="p-3 font-semibold text-center">Present</th>
                      <th className="p-3 font-semibold text-center">Absent</th>
                      <th className="p-3 font-semibold text-center">Excused</th>
                      <th className="p-3 font-semibold text-center">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((stat, idx) => (
                      <tr key={stat.swimmerId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-3 font-medium text-slate-800">{stat.swimmerName}</td>
                        <td className="p-3 text-center">{stat.totalDays}</td>
                        <td className="p-3 text-center text-green-600 font-medium">{stat.present}</td>
                        <td className="p-3 text-center text-red-600 font-medium">{stat.absent}</td>
                        <td className="p-3 text-center text-amber-600 font-medium">{stat.excused}</td>
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
        )}
      </div>
    </div>
  );
}

