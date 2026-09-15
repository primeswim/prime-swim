"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ClubMeetSettings, Meet } from "@/lib/meets/types";
import { adminMeetGuide } from "@/lib/meets/workflow";
import { countAdminMeetList, filterAdminMeetList, type AdminMeetListFilter } from "@/lib/meets/list-filter";
import { PnsMeetLink } from "@/components/pns-meet-link";

async function token() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

export default function AdminMeetsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [meets, setMeets] = useState<Meet[]>([]);
  const [settings, setSettings] = useState<ClubMeetSettings | null>(null);
  const [omrUrl, setOmrUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [listFilter, setListFilter] = useState<AdminMeetListFilter>("upcoming");
  const [nameQuery, setNameQuery] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const adminSnap = await getDoc(doc(db, "admin", user.email ?? ""));
      if (!adminSnap.exists()) {
        router.push("/not-authorized");
        return;
      }
      setReady(true);
      await reload();
    });
    return () => unsub();
  }, [router]);

  async function reload() {
    const idToken = await token();
    const [meetRes, setRes] = await Promise.all([
      fetch("/api/admin/meets", { headers: { Authorization: `Bearer ${idToken}` } }),
      fetch("/api/admin/meets/settings", { headers: { Authorization: `Bearer ${idToken}` } }),
    ]);
    const meetJson = await meetRes.json();
    const setJson = await setRes.json();
    if (meetJson.ok) setMeets(meetJson.meets || []);
    if (setJson.ok) {
      setSettings(setJson.settings);
      setOmrUrl(setJson.settings.usaSwimmingOmrUrl || "");
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    try {
      setBusy(label);
      setMessage("");
      await fn();
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const counts = useMemo(() => countAdminMeetList(meets), [meets]);
  const visibleMeets = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return filterAdminMeetList(meets, listFilter).filter((meet) => {
      if (!q) return true;
      return `${meet.name} ${meet.hostClub} ${meet.location}`.toLowerCase().includes(q);
    });
  }, [meets, listFilter, nameQuery]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10 text-slate-500">Checking admin access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Meet management</h1>
            <p className="text-sm text-slate-600 mt-1">
              Separate from the public Events calendar. [TEST] fixtures never appear for real parents.
            </p>
            <Link href="/admin/meets/payments" className="text-sm text-blue-700 underline mt-2 inline-block">
              Meet payments
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                run("live", async () => {
                  const idToken = await token();
                  const res = await fetch("/api/admin/meets/pns", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "live" }),
                  });
                  const json = await res.json();
                  if (!json.ok) throw new Error(json.error || json.hint || "PNS check failed");
                  if (json.updated) setListFilter("has_updates");
                  else if (json.created) setListFilter("needs_review");
                  setMessage(
                    `Checked PNS. ${json.count ?? 0} calendar items` +
                      (json.created ? `, ${json.created} new drafts` : "") +
                      (json.updated ? `, ${json.updated} existing meets have updates` : "") +
                      `. Open Has updates to see announcement / file changes.`
                  );
                })
              }
            >
              {busy === "live" ? "Checking…" : "Check PNS for Updates"}
            </Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={!!busy}
              onClick={() =>
                run("mock", async () => {
                  const idToken = await token();
                  const res = await fetch("/api/admin/meets/pns", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ source: "mock" }),
                  });
                  const json = await res.json();
                  if (!json.ok) throw new Error(json.error || "Fixture load failed");
                  setMessage(json.warning || "Loaded [TEST] fixtures.");
                })
              }
            >
              {busy === "mock" ? "Loading…" : "Load [TEST] fixtures"}
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>USA Swimming club OMR link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Parents without a USA Swimming ID are sent here to register Premium / year-round membership.
              Current club link: omr.usaswimming.org/omr/welcome/7E8545DBBFD70C
            </p>
            <Input
              value={omrUrl}
              onChange={(e) => setOmrUrl(e.target.value)}
              placeholder="https://omr.usaswimming.org/omr/welcome/7E8545DBBFD70C"
            />
            <Button
              disabled={busy === "omr"}
              onClick={() =>
                run("omr", async () => {
                  const idToken = await token();
                  const res = await fetch("/api/admin/meets/settings", {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ ...(settings || {}), usaSwimmingOmrUrl: omrUrl }),
                  });
                  const json = await res.json();
                  if (!json.ok) throw new Error(json.error || "Save failed");
                  setMessage("OMR link saved.");
                })
              }
            >
              Save OMR link
            </Button>
          </CardContent>
        </Card>

        {message && (
          <p className={`text-sm rounded-md px-3 py-2 border ${message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-green-50 border-green-200 text-green-800"}`}>
            {message}
          </p>
        )}

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Meets</CardTitle>
            <CardDescription>
              New drafts stay in Needs review. Has updates is for meets we already fetched whose PNS announcement or files changed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["needs_review", "Needs review", counts.needs_review],
                  ["has_updates", "Has updates", counts.has_updates],
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
            <Input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="Search name, host, or location" />
            {visibleMeets.length === 0 && (
              <p className="text-sm text-slate-500">
                {meets.length === 0
                  ? "No meets yet. Check PNS or load [TEST] fixtures."
                  : listFilter === "past"
                    ? "No past meets in the archive."
                    : listFilter === "in_process"
                      ? "No meets are in process today."
                      : listFilter === "needs_review"
                        ? "Nothing waiting for review. Check PNS to pull the latest calendar."
                        : listFilter === "has_updates"
                          ? "No PNS announcement or file updates waiting."
                          : "No upcoming published meets."}
              </p>
            )}
            {visibleMeets.map((meet) => (
              <div key={meet.id} className="rounded-xl border bg-white p-4 hover:border-blue-200 hover:shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Link href={`/admin/meets/${meet.id}`} className="font-semibold text-slate-800 hover:underline">
                      {meet.name}
                    </Link>
                    <div className="text-xs text-slate-500 mt-1">
                      {meet.startDate} · {meet.hostClub} · {meet.meetType}
                    </div>
                    <div className="text-xs text-blue-700 mt-1">Next: {adminMeetGuide(meet).nextTitle}</div>
                    {meet.pendingSourceReview && (meet.pendingSourceDiffs || []).length > 0 && (
                      <div className="text-xs text-orange-800 mt-1">
                        Update: {(meet.pendingSourceDiffs || []).slice(0, 3).join(" · ")}
                      </div>
                    )}
                    <PnsMeetLink sourceKey={meet.sourceKey} className="text-xs text-blue-700 underline mt-1 inline-block" />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {meet.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                    {meet.pendingSourceReview && <Badge className="bg-orange-100 text-orange-800">PNS review</Badge>}
                    <Badge
                      className={
                        meet.status === "commitment_open"
                          ? "bg-green-100 text-green-800"
                          : meet.status === "entries_confirmed"
                            ? "bg-emerald-100 text-emerald-800"
                            : meet.status === "ready_to_publish" || meet.status === "invitation_pending" || meet.status === "admin_review"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                      }
                    >
                      {meet.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
