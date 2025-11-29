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
  createdAt?: { toDate: () => Date } | Date | string;
}

interface TryoutSwimmer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  submittedAt?: { toDate: () => Date } | Date | string;
}

interface AttendanceRecord {
  id?: string;
  date: string;
  swimmerId: string;
  swimmerName: string;
  status: "attended" | "absent" | "make-up" | "trial";
  location?: string;
  timeSlot?: string;
  notes?: string;
}

export default function AttendancePage() {
  const isAdmin = useIsAdminFromDB();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [tryoutSwimmers, setTryoutSwimmers] = useState<TryoutSwimmer[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; success: boolean } | null>(null);

  // Load swimmers and tryout swimmers
  useEffect(() => {
    const loadSwimmers = async () => {
      try {
        // Load registered swimmers
        const swimmersSnap = await getDocs(collection(db, "swimmers"));
        const swimmersData = swimmersSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Swimmer[];

        // Load tryout swimmers from last 30 days only
        const tryoutsSnap = await getDocs(collection(db, "tryouts"));
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const tryoutsData: TryoutSwimmer[] = [];
        tryoutsSnap.docs.forEach((doc) => {
          const data = doc.data();
          let submittedAt: Date | null = null;
          if (data.submittedAt) {
            if (typeof data.submittedAt === 'object' && 'toDate' in data.submittedAt) {
              submittedAt = (data.submittedAt as { toDate: () => Date }).toDate();
            } else if (data.submittedAt instanceof Date) {
              submittedAt = data.submittedAt;
            } else if (typeof data.submittedAt === 'string') {
              submittedAt = new Date(data.submittedAt);
            }
          }
          
          // Only include tryouts from last 30 days
          if (submittedAt && submittedAt >= thirtyDaysAgo) {
            tryoutsData.push({
              id: doc.id,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              phone: data.phone,
              submittedAt: data.submittedAt,
            } as TryoutSwimmer);
          }
        });

        setSwimmers(swimmersData.sort((a, b) => {
          const nameA = `${a.childFirstName} ${a.childLastName}`;
          const nameB = `${b.childFirstName} ${b.childLastName}`;
          return nameA.localeCompare(nameB);
        }));
        setTryoutSwimmers(tryoutsData);
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

  const updateAttendance = (swimmerId: string, swimmerName: string, status: "attended" | "absent" | "make-up" | "trial") => {
    setAttendance((prev) => ({
      ...prev,
      [swimmerId]: {
        ...prev[swimmerId],
        date: selectedDate,
        swimmerId,
        swimmerName,
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
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.error || `HTTP ${res.status}`;
          throw new Error(`Failed to save attendance for ${record.swimmerName}: ${errorMessage}`);
        }
      }

      setStatus({ message: "Attendance saved successfully!", success: true });
      setTimeout(() => setStatus(null), 3000);
      
      // Reset attendance state after successful save
      setAttendance({});
      
      // Reload attendance to show saved records
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
      console.error("Save attendance error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save attendance";
      setStatus({ message: errorMessage, success: false });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  // Group swimmers by level
  const swimmersByLevel = swimmers.reduce((acc, swimmer) => {
    const level = swimmer.level || "Unknown";
    if (!acc[level]) acc[level] = [];
    acc[level].push(swimmer);
    return acc;
  }, {} as Record<string, Swimmer[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-1 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Attendance Management
          </h1>
          <p className="text-slate-600 text-sm">Mark daily attendance for swimmers</p>
        </div>

        {status && (
          <Alert
            variant={status.success ? "default" : "destructive"}
            className={`mb-4 ${status.success ? "border-green-200 bg-green-50" : ""}`}
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

        {/* Date Selector - Compact */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="date" className="text-sm">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button onClick={saveAttendance} disabled={saving || !selectedDate} size="sm">
                {saving ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3 mr-1" />
                    Save
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
          <div className="space-y-3">
            {/* Registered Swimmers by Level */}
            {Object.entries(swimmersByLevel)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([level, levelSwimmers]) => {
                return (
                  <Card key={level} className="border-slate-200">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {level} ({levelSwimmers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {levelSwimmers.map((swimmer) => {
                          const record = attendance[swimmer.id];
                          const currentStatus = record?.status || null;
                          const swimmerName = `${swimmer.childFirstName} ${swimmer.childLastName}`;

                          return (
                            <div
                              key={swimmer.id}
                              className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 text-sm"
                            >
                              <div className="flex-1 min-w-0 mr-2">
                                <div className="font-medium text-slate-800 truncate">{swimmerName}</div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant={currentStatus === "attended" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateAttendance(swimmer.id, swimmerName, "attended")}
                                  className={`h-7 px-2 text-xs ${currentStatus === "attended" ? "bg-green-600 hover:bg-green-700" : ""}`}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                  A
                                </Button>
                                <Button
                                  variant={currentStatus === "absent" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateAttendance(swimmer.id, swimmerName, "absent")}
                                  className={`h-7 px-2 text-xs ${currentStatus === "absent" ? "bg-red-600 hover:bg-red-700" : ""}`}
                                >
                                  <XCircle className="w-3 h-3 mr-0.5" />
                                  X
                                </Button>
                                <Button
                                  variant={currentStatus === "make-up" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateAttendance(swimmer.id, swimmerName, "make-up")}
                                  className={`h-7 px-2 text-xs ${currentStatus === "make-up" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                >
                                  <Clock className="w-3 h-3 mr-0.5" />
                                  M
                                </Button>
                                <Button
                                  variant={currentStatus === "trial" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateAttendance(swimmer.id, swimmerName, "trial")}
                                  className={`h-7 px-2 text-xs ${currentStatus === "trial" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                                >
                                  <Users className="w-3 h-3 mr-0.5" />
                                  T
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            
            {/* Tryout Swimmers (Unregistered) */}
            {tryoutSwimmers.length > 0 && (
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Trial (Unregistered) ({tryoutSwimmers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {tryoutSwimmers.map((tryout) => {
                      const record = attendance[`tryout-${tryout.id}`];
                      const currentStatus = record?.status || null;
                      const swimmerName = `${tryout.firstName} ${tryout.lastName}`;
                      const tryoutId = `tryout-${tryout.id}`;

                      return (
                        <div
                          key={tryoutId}
                          className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 text-sm"
                        >
                          <div className="flex-1 min-w-0 mr-2">
                            <div className="font-medium text-slate-800 truncate">{swimmerName}</div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant={currentStatus === "trial" ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateAttendance(tryoutId, swimmerName, "trial")}
                              className={`h-7 px-2 text-xs ${currentStatus === "trial" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                            >
                              <Users className="w-3 h-3 mr-0.5" />
                              T
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
        )}
      </div>
    </div>
  );
}
