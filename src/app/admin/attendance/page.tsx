// app/admin/attendance/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { Calendar, CheckCircle2, XCircle, Clock, Save, AlertCircle, Loader2, Users } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Swimmer {
  id: string;
  childFirstName: string;
  childLastName: string;
  level?: string;
}

interface AttendanceRecord {
  id?: string;
  date: string;
  swimmerId: string;
  swimmerName: string;
  status: "present" | "absent" | "excused";
  location?: string;
  timeSlot?: string;
  notes?: string;
}

export default function AttendancePage() {
  const isAdmin = useIsAdminFromDB();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; success: boolean } | null>(null);

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

  // Load attendance for selected date
  useEffect(() => {
    const loadAttendance = async () => {
      if (!selectedDate || !isAdmin) return;

      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const res = await fetch(`/api/attendance?date=${encodeURIComponent(selectedDate)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          const recordsMap: Record<string, AttendanceRecord> = {};
          data.records.forEach((r: AttendanceRecord) => {
            recordsMap[r.swimmerId] = r;
          });
          setAttendance(recordsMap);
        }
      } catch (err) {
        console.error("Load attendance error:", err);
      }
    };

    loadAttendance();
  }, [selectedDate, isAdmin]);

  const updateAttendance = (swimmerId: string, status: "present" | "absent" | "excused") => {
    const swimmer = swimmers.find((s) => s.id === swimmerId);
    if (!swimmer) return;

    setAttendance((prev) => ({
      ...prev,
      [swimmerId]: {
        ...prev[swimmerId],
        date: selectedDate,
        swimmerId,
        swimmerName: `${swimmer.childFirstName} ${swimmer.childLastName}`,
        status,
      },
    }));
  };

  const saveAttendance = async () => {
    if (!selectedDate) return;

    setSaving(true);
    setStatus(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();

      // Save all attendance records
      const records = Object.values(attendance);
      for (const record of records) {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(record),
        });

        if (!res.ok) {
          throw new Error(`Failed to save attendance for ${record.swimmerName}`);
        }
      }

      setStatus({ message: "Attendance saved successfully!", success: true });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Save attendance error:", err);
      setStatus({ message: "Failed to save attendance", success: false });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Attendance Management
          </h1>
          <p className="text-slate-600">Mark daily attendance for swimmers</p>
        </div>

        {status && (
          <Alert
            variant={status.success ? "default" : "destructive"}
            className={`mb-6 ${status.success ? "border-green-200 bg-green-50" : ""}`}
          >
            {status.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={status.success ? "text-green-800" : ""}>
              {status.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Date Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <Button onClick={saveAttendance} disabled={saving || !selectedDate}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Attendance
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading swimmers...</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Swimmers ({swimmers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {swimmers.map((swimmer) => {
                  const record = attendance[swimmer.id];
                  const currentStatus = record?.status || null;
                  const swimmerName = `${swimmer.childFirstName} ${swimmer.childLastName}`;

                  return (
                    <div
                      key={swimmer.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">{swimmerName}</div>
                        {swimmer.level && (
                          <div className="text-sm text-slate-600">{swimmer.level}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={currentStatus === "present" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAttendance(swimmer.id, "present")}
                          className={currentStatus === "present" ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Present
                        </Button>
                        <Button
                          variant={currentStatus === "absent" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAttendance(swimmer.id, "absent")}
                          className={currentStatus === "absent" ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Absent
                        </Button>
                        <Button
                          variant={currentStatus === "excused" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAttendance(swimmer.id, "excused")}
                          className={currentStatus === "excused" ? "bg-amber-600 hover:bg-amber-700" : ""}
                        >
                          <Clock className="w-4 h-4 mr-1" />
                          Excused
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

