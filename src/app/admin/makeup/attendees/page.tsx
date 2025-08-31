"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

type EventLite = {
  id: string;
  text: string;
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

  const yesEmails = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .filter((r) => r.status === "yes")
          .map((r) => r.email)
          .filter((e): e is string => Boolean(e))
      )
    );
  }, [rows]);

  const copyYesEmails = async () => {
    try {
      await navigator.clipboard.writeText(yesEmails.join(", "));
      setStatus("✅ Copied ‘going’ emails");
      setTimeout(() => setStatus(""), 1500);
    } catch {
      setStatus("❌ Copy failed");
      setTimeout(() => setStatus(""), 1500);
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
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setRows([]);
    setSelectedEventId((prev) => {
      const rest = events.filter((e) => e.id !== id);
      return rest.length ? rest[0].id : "";
    });

    setStatus(`✅ Deleted. Removed ${payload.deletedResponses ?? 0} RSVP records.`);
  } catch (e) {
    console.error("Delete event error:", e);
    setStatus(e instanceof Error ? `❌ ${e.message}` : "❌ Delete failed");
  } finally {
    setDeletingId(null);
    setTimeout(() => setStatus(""), 2500);
  }
};


  if (isAdmin === null) return <div className="p-6">Checking permission…</div>;
  if (!isAdmin) return <div className="p-6 text-red-600 font-semibold">Not authorized (admin only).</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Make-up Class RSVPs (Admin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event selector + controls */}
          <div className="grid md:grid-cols-2 gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Make-up event</span>
              <select
                className="border rounded-lg p-2"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                {!events.length && <option value="">— No events —</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.text} — {fmt(ev.createdAt)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium">Filter:</label>
                <select
                  className="border rounded-lg p-2"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Filter)}
                >
                  <option value="all">All</option>
                  <option value="yes">Going</option>
                  <option value="no">Not going</option>
                  <option value="none">No response</option>
                </select>

                <Button
                  onClick={copyYesEmails}
                  variant="outline"
                  className="rounded-full"
                  disabled={!yesEmails.length}
                >
                  Copy &quot;Going&quot; Emails ({yesEmails.length})
                </Button>

                {/* NEW: delete button */}
                <Button
                  onClick={handleDeleteEvent}
                  className="rounded-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={!currentEvent || deletingId === currentEvent?.id}
                  title="Delete this event and all its RSVP records"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deletingId === currentEvent?.id ? "Deleting…" : "Delete this event"}
                </Button>
              </div>

              <div className="text-sm text-slate-600">
                <span className="mr-4">✅ Going: <b>{counts.yes}</b></span>
                <span className="mr-4">❌ Not going: <b>{counts.no}</b></span>
                <span>🕘 No response: <b>{counts.none}</b></span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 border-b">Swimmer</th>
                  <th className="text-left p-3 border-b">Parent</th>
                  <th className="text-left p-3 border-b">Email</th>
                  <th className="text-left p-3 border-b">Status</th>
                  <th className="text-left p-3 border-b">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.swimmerId}_${currentEvent?.id}`} className="odd:bg-white even:bg-slate-50/50">
                    <td className="p-3 border-b">{r.swimmerName}</td>
                    <td className="p-3 border-b">{r.parentName}</td>
                    <td className="p-3 border-b">{r.email}</td>
                    <td className="p-3 border-b">
                      {r.status === "yes" ? "✅ Going" : r.status === "no" ? "❌ Not going" : "—"}
                    </td>
                    <td className="p-3 border-b">{fmt(r.updatedAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
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
  );
}
