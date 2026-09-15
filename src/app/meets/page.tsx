"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { countAdminMeetList, filterAdminMeetList, type AdminMeetListFilter } from "@/lib/meets/list-filter";
import type { ParentMeetCard } from "@/lib/meets/parent-view";
import type { MeetSwimmer } from "@/lib/meets/types";
import { PnsMeetLink } from "@/components/pns-meet-link";

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
    <div>
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Meets</h1>
        <p className="text-sm text-slate-600">
          Signed-in Prime families only. Mark Attend or Decline for each swimmer. Prime submits the events you select.
        </p>
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
              className={listFilter === id ? "bg-blue-700 hover:bg-blue-800" : ""}
              onClick={() => setListFilter(id)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading meets…</p>}
        {!loading && meets.length === 0 && !error && (
          <Card>
            <CardContent className="py-8 text-sm text-slate-500">No published meets yet.</CardContent>
          </Card>
        )}
        {!loading && meets.length > 0 && visibleMeets.length === 0 && (
          <Card>
            <CardContent className="py-8 text-sm text-slate-500">
              {listFilter === "past"
                ? "No past meets in the archive."
                : listFilter === "in_process"
                  ? "No meets are in process today."
                  : "No upcoming meets."}
            </CardContent>
          </Card>
        )}
        {visibleMeets.map((meet) => (
          <Card key={meet.meetId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {meet.name}
                {meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                <Badge variant="outline">{meet.eventLabel === "confirmed" ? "Confirmed" : meet.eventLabel === "pending_for_review" ? "Pending for review" : meet.meetType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div>
                {meet.startDate} – {meet.endDate} · {meet.location}
              </div>
              {meet.primeCommitmentDeadline && <div>Prime Deadline: {meet.primeCommitmentDeadline}</div>}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <PnsMeetLink sourceKey={meet.sourceKey} className="text-blue-700 underline" />
                {meet.announcementUrl && (
                  <a href={meet.announcementUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">
                    Announcement / eligibility PDF
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {swimmers.map((s) => (
                  <Link
                    key={s.id}
                    href={`/meets/${meet.meetId}?swimmerId=${s.id}`}
                    className="text-slate-800 underline"
                  >
                    Open for {s.childFirstName}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
