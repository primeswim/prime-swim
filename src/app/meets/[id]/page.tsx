"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MapPin } from "lucide-react";
import { MeetAnnouncementText } from "@/components/meet-announcement-text";
import { MeetAnnouncementLink } from "@/components/meet-announcement-link";
import { PnsMeetLink } from "@/components/pns-meet-link";
import { displaySwimmerFirstName, parentAttendanceBadgeClass, parentAttendanceLabel, type ParentMeetDetail, type PublicMeetDetail } from "@/lib/meets/parent-view";
import { displayMeetName } from "@/lib/meets/display-name";
import { meetDayOptions, keepValidMeetDayIds, meetDateStamp } from "@/lib/meets/sessions";
import { MeetDateStamp } from "@/components/meet-date-stamp";
import { MeetPayPrimeButton, MeetPaymentStatusNote } from "@/components/meet-pay-button";

const EVENT_WISHLIST_MIN = 8;

function notesHaveEventWishlist(notes: string): boolean {
  return notes.trim().length >= EVENT_WISHLIST_MIN;
}

export default function ParentMeetDetailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Loading meet…</div>}>
      <ParentMeetDetailInner />
    </Suspense>
  );
}

function AttendDeclineButtons({
  canAttend,
  attendHint,
  busy,
  attendance,
  onAttend,
  onDecline,
}: {
  canAttend: boolean;
  attendHint?: string;
  busy: boolean;
  attendance?: "no_response" | "incomplete" | "attend" | "decline";
  onAttend: () => void;
  onDecline: () => void;
}) {
  const attending = attendance === "attend" || attendance === "incomplete";
  const declined = attendance === "decline";
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className={
          attending
            ? "bg-amber-500 hover:bg-amber-600 text-white rounded-full px-6 shadow-md"
            : "bg-slate-800 hover:bg-slate-700 text-white rounded-full px-6 shadow-md"
        }
        disabled={busy || !canAttend}
        title={!canAttend ? attendHint : undefined}
        onClick={onAttend}
      >
        Attend
      </Button>
      <Button
        variant={declined ? "default" : "outline"}
        className={
          declined
            ? "bg-red-600 hover:bg-red-700 text-white rounded-full px-6 shadow-md"
            : "rounded-full border-red-200 text-red-700 hover:bg-red-50"
        }
        disabled={busy}
        onClick={onDecline}
      >
        Decline
      </Button>
    </div>
  );
}

function ParentMeetDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const swimmerId = search.get("swimmerId") || "";
  const [detail, setDetail] = useState<ParentMeetDetail | null>(null);
  const [publicDetail, setPublicDetail] = useState<PublicMeetDetail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [usaId, setUsaId] = useState("");
  const [acceptFee, setAcceptFee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  async function loadPublic(headers?: HeadersInit) {
    const res = await fetch(`/api/meets/${id}`, { headers });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error || "Could not load meet");
      setPublicDetail(null);
      return;
    }
    setPublicDetail(json.detail as PublicMeetDetail);
    setError("");
  }

  async function loadRsvp(sid: string) {
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
    setPublicDetail(null);
    setNotes(next.commitment?.parentNotes || "");
    setDays(keepValidMeetDayIds(next.meet, next.commitment?.availableSessionIds || []));
    setEvents(next.commitment?.selectedEventIds || []);
    setUsaId(next.swimmer.usaSwimmingId || "");
    setAcceptFee(Boolean(next.commitment?.feePolicyAcceptedAt));
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setDetail(null);
        setNotes("");
        setDays([]);
        setEvents([]);
        await loadPublic();
        return;
      }
      const idToken = await user.getIdToken();
      const headers = { Authorization: `Bearer ${idToken}` };
      if (!swimmerId) {
        await loadPublic(headers);
        const res = await fetch("/api/meets", { headers });
        const json = await res.json();
        const first = json.swimmers?.[0]?.id;
        if (first) router.replace(`/meets/${id}?swimmerId=${first}`);
        return;
      }
      await loadRsvp(swimmerId);
    });
    return () => unsub();
  }, [router, id, swimmerId]);

  const sessionOptions = useMemo(() => (detail ? meetDayOptions(detail.meet) : []), [detail]);

  async function save(attendance: "attend" | "decline") {
    if (!detail) return;
    if (attendance === "attend" && !detail.hasEventFile && !notesHaveEventWishlist(notes)) {
      setError(`Write the events ${displaySwimmerFirstName(detail.swimmer.childFirstName)} wants in Notes before tapping Attend. Example: Saturday 50 Fly, 50 Free.`);
      notesRef.current?.focus();
      return;
    }
    try {
      setBusy(true);
      setError("");
      setSuccess("");
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
      const name = displaySwimmerFirstName(detail.swimmer.childFirstName);
      setSuccess(
        attendance === "attend"
          ? `Attend saved. ${name} is marked as attending this meet.`
          : `Decline saved. ${name} will not swim this meet.`
      );
      await loadRsvp(detail.swimmer.id);
      requestAnimationFrame(() => successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
      await loadRsvp(detail.swimmer.id);
      setSuccess("Payment reported. Prime will confirm after the money is received.");
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
      await loadRsvp(detail.swimmer.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save ID");
    } finally {
      setBusy(false);
    }
  }

  if (!detail && publicDetail) {
    const pub = publicDetail;
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <main className="container mx-auto px-4 py-8 space-y-5">
          <Link href="/events" className="text-sm text-slate-600 hover:text-slate-900">
            ← Events
          </Link>
          <section className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-amber-50/50 p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <MeetDateStamp startDate={pub.meet.startDate} endDate={pub.meet.endDate} className="mt-1" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {pub.meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                  <Badge variant="outline" className="border-slate-200 text-slate-700">
                    {pub.meet.meetType === "invitational" ? "Invitational" : "Open meet"}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">{displayMeetName(pub.meet.name)}</h1>
                {pub.rsvpNotice && (
                  <p className="text-sm rounded-xl bg-slate-100 text-slate-700 px-3 py-2">{pub.rsvpNotice}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{meetDateStamp(pub.meet.startDate, pub.meet.endDate).rangeLabel}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {pub.meet.location || "Location TBD"}
                  </span>
                  <span>Host: {pub.meet.hostClub}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <PnsMeetLink sourceKey={pub.meet.sourceKey} />
                  <MeetAnnouncementLink url={pub.announcementUrl} />
                </div>
              </div>
            </div>
          </section>
          {(pub.meet.announcementText || pub.meet.eligibilityNotes.length > 0 || pub.announcementUrl) && (
            <Card className="border-0 shadow-xl overflow-hidden bg-white">
              <CardHeader className="pb-3 bg-white">
                <CardTitle className="text-base">Announcement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pub.announcementUrl && (
                  <MeetAnnouncementLink
                    url={pub.announcementUrl}
                    className="inline-flex text-sm font-medium text-slate-800 underline underline-offset-2"
                  />
                )}
                {pub.meet.eligibilityNotes.length > 0 && (
                  <ul className="text-[13px] space-y-1.5">
                    {pub.meet.eligibilityNotes.map((n) => (
                      <li key={n} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                {pub.meet.announcementText && (
                  <MeetAnnouncementText text={pub.meet.announcementText} hostClub={pub.meet.hostClub} meetName={pub.meet.name} />
                )}
              </CardContent>
            </Card>
          )}
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader>
              <CardTitle>Attend / Decline</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Anyone can read this meet. Sign in to your Prime parent account to Attend or Decline for your swimmer.
              </p>
            </CardHeader>
            <CardContent>
              <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full" asChild>
                <Link href={`/login?next=${encodeURIComponent(`/meets/${id}`)}`}>Log in to Attend or Decline</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <main className="container mx-auto px-4 py-8">{error || "Loading meet…"}</main>
      </div>
    );
  }

  const firstName = displaySwimmerFirstName(detail.swimmer.childFirstName);
  const statusLabel = parentAttendanceLabel(detail.commitment?.attendance || "no_response", detail.eventLabel);
  const alreadyAttending = detail.commitment?.attendance === "attend" || detail.commitment?.attendance === "incomplete";
  const needsNewDays = Boolean(detail.meet.parentUpdateBanner) && alreadyAttending;
  const wishlistReady = detail.hasEventFile || notesHaveEventWishlist(notes);
  const attendBlockedHint = !detail.usaGate.canAttend
    ? "USA Swimming ID is required to Attend."
    : !wishlistReady
      ? "Write the events they want in Notes before Attend."
      : undefined;
  const rsvpButtons = detail.canRespond ? (
    <AttendDeclineButtons
      canAttend={detail.usaGate.canAttend && wishlistReady}
      attendHint={attendBlockedHint}
      busy={busy}
      attendance={detail.commitment?.attendance}
      onAttend={() => save("attend")}
      onDecline={() => save("decline")}
    />
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-5">
        <Link href="/events" className="text-sm text-slate-600 hover:text-slate-900">
          ← Events
        </Link>

        <section className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-amber-50/50 p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <MeetDateStamp startDate={detail.meet.startDate} endDate={detail.meet.endDate} className="mt-1" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {detail.meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                <Badge className={parentAttendanceBadgeClass(detail.commitment?.attendance || "no_response", detail.eventLabel)}>
                  {statusLabel}
                </Badge>
                <Badge variant="outline" className="border-slate-200 text-slate-700">
                  {detail.meet.meetType === "invitational" ? "Invitational" : "Open meet"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">{displayMeetName(detail.meet.name)}</h1>
              <p className="text-sm text-slate-600">
                RSVP for <span className="font-semibold text-slate-800">{firstName}</span>
              </p>
              {detail.rsvpNotice && (
                <p className="text-sm rounded-xl bg-slate-100 text-slate-700 px-3 py-2">{detail.rsvpNotice}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{meetDateStamp(detail.meet.startDate, detail.meet.endDate).rangeLabel}</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {detail.meet.location || "Location TBD"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <PnsMeetLink sourceKey={detail.meet.sourceKey} />
                <MeetAnnouncementLink url={detail.announcementUrl} />
              </div>
            </div>
          </div>
        </section>

        {detail.meet.parentUpdateBanner && (
          <div className="text-sm bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-950 shadow-sm">
            {detail.meet.parentUpdateBanner}
          </div>
        )}

        {(detail.meet.announcementText || detail.eligibility.notes.length > 0 || detail.announcementUrl) && (
          <Card className="border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="pb-3 bg-white">
              <CardTitle className="text-base">Announcement</CardTitle>
              {detail.eligibility.ageOnMeet >= 0 && (
                <p className="text-sm text-slate-500 mt-1">
                  {firstName} will be <span className="font-medium text-slate-800">{detail.eligibility.ageOnMeet}</span> on meet day.
                  {detail.meet.events.length > 0 ? ` ${detail.eligibility.eligibleEventCount} events match this swimmer.` : ""}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.announcementUrl && (
                <MeetAnnouncementLink
                  url={detail.announcementUrl}
                  className="inline-flex text-sm font-medium text-slate-800 underline underline-offset-2"
                />
              )}
              {detail.eligibility.notes.filter((n) => !/^This swimmer will be /i.test(n)).length > 0 && (
                <ul className="text-[13px] space-y-1.5">
                  {detail.eligibility.notes
                    .filter((n) => !/^This swimmer will be /i.test(n))
                    .map((n) => (
                      <li key={n} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                        {n}
                      </li>
                    ))}
                </ul>
              )}
              {detail.meet.announcementText && (
                <MeetAnnouncementText
                  text={detail.meet.announcementText}
                  hostClub={detail.meet.hostClub}
                  meetName={detail.meet.name}
                />
              )}
            </CardContent>
          </Card>
        )}

        {!detail.usaGate.canAttend && detail.canRespond && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-amber-50 to-amber-100">
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
                  className="inline-flex items-center text-slate-800 underline underline-offset-2 font-medium"
                >
                  Open club USA Swimming registration
                </a>
              ) : (
                <p className="text-rose-600">Club OMR link is not configured yet. Ask Prime admin to save it.</p>
              )}
              <div className="flex gap-2">
                <Input value={usaId} onChange={(e) => setUsaId(e.target.value)} placeholder="USA Swimming ID" />
                <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full" disabled={busy} onClick={saveUsaId}>
                  Save ID
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {detail.canRespond ? (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader>
              <CardTitle>Will {firstName} attend?</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Prime Deadline: {detail.meet.primeCommitmentDeadline || "TBD"}. You can change this through that day.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {sessionOptions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-800">Which days can they swim?</div>
                  {needsNewDays && (
                    <p className="text-sm text-amber-900">The meet days changed. Select the days that still work, then tap Attend.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {sessionOptions.map((day) => {
                      const on = days.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          disabled={!detail.canEdit}
                          onClick={() =>
                            setDays((prev) => (on ? prev.filter((d) => d !== day.id) : [...prev, day.id]))
                          }
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            on
                              ? "border-slate-800 bg-slate-800 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                          } disabled:opacity-50`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!detail.hasEventFile && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-sm text-amber-950 space-y-3">
                  <div>
                    <p className="font-semibold text-base">Required before Attend</p>
                    <p className="mt-1">
                      The host has not posted the Event File yet, so there are no 50 Fly / 50 Free checkboxes. Open the meet announcement, then write the events {firstName} wants in the box below, or Attend will stay disabled.
                    </p>
                    {detail.announcementUrl ? (
                      <p className="mt-2">
                        <MeetAnnouncementLink
                          url={detail.announcementUrl}
                          className="font-semibold text-slate-900 underline underline-offset-2"
                        />
                      </p>
                    ) : (
                      <p className="mt-2">
                        <PnsMeetLink sourceKey={detail.meet.sourceKey} className="font-semibold text-slate-900 underline underline-offset-2" />
                        {" — look for the announcement PDF on that page."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="event-wishlist" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      Events {firstName} wants to swim
                      <Badge className="bg-red-600 text-white border-0">Required</Badge>
                    </label>
                    <p className="text-xs text-amber-900 mt-1 mb-2">
                      Include the day and the stroke, for example: Saturday 50 Fly, 50 Free. Sunday 100 IM.
                    </p>
                    <textarea
                      id="event-wishlist"
                      ref={notesRef}
                      className={`w-full border-2 rounded-xl p-3 text-sm bg-white min-h-[7rem] ${
                        notesHaveEventWishlist(notes) ? "border-slate-300" : "border-amber-500"
                      }`}
                      rows={4}
                      required
                      aria-required="true"
                      disabled={!detail.canEdit}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Saturday: 50 Fly, 50 Free. Sunday: 100 IM."
                    />
                    {!notesHaveEventWishlist(notes) && (
                      <p className="text-xs font-medium text-red-700 mt-1.5">Fill this in before tapping Attend.</p>
                    )}
                  </div>
                </div>
              )}

              {detail.hasEventFile && alreadyAttending && events.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  The host Event File is in. Check the official events below. Notes cannot be imported by the host — only the boxes you check go into the SD3 file.
                </div>
              )}

              {detail.hasEventFile && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-800">Events to enter</div>
                  <p className="text-xs text-slate-500">
                    Prime will submit the events you select in a Hy-Tek SD3 the host can import. The host may still cut events after we send the file.
                  </p>
                  <div className="max-h-64 overflow-auto rounded-xl border bg-white p-3 space-y-1.5">
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
                        <span className="text-slate-500 w-28 shrink-0">{event.sessionName}</span>
                        <span>{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {detail.hasEventFile && (
                <div>
                  <div className="text-sm font-medium mb-1">Notes to coach</div>
                  <textarea
                    className="w-full border rounded-xl p-3 text-sm bg-white"
                    rows={3}
                    disabled={!detail.canEdit}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Available Saturday only. Must leave by 2:00 PM. First meet."
                  />
                </div>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={acceptFee} onChange={(e) => setAcceptFee(e.target.checked)} disabled={!detail.canEdit} />
                <span>{detail.settings.feePolicyText}</span>
              </label>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Estimated fee: <span className="font-semibold">${detail.fee.total.toFixed(2)}</span>
                <span className="text-slate-500"> · confirmed after the host lineup is published</span>
              </div>

              {detail.displayedEvents.length > 0 && (
                <div className="text-sm rounded-xl border bg-white px-4 py-3">
                  <div className="font-medium text-slate-800">Events Prime will enter</div>
                  <ul className="list-disc pl-5 mt-1 text-slate-600">
                    {detail.displayedEvents.map((e) => (
                      <li key={e.id}>
                        {e.sessionName}: {e.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && (
                <div
                  ref={successRef}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
                  role="status"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <p className="font-medium">{success}</p>
                </div>
              )}
              {rsvpButtons && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500 mb-3">
                    {needsNewDays
                      ? `Choose the new days, then tap Attend to update ${firstName}'s RSVP.`
                      : !wishlistReady
                        ? `Write ${firstName}'s events in the required box above, then tap Attend.`
                        : alreadyAttending
                          ? `You can change days or events and tap Attend again.`
                          : `When you are ready, save ${firstName}'s response below.`}
                  </p>
                  {rsvpButtons}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <FinalizedParentCard detail={detail} busy={busy} error={error} onReportPayment={reportPayment} />
        )}
      </main>
      {success && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-2xl">
          <div className="flex items-start gap-3 text-sm text-emerald-950">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <p className="font-medium">{success}</p>
          </div>
        </div>
      )}
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
  const title = declined ? "Declined" : confirmed ? "Confirmed events" : "Your events";
  const cutEvents = detail.requestedEvents.filter((event) => !detail.displayedEvents.some((kept) => kept.id === event.id));
  return (
    <Card className="border-0 shadow-xl bg-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-slate-700">
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
        {!declined && cutEvents.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="font-medium text-slate-800">Host cuts</p>
            <ul className="mt-1 list-disc pl-5 text-slate-500">
              {cutEvents.map((e) => (
                <li key={e.id} className="line-through">
                  {e.sessionName}: {e.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!declined && detail.commitment?.hostCutNote && (
          <p className="text-slate-600">{detail.commitment.hostCutNote}</p>
        )}
        {!declined && (
          <div className="space-y-1">
            {confirmed && detail.fee.surcharge > 0 && <div>Surcharge: ${detail.fee.surcharge.toFixed(2)}</div>}
            {confirmed && detail.fee.events > 0 && <div>Event fees: ${detail.fee.events.toFixed(2)}</div>}
            <div>
              {confirmed ? "Final" : "Estimated"} fee: ${detail.fee.total.toFixed(2)}
              {!confirmed && " (confirmed after the host lineup is published)"}
            </div>
          </div>
        )}
        {confirmed && !declined && detail.commitment?.paymentStatus === "invoice_ready" && (
          <MeetPayPrimeButton busy={busy} onClick={onReportPayment} />
        )}
        <MeetPaymentStatusNote status={detail.commitment?.paymentStatus} />
        {error && <p className="text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
