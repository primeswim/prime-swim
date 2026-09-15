"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MeetAnnouncementText } from "@/components/meet-announcement-text";
import { PnsMeetLink } from "@/components/pns-meet-link";
import type { ParentMeetDetail } from "@/lib/meets/parent-view";

export default function ParentMeetDetailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Loading meet…</div>}>
      <ParentMeetDetailInner />
    </Suspense>
  );
}

function ParentMeetDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const swimmerId = search.get("swimmerId") || "";
  const [detail, setDetail] = useState<ParentMeetDetail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [usaId, setUsaId] = useState("");
  const [acceptFee, setAcceptFee] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(sid: string) {
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/meets/${id}?swimmerId=${encodeURIComponent(sid)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error || "Could not load meet");
      return;
    }
    const next = json.detail as ParentMeetDetail;
    setDetail(next);
    setNotes(next.commitment?.parentNotes || "");
    setDays(next.commitment?.availableSessionIds || []);
    setEvents(next.commitment?.selectedEventIds || []);
    setUsaId(next.swimmer.usaSwimmingId || "");
    setAcceptFee(Boolean(next.commitment?.feePolicyAcceptedAt));
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      if (!swimmerId) {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/meets", { headers: { Authorization: `Bearer ${idToken}` } });
        const json = await res.json();
        const first = json.swimmers?.[0]?.id;
        if (first) router.replace(`/meets/${id}?swimmerId=${first}`);
        else setError("No swimmers on this account.");
        return;
      }
      await load(swimmerId);
    });
    return () => unsub();
  }, [router, id, swimmerId]);

  const sessionNames = useMemo(() => {
    if (!detail) return [];
    if (detail.meet.sessions.length) return detail.meet.sessions.map((s) => s.id);
    return ["saturday", "sunday"];
  }, [detail]);

  async function save(attendance: "attend" | "decline") {
    if (!detail) return;
    try {
      setBusy(true);
      setError("");
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/meets/${id}/commitment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          swimmerId: detail.swimmer.id,
          attendance,
          availableSessionIds: days,
          selectedEventIds: events,
          parentNotes: notes,
          acceptFeePolicy: acceptFee,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Save failed");
      await load(detail.swimmer.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function reportPayment() {
    if (!detail) return;
    try {
      setBusy(true);
      setError("");
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/meets/${id}/payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ swimmerId: detail.swimmer.id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Could not report payment");
      await load(detail.swimmer.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not report payment");
    } finally {
      setBusy(false);
    }
  }

  async function saveUsaId() {
    if (!detail) return;
    try {
      setBusy(true);
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/meets/usa-swimming-id", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ swimmerId: detail.swimmer.id, usaSwimmingId: usaId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Could not save ID");
      await load(detail.swimmer.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save ID");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <div>
        <Header />
        <main className="container mx-auto px-4 py-8">{error || "Loading meet…"}</main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <Link href="/meets" className="text-sm text-slate-600 hover:underline">
          ← Meets
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">{detail.meet.name}</h1>
          {detail.meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
          <Badge variant="outline">
            {detail.commitment?.attendance === "decline"
              ? "Declined"
              : detail.eventLabel === "confirmed"
                ? "Confirmed"
                : detail.eventLabel === "pending_for_review"
                  ? "Pending for review"
                  : "Open"}
          </Badge>
        </div>
        <p className="text-sm text-slate-600">
          {detail.swimmer.childFirstName} {detail.swimmer.childLastName} · {detail.meet.startDate} · {detail.meet.location}
        </p>
        {detail.canRespond && (
          <p className="text-xs text-slate-500">
            Only a signed-in Prime family account can Attend or Decline. You are already signed in, so you do not need to log in again.
          </p>
        )}
        {detail.meet.parentUpdateBanner && (
          <div className="text-sm bg-blue-50 border border-blue-200 rounded-md px-3 py-2">{detail.meet.parentUpdateBanner}</div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <PnsMeetLink sourceKey={detail.meet.sourceKey} />
          {detail.announcementUrl && (
            <a href={detail.announcementUrl} className="text-sm text-blue-700 underline" target="_blank" rel="noreferrer">
              Open announcement / qualification PDF
            </a>
          )}
        </div>
        {(detail.meet.announcementText || detail.eligibility.notes.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.eligibility.notes.length > 0 && (
                <ul className="text-[13px] list-disc pl-5 space-y-0.5 text-slate-700">
                  {detail.eligibility.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              {detail.meet.announcementText && (
                <MeetAnnouncementText text={detail.meet.announcementText} hostClub={detail.meet.hostClub} />
              )}
              {detail.meet.events.length > 0 && (
                <p className="text-xs text-slate-500">{detail.eligibility.eligibleEventCount} events match this swimmer.</p>
              )}
            </CardContent>
          </Card>
        )}

        {!detail.usaGate.canAttend && detail.canRespond && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle>USA Swimming ID required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{detail.usaGate.reason}</p>
              {detail.usaGate.registerUrl ? (
                <a
                  href={detail.usaGate.registerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-blue-700 underline font-medium"
                >
                  Open club USA Swimming registration
                </a>
              ) : (
                <p className="text-rose-600">Club OMR link is not configured yet. Ask Prime admin to save it.</p>
              )}
              <div className="flex gap-2">
                <Input value={usaId} onChange={(e) => setUsaId(e.target.value)} placeholder="USA Swimming ID" />
                <Button disabled={busy} onClick={saveUsaId}>
                  Save ID
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {detail.canRespond ? (
          <Card>
            <CardHeader>
              <CardTitle>Will this swimmer attend?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-600">
                Prime Deadline: {detail.meet.primeCommitmentDeadline || "TBD"}
                <span className="block text-xs text-slate-500 mt-1">
                  You can change Attend / Decline through that day. It closes automatically the next day.
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Which days can they attend?</div>
                {sessionNames.map((day) => (
                  <label key={day} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="checkbox"
                      disabled={!detail.canEdit}
                      checked={days.includes(day)}
                      onChange={(e) => setDays((prev) => (e.target.checked ? [...prev, day] : prev.filter((d) => d !== day)))}
                    />
                    {day}
                  </label>
                ))}
              </div>

              {!detail.hasEventFile && (
                <p className="text-sm text-slate-500">Event selection opens when the host event file is available.</p>
              )}

              {detail.hasEventFile && (
                <div className="space-y-1">
                  <div className="text-sm font-medium">Events to enter</div>
                  <p className="text-xs text-slate-500">
                    Prime will submit the events you select. The host may still cut events after we send the file.
                  </p>
                  {detail.eligibleEvents.map((event) => (
                    <label key={event.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={!detail.canEdit}
                        checked={events.includes(event.id)}
                        onChange={(e) =>
                          setEvents((prev) => (e.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id)))
                        }
                      />
                      {event.sessionName}: {event.label}
                    </label>
                  ))}
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-1">Notes to coach</div>
                <textarea
                  className="w-full border rounded-md p-2 text-sm"
                  rows={3}
                  disabled={!detail.canEdit}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Available Saturday only. Must leave by 2:00 PM. First meet."
                />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={acceptFee} onChange={(e) => setAcceptFee(e.target.checked)} disabled={!detail.canEdit} />
                <span>{detail.settings.feePolicyText}</span>
              </label>

              <div className="text-sm">
                Estimated fee: ${detail.fee.total.toFixed(2)} (not confirmed until host lineup is published)
              </div>

              {detail.displayedEvents.length > 0 && (
                <div className="text-sm bg-slate-50 border rounded-md p-3">
                  <div className="font-medium">Pending for review</div>
                  <ul className="list-disc pl-5 mt-1">
                    {detail.displayedEvents.map((e) => (
                      <li key={e.id}>
                        {e.sessionName}: {e.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button disabled={busy || !detail.usaGate.canAttend} onClick={() => save("attend")}>
                  Attend
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => save("decline")}>
                  Decline
                </Button>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </CardContent>
          </Card>
        ) : (
          <FinalizedParentCard detail={detail} busy={busy} error={error} onReportPayment={reportPayment} />
        )}
      </main>
    </div>
  );
}

function FinalizedParentCard({
  detail,
  busy,
  error,
  onReportPayment,
}: {
  detail: ParentMeetDetail;
  busy: boolean;
  error: string;
  onReportPayment: () => void;
}) {
  const declined = detail.commitment?.attendance === "decline";
  const confirmed = detail.eventLabel === "confirmed";
  const title = declined ? "Declined" : confirmed ? "Confirmed events" : "Submitted — pending host confirmation";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">
          {declined
            ? confirmed
              ? "This swimmer declined. No events were submitted to the host."
              : "This swimmer declined. RSVP is closed, so the response can no longer be changed."
            : confirmed
              ? "These are the events after the host confirmed the lineup. Attend / Decline is closed."
              : "RSVP is closed. Prime submitted the events below. The host may still cut events."}
        </p>
        {!declined && detail.displayedEvents.length > 0 && (
          <ul className="list-disc pl-5">
            {detail.displayedEvents.map((e) => (
              <li key={e.id}>
                {e.sessionName}: {e.label}
              </li>
            ))}
          </ul>
        )}
        {!declined && detail.displayedEvents.length === 0 && (
          <p className="text-slate-500">{confirmed ? "No events remain after host cuts." : "No individual events were selected."}</p>
        )}
        {!declined && (
          <div>
            {confirmed ? "Final" : "Estimated"} fee: ${detail.fee.total.toFixed(2)}
            {!confirmed && " (not confirmed until host lineup is published)"}
          </div>
        )}
        {confirmed && !declined && detail.commitment?.paymentStatus === "invoice_ready" && (
          <Button variant="outline" disabled={busy} onClick={onReportPayment}>
            I have sent payment
          </Button>
        )}
        {detail.commitment?.paymentStatus === "payment_reported" && (
          <p className="text-slate-600">Payment reported — waiting for admin confirmation.</p>
        )}
        {detail.commitment?.paymentStatus === "paid" && <p className="text-emerald-700">Paid</p>}
        {error && <p className="text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
