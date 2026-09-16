"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  swimmerMeetActionClass,
  swimmerMeetActionLabel,
  type ParentMeetCard,
} from "@/lib/meets/parent-view";
import type { MeetSwimmer } from "@/lib/meets/types";
import { PnsMeetLink } from "@/components/pns-meet-link";
import { MeetAnnouncementLink } from "@/components/meet-announcement-link";
import { MeetDateStamp } from "@/components/meet-date-stamp";
import { displayMeetName } from "@/lib/meets/display-name";
import { meetDateStamp } from "@/lib/meets/sessions";
import { pacificYmd } from "@/lib/meets/deadlines";
import { classifyCalendarWhen, type CalendarKind, type CalendarWhen } from "@/lib/calendar-when";
import { Event, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS } from "@/types/event";

const primaryBtn = "bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-md";
const quietLink = "text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900";

function loginHref(path: string) {
  return `/login?next=${encodeURIComponent(path)}`;
}

function dateToYmd(date: string | Date | { toDate?: () => Date } | undefined): string {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  if (typeof date === "object" && typeof date.toDate === "function") {
    return date.toDate().toISOString().slice(0, 10);
  }
  return "";
}

function parseKind(value: string | null): CalendarKind {
  if (value === "meet" || value === "event") return value;
  return "all";
}

function parseWhen(value: string | null): CalendarWhen {
  if (value === "now" || value === "past") return value;
  return "upcoming";
}

function eventWhen(event: Event, today: string): CalendarWhen {
  if (event.isArchived) return "past";
  return classifyCalendarWhen(event.startDate, event.endDate, today);
}

function meetWhen(meet: ParentMeetCard, today: string): CalendarWhen {
  if (meet.status === "cancelled" || meet.status === "completed") return "past";
  return classifyCalendarWhen(meet.startDate, meet.endDate, today);
}

type CalendarRow =
  | { kind: "meet"; id: string; startDate: string; meet: ParentMeetCard }
  | { kind: "event"; id: string; startDate: string; event: Event };

