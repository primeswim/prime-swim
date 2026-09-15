"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { countAdminMeetList, filterAdminMeetList, type AdminMeetListFilter } from "@/lib/meets/list-filter";
import {
  swimmerMeetActionClass,
  swimmerMeetActionLabel,
  type ParentMeetCard,
} from "@/lib/meets/parent-view";
import type { MeetSwimmer } from "@/lib/meets/types";
import { PnsMeetLink } from "@/components/pns-meet-link";
import { MeetDateStamp } from "@/components/meet-date-stamp";
import { displayMeetName } from "@/lib/meets/display-name";
import { meetDateStamp } from "@/lib/meets/sessions";

const primaryBtn = "bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-md";
const quietLink = "text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900";

export default function ParentMeetsPage() {
  const router = useRouter();
  const [meets, setMeets] = useState<ParentMeetCard[]>([]);
  const [swimmers, setSwimmers] = useState<MeetSwimmer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [listFilter, setListFilter] = useState<AdminMeetListFilter>("upcoming");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/meets", { headers: { Authorization: `Bearer ${idToken}` } });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || "Could not load meets");
          return;
        }
        setMeets(json.meets || []);
        setSwimmers(json.swimmers || []);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const counts = useMemo(() => countAdminMeetList(meets), [meets]);
  const visibleMeets = useMemo(() => filterAdminMeetList(meets, listFilter), [meets, listFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Meets</h1>
          <p className="text-sm text-slate-600 mt-1">
            Signed-in Prime families only. Mark Attend or Decline for each swimmer. Prime submits the events you select.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["upcoming", "Upcoming", counts.upcoming],
              ["in_process", "In process", counts.in_process],
              ["past", "Past archive", counts.past],
            ] as Array<[AdminMeetListFilter, string, number]>
          ).map(([id, label, count]) => (
            <Button
              key={id}
              size="sm"
              variant={listFilter === id ? "default" : "outline"}
              className={listFilter === id ? primaryBtn : "rounded-full border-slate-200 text-slate-700 bg-white hover:bg-slate-50"}
              onClick={() => setListFilter(id)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading meets…</p>}
        {!loading && meets.length === 0 && !error && (
          <Card className="border-0 shadow-xl bg-white">
            <CardContent className="py-8 text-sm text-slate-500">No published meets yet.</CardContent>
          </Card>
        )}
        {!loading && meets.length > 0 && visibleMeets.length === 0 && (
          <Card className="border-0 shadow-xl bg-white">
            <CardContent className="py-8 text-sm text-slate-500">
              {listFilter === "past"
                ? "No past meets in the archive."
                : listFilter === "in_process"
                  ? "No meets are in process today."
                  : "No upcoming meets."}
            </CardContent>
          </Card>
        )}
        {visibleMeets.map((meet) => {
          const stamp = meetDateStamp(meet.startDate, meet.endDate);
          return (
            <Card key={meet.meetId} className="relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden bg-white">
              <Link
                href={`/meets/${meet.meetId}`}
                className="absolute inset-0 z-0"
                aria-label={`Open ${displayMeetName(meet.name)}`}
              />
              <CardContent className="relative z-10 p-4 sm:p-5 pointer-events-none">
                <div className="flex items-start gap-4">
                  <MeetDateStamp startDate={meet.startDate} endDate={meet.endDate} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-800">{displayMeetName(meet.name)}</h2>
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
                        {meet.parentUpdateBanner && (
                          <div className="text-xs rounded-xl bg-amber-50 text-amber-950 px-3 py-2 mt-2">{meet.parentUpdateBanner}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {meet.rsvpOpen
                          ? swimmers.map((s) => {
                              const response = meet.swimmerResponses?.find((r) => r.swimmerId === s.id);
                              const attendance = response?.attendance || "no_response";
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
                      {meet.announcementUrl && (
                        <a href={meet.announcementUrl} className={`${quietLink} pointer-events-auto`} target="_blank" rel="noreferrer">
                          Announcement / eligibility PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
