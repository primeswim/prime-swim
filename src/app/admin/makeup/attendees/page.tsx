"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/header";
import { Trash2, CheckCircle2, XCircle, Clock, Mail, Calendar, MapPin } from "lucide-react";

type EventLite = {
  id: string;
  text: string;
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  location?: string | null;
  createdAt: string | null;
  createdBy?: string;
  active?: boolean;
};

type Row = {
  swimmerId: string;
  swimmerName: string;
  parentName: string;
  email: string;
  status: "yes" | "no" | "none";
  updatedAt: string | null;
};

type EventsResponse =
  | { ok: true; events: EventLite[] }
  | { ok: false; error?: string };

type AttendeesResponse =
  | { ok: true; rows: Row[] }
  | { ok: false; error?: string };

type Filter = "all" | "yes" | "no" | "none";

function fmt(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export default function MakeupAttendeesAdminPage() {
  const isAdmin = useIsAdminFromDB();

  const [events, setEvents] = useState<EventLite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  // load events via API
  useEffect(() => {
    (async () => {
      if (isAdmin !== true) return;
      try {
        setStatus("Loading events…");
        const u = auth.currentUser;
        if (!u) throw new Error("Not signed in");
        const idToken = await u.getIdToken(true);

        const res = await fetch("/api/makeup/events", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data: EventsResponse = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(("error" in data && data.error) || "Load events failed");
        }

        setEvents(data.events);
        setStatus("");
      } catch (e: unknown) {
        console.error("Load events error:", e);
        setStatus("❌ Failed to load events");
      }
    })();
  }, [isAdmin]);

  // choose a default event after events load
  useEffect(() => {
    if (events.length && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // load attendees for selected event via API
  useEffect(() => {
    (async () => {
      if (!selectedEventId) {
        setRows([]);
        return;
      }
      try {
        setStatus("Loading RSVPs…");
        const u = auth.currentUser;
        if (!u) throw new Error("Not signed in");
        const idToken = await u.getIdToken(true);

        const res = await fetch("/api/makeup/attendees", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ makeupId: selectedEventId }),
        });
        const data: AttendeesResponse = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(("error" in data && data.error) || "Load RSVPs failed");
        }

        setRows(data.rows);
        setStatus("");
      } catch (e: unknown) {
        console.error("Load RSVPs error:", e);
        setStatus("❌ Failed to load RSVPs");
      }
    })();
  }, [selectedEventId]);

  const filtered = useMemo(() => {
    const rows2 = filter === "all" ? rows : rows.filter((r) => r.status === filter);
    // yes -> no -> none, then by swimmerName
    const order: Record<Row["status"], number> = { yes: 0, no: 1, none: 2 };
    return [...rows2].sort((a, b) => {
      const oa = order[a.status] - order[b.status];
      if (oa !== 0) return oa;
      return a.swimmerName.localeCompare(b.swimmerName);
    });
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { yes: 0, no: 0, none: 0 };
    rows.forEach((r) => {
      c[r.status as "yes" | "no" | "none"]++;
    });
    return c;
  }, [rows]);


  // Get emails of parents who haven't responded
  const noResponseEmails = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter((r) => r.status === "none")
          .map((r) => r.email)
          .filter((e): e is string => Boolean(e))
      )
    );
  }, [rows]);

  // Send reminder emails to parents who haven't responded
  const handleSendReminder = async () => {
    if (!currentEvent) return;
    if (noResponseEmails.length === 0) {
      setStatus("ℹ️ No parents need reminders (all have responded)");
      setTimeout(() => setStatus(""), 2000);
      return;
    }

    if (!confirm(`Send reminder emails to ${noResponseEmails.length} parent(s) who haven't responded?\n\nThis will send a friendly reminder about the make-up class.`)) {
      return;
    }

    try {
      setSendingReminder(true);
      setStatus("Sending reminder emails…");

      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);

      const res = await fetch("/api/makeup/send-reminder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          makeupId: selectedEventId,
          eventText: currentEvent.text,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send reminders");
      }

      setStatus(`✅ Sent ${data.sent || 0} reminder email(s) successfully`);
    } catch (e) {
      console.error("Send reminder error:", e);
      setStatus(e instanceof Error ? `❌ ${e.message}` : "❌ Failed to send reminders");
    } finally {
      setSendingReminder(false);
      setTimeout(() => setStatus(""), 3000);
    }
  };

  const currentEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  // NEW: delete the selected event (and cascade responses)
  const handleDeleteEvent = async () => {
    if (!currentEvent) return;
    const id = currentEvent.id;
    if (!confirm(`Delete this make-up event?\n\n${currentEvent.text}\n\nThis will also remove all RSVP records for this event.`)) {
      return;
    }
    try {
      setDeletingId(id);
      setStatus("Deleting event…");

      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);

      // ✅ 用查询参数传 id；不要放 body，兼容性最好
      const res = await fetch(`/api/makeup/events?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `Delete failed (${res.status})`);
      }

      // UI 更新
      setEvents((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        // 若当前选中就是被删的那条，则切到新的第一条；否则保持不变
        setSelectedEventId((curr) => (curr === id ? (updated[0]?.id ?? "") : curr));
        return updated;
      });
      setRows([]);    

      setStatus(`✅ Deleted. Removed ${payload.deletedResponses ?? 0} RSVP records.`);
    } catch (e) {
      console.error("Delete event error:", e);
      setStatus(e instanceof Error ? `❌ ${e.message}` : "❌ Delete failed");
    } finally {
      setDeletingId(null);
      setTimeout(() => setStatus(""), 2500);
    }
  };


  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking permission…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <div className="text-red-600 font-semibold text-center">Not authorized (admin only).</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Make-up Class RSVPs</h1>
          <p className="text-slate-600">View and manage RSVP responses for make-up classes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>RSVP Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          {/* Event selector - separate row */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Make-up Event</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-slate-500">No events available</div>
                ) : (
                  events.map((ev) => {
                    const parts: string[] = [];
                    if (ev.date) {
                      try {
                        // date is in YYYY-MM-DD format, add time to avoid timezone issues
                        const dateObj = new Date(ev.date + "T00:00:00");
                        if (!isNaN(dateObj.getTime())) {
                          parts.push(dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
                        }
                      } catch {
                        // Fallback to original date string if parsing fails
                        parts.push(ev.date);
                      }
                    }
                    if (ev.time) {
                      const [hours, minutes] = ev.time.split(":");
                      const hour = parseInt(hours);
                      const ampm = hour >= 12 ? "PM" : "AM";
                      const hour12 = hour % 12 || 12;
                      let timeStr = `${hour12}:${minutes} ${ampm}`;
                      if (ev.endTime) {
                        const [endHours, endMinutes] = ev.endTime.split(":");
                        const endHour = parseInt(endHours);
                        const endAmpm = endHour >= 12 ? "PM" : "AM";
                        const endHour12 = endHour % 12 || 12;
                        timeStr += ` - ${endHour12}:${endMinutes} ${endAmpm}`;
                      }
                      parts.push(timeStr);
                    }
                    const timeStr = parts.length > 0 ? ` (${parts.join(", ")})` : "";
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.text}{timeStr}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {currentEvent && (currentEvent.date || currentEvent.time || currentEvent.location) && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-2">Event Details:</div>
                <div className="space-y-1 text-sm text-blue-800">
                  {currentEvent.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {(() => {
                          try {
                            // date is in YYYY-MM-DD format, add time to avoid timezone issues
                            const dateObj = new Date(currentEvent.date + "T00:00:00");
                            if (!isNaN(dateObj.getTime())) {
                              return dateObj.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              });
                            }
                          } catch {
                            return currentEvent.date;
                          }
                          return currentEvent.date;
                        })()}
                      </span>
                    </div>
                  )}
                  {currentEvent.time && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {(() => {
                          const [hours, minutes] = currentEvent.time!.split(":");
                          const hour = parseInt(hours);
                          const ampm = hour >= 12 ? "PM" : "AM";
                          const hour12 = hour % 12 || 12;
                          return `${hour12}:${minutes} ${ampm}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {currentEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{currentEvent.location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters and Actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Status</label>
              <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Responses</SelectItem>
                  <SelectItem value="yes">Going</SelectItem>
                  <SelectItem value="no">Not going</SelectItem>
                  <SelectItem value="none">No response</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleSendReminder}
                  variant="outline"
                  size="sm"
                  disabled={!currentEvent || sendingReminder || noResponseEmails.length === 0}
                  className="flex-1 min-w-[140px] bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  title="Send reminder emails to parents who haven't responded"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {sendingReminder ? "Sending..." : `Remind (${noResponseEmails.length})`}
                </Button>
                <Button
                  onClick={handleDeleteEvent}
                  variant="destructive"
                  size="sm"
                  disabled={!currentEvent || deletingId === currentEvent?.id}
                  title="Delete this event and all its RSVP records"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">Going</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{counts.yes}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-800">Not going</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{counts.no}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-800">No response</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{counts.none}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-4 border-b font-semibold text-slate-700">Swimmer</th>
                  <th className="text-left p-4 border-b font-semibold text-slate-700">Parent</th>
                  <th className="text-left p-4 border-b font-semibold text-slate-700">Email</th>
                  <th className="text-left p-4 border-b font-semibold text-slate-700">Status</th>
                  <th className="text-left p-4 border-b font-semibold text-slate-700">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={`${r.swimmerId}_${currentEvent?.id}`}
                    className="odd:bg-white even:bg-slate-50/50 hover:bg-blue-50 transition-colors"
                  >
                    <td className="p-4 border-b font-medium text-slate-800">{r.swimmerName}</td>
                    <td className="p-4 border-b text-slate-600">{r.parentName}</td>
                    <td className="p-4 border-b text-slate-600">{r.email}</td>
                    <td className="p-4 border-b">
                      {r.status === "yes" ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Going
                        </Badge>
                      ) : r.status === "no" ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Not going
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                          <Clock className="w-3 h-3 mr-1" />
                          No response
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 border-b text-slate-500 text-xs">{fmt(r.updatedAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No RSVP data for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {status && <div className="text-sm">{status}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