export function CalendarListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const kind = parseKind(search.get("kind"));
  const when = parseWhen(search.get("when"));
  const [meets, setMeets] = useState<ParentMeetCard[]>([]);
  const [swimmers, setSwimmers] = useState<MeetSwimmer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const today = pacificYmd();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setSignedIn(Boolean(user));
      try {
        const headers: HeadersInit = {};
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
        const [meetRes, eventRes] = await Promise.all([
          fetch("/api/meets", { headers }),
          fetch("/api/events?publishedOnly=true"),
        ]);
        const meetJson = await meetRes.json();
        const eventJson = await eventRes.json();
        const errors: string[] = [];
        if (!meetJson.ok) {
          errors.push(meetJson.error || "Could not load meets");
        } else {
          setMeets(meetJson.meets || []);
          setSwimmers(meetJson.swimmers || []);
        }
        if (!eventJson.ok) {
          errors.push(eventJson.error || "Could not load events");
        } else {
          setEvents(
            (eventJson.events || []).map((row: Event) => ({
              ...row,
              startDate: dateToYmd(row.startDate),
              endDate: row.endDate ? dateToYmd(row.endDate) : undefined,
            }))
          );
        }
        setError(errors.join(" "));
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  function setFilter(nextKind: CalendarKind, nextWhen: CalendarWhen) {
    const params = new URLSearchParams();
    if (nextKind !== "all") params.set("kind", nextKind);
    if (nextWhen !== "upcoming") params.set("when", nextWhen);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const counts = useMemo(() => {
    const meetRows = meets.map((meet) => meetWhen(meet, today));
    const eventRows = events.map((event) => eventWhen(event, today));
    const inKind = (rows: CalendarWhen[], bucket: CalendarWhen) =>
      kind === "meet" ? meetRows.filter((w) => w === bucket).length
      : kind === "event" ? eventRows.filter((w) => w === bucket).length
      : rows.filter((w) => w === bucket).length;
    const allWhen = [...meetRows, ...eventRows];
    return {
      upcoming: inKind(allWhen, "upcoming"),
      now: inKind(allWhen, "now"),
      past: inKind(allWhen, "past"),
      meet: meets.length,
      event: events.length,
    };
  }, [meets, events, kind, today]);

  const rows = useMemo(() => {
    const list: CalendarRow[] = [];
    if (kind !== "event") {
      for (const meet of meets) {
        if (meetWhen(meet, today) !== when) continue;
        list.push({ kind: "meet", id: `meet-${meet.meetId}`, startDate: meet.startDate, meet });
      }
    }
    if (kind !== "meet") {
      for (const event of events) {
        if (eventWhen(event, today) !== when) continue;
        list.push({ kind: "event", id: `event-${event.id}`, startDate: event.startDate, event });
      }
    }
    list.sort((a, b) => {
      const key = `${(a.startDate || "").slice(0, 10)}${a.kind === "meet" ? a.meet.name : a.event.title}`;
      const other = `${(b.startDate || "").slice(0, 10)}${b.kind === "meet" ? b.meet.name : b.event.title}`;
      return when === "past" ? other.localeCompare(key) : key.localeCompare(other);
    });
    return list;
  }, [meets, events, kind, when, today]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Events</h1>
          <p className="text-sm text-slate-600 mt-1">
            Club events and swim meets in one list. Meet information is public; log in to Attend or Decline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All", counts.meet + counts.event],
              ["meet", "Meets", counts.meet],
              ["event", "Events", counts.event],
            ] as Array<[CalendarKind, string, number]>
          ).map(([id, label, count]) => (
            <Button
              key={id}
              size="sm"
              variant={kind === id ? "default" : "outline"}
              className={kind === id ? primaryBtn : "rounded-full border-slate-200 text-slate-700 bg-white hover:bg-slate-50"}
              onClick={() => setFilter(id, when)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["upcoming", "Upcoming", counts.upcoming],
              ["now", "Happening now", counts.now],
              ["past", "Past", counts.past],
            ] as Array<[CalendarWhen, string, number]>
          ).map(([id, label, count]) => (
            <Button
              key={id}
              size="sm"
              variant={when === id ? "default" : "outline"}
              className={when === id ? primaryBtn : "rounded-full border-slate-200 text-slate-700 bg-white hover:bg-slate-50"}
              onClick={() => setFilter(kind, id)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading calendar…</p>}
        {!loading && rows.length === 0 && !error && (
          <Card className="border-0 shadow-xl bg-white">
            <CardContent className="py-8 text-sm text-slate-500">
              {when === "past"
                ? "Nothing in the past archive for this filter."
                : when === "now"
                  ? "Nothing is happening today for this filter."
                  : "Nothing upcoming for this filter."}
            </CardContent>
          </Card>
        )}
        {rows.map((row) =>
          row.kind === "meet" ? (
            <MeetCalendarCard key={row.id} meet={row.meet} signedIn={signedIn} swimmers={swimmers} />
          ) : (
            <EventCalendarCard key={row.id} event={row.event} />
          )
        )}
      </main>
    </div>
  );
}

function MeetCalendarCard({
  meet,
  signedIn,
  swimmers,
}: {
  meet: ParentMeetCard;
  signedIn: boolean;
  swimmers: MeetSwimmer[];
}) {
  const stamp = meetDateStamp(meet.startDate, meet.endDate);
  return (
    <Card className="relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white">
      <Link href={`/meets/${meet.meetId}`} className="absolute inset-0 z-0" aria-label={`Open ${displayMeetName(meet.name)}`} />
      <CardContent className="relative z-10 p-4 sm:p-5 pointer-events-none">
        <div className="flex items-start gap-4">
          <MeetDateStamp startDate={meet.startDate} endDate={meet.endDate} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">{displayMeetName(meet.name)}</h2>
                  <Badge className="bg-sky-100 text-sky-800 border-0">Meet</Badge>
                  {meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                  <Badge variant="outline" className="font-normal border-slate-200 text-slate-700">
                    {meet.status === "cancelled"
                      ? "Cancelled"
                      : meet.eventLabel === "confirmed"
                        ? "Confirmed"
                        : meet.meetType === "invitational"
                          ? "Invitational"
                          : "Open meet"}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-slate-700">{stamp.rangeLabel}</div>
                <div className="text-sm text-slate-500">{meet.location}</div>
                {meet.primeCommitmentDeadline && (
                  <div className="text-xs text-slate-500">Prime Deadline: {meet.primeCommitmentDeadline}</div>
                )}
                {meet.rsvpNotice && (
                  <div className="text-xs rounded-xl bg-slate-100 text-slate-700 px-3 py-2 mt-2">{meet.rsvpNotice}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {!signedIn ? (
                  meet.rsvpOpen ? (
                    <Button size="sm" className={`${primaryBtn} pointer-events-auto`} asChild>
                      <Link href={loginHref(`/meets/${meet.meetId}`)}>Log in to Attend / Decline</Link>
                    </Button>
                  ) : null
                ) : meet.rsvpOpen
                  ? swimmers.map((s) => {
                      const attendance = meet.swimmerResponses?.find((r) => r.swimmerId === s.id)?.attendance || "no_response";
                      return (
                        <Button key={s.id} size="sm" className={`${swimmerMeetActionClass(attendance)} pointer-events-auto`} asChild>
                          <Link href={`/meets/${meet.meetId}?swimmerId=${s.id}`}>
                            {swimmerMeetActionLabel(s.childFirstName, attendance)}
                          </Link>
                        </Button>
                      );
                    })
                  : swimmers
                      .filter((s) => {
                        const attendance = meet.swimmerResponses?.find((r) => r.swimmerId === s.id)?.attendance;
                        return attendance === "attend" || attendance === "incomplete" || attendance === "decline";
                      })
                      .map((s) => {
                        const attendance = meet.swimmerResponses?.find((r) => r.swimmerId === s.id)?.attendance || "no_response";
                        return (
                          <Button key={s.id} size="sm" className={`${swimmerMeetActionClass(attendance)} pointer-events-auto`} asChild>
                            <Link href={`/meets/${meet.meetId}?swimmerId=${s.id}`}>
                              {swimmerMeetActionLabel(s.childFirstName, attendance)}
                            </Link>
                          </Button>
                        );
                      })}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-3 text-sm">
              <PnsMeetLink sourceKey={meet.sourceKey} className={`${quietLink} pointer-events-auto`} />
              <MeetAnnouncementLink url={meet.announcementUrl} className={`${quietLink} pointer-events-auto`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventCalendarCard({ event }: { event: Event }) {
  const stamp = meetDateStamp(event.startDate, event.endDate || event.startDate);
  return (
    <Card className="relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white">
      <Link href={`/events/${event.id}`} className="absolute inset-0 z-0" aria-label={`Open ${event.title}`} />
      <CardContent className="relative z-10 p-4 sm:p-5 pointer-events-none">
        <div className="flex items-start gap-4">
          <MeetDateStamp startDate={event.startDate} endDate={event.endDate || event.startDate} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{event.title}</h2>
              <Badge className="bg-violet-100 text-violet-800 border-0">Event</Badge>
              <Badge className={EVENT_CATEGORY_COLORS[event.category] || EVENT_CATEGORY_COLORS.other}>
                {EVENT_CATEGORY_LABELS[event.category] || event.category}
              </Badge>
            </div>
            <div className="text-sm font-medium text-slate-700">{stamp.rangeLabel}</div>
            {event.location && <div className="text-sm text-slate-500">{event.location}</div>}
            {event.description && <p className="text-sm text-slate-600 line-clamp-2 pt-1">{event.description}</p>}
            {event.registrationRequired && event.registrationUrl && (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noreferrer"
                className={`${quietLink} pointer-events-auto inline-block pt-2`}
              >
                Register
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
