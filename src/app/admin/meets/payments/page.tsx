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
import type { MeetPaymentRow } from "@/lib/meets/entries";

async function token() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

export default function AdminMeetPaymentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invoices, setInvoices] = useState<MeetPaymentRow[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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
    const res = await fetch("/api/admin/meets/payments", { headers: { Authorization: `Bearer ${idToken}` } });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Could not load payments");
    setInvoices(json.invoices || []);
  }

  async function mark(meetId: string, swimmerId: string, action: "markPaid" | "markUnpaid") {
    try {
      setBusy(`${action}-${meetId}-${swimmerId}`);
      setMessage("");
      const idToken = await token();
      const res = await fetch(`/api/admin/meets/${meetId}/actions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, swimmerId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Update failed");
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy("");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((row) => {
      if (unpaidOnly && row.paymentStatus === "paid") return false;
      if (q && !`${row.meetName} ${row.hostClub} ${row.swimmerName}`.toLowerCase().includes(q)) return false;
      if (fromDate && row.startDate < fromDate) return false;
      if (toDate && row.startDate > toDate) return false;
      return true;
    });
  }, [invoices, unpaidOnly, query, fromDate, toDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, MeetPaymentRow[]>();
    for (const row of filtered) {
      const list = map.get(row.meetId) || [];
      list.push(row);
      map.set(row.meetId, list);
    }
    return [...map.entries()].sort((a, b) => {
      const da = a[1][0]?.startDate || "";
      const db = b[1][0]?.startDate || "";
      return db.localeCompare(da);
    });
  }, [filtered]);

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
            <h1 className="text-3xl font-bold text-slate-800">Meet payments</h1>
            <p className="text-sm text-slate-600 mt-1">
              Host entry fees billed to families after the lineup is confirmed. Due date is one week after that confirmation.
            </p>
          </div>
          <Link href="/admin/meets" className="text-sm text-blue-700 underline">
            Meet workflow
          </Link>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Default view is unpaid invoices, newest meet first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or host" />
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={unpaidOnly} onChange={(e) => setUnpaidOnly(e.target.checked)} />
              Unpaid only
            </label>
          </CardContent>
        </Card>

        {message && <p className="text-sm text-rose-700">{message}</p>}

        {grouped.length === 0 && (
          <Card>
            <CardContent className="py-8 text-sm text-slate-500">No invoices match these filters.</CardContent>
          </Card>
        )}

        {grouped.map(([meetId, rows]) => {
          const first = rows[0];
          const unpaidCount = rows.filter((r) => r.paymentStatus !== "paid").length;
          return (
            <Card key={meetId} className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <Link href={`/admin/meets/${meetId}`} className="hover:underline">
                    {first.meetName}
                  </Link>
                  {first.isTestData && <Badge className="bg-amber-100 text-amber-800">TEST DATA</Badge>}
                  <Badge variant="outline">{unpaidCount} unpaid</Badge>
                </CardTitle>
                <CardDescription>
                  {first.startDate} – {first.endDate} · {first.hostClub}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.map((row) => (
                  <div key={`${row.meetId}-${row.swimmerId}`} className="rounded-lg border bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-800">{row.swimmerName}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {row.events.map((e) => `${e.sessionName}: ${e.label}`).join(" · ") || "No events"}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Due {row.paymentDueAt ? row.paymentDueAt.slice(0, 10) : "TBD"}
                          {row.overdue ? " · overdue" : ""}
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="font-semibold">${row.finalFee.toFixed(2)}</div>
                        <Badge
                          className={
                            row.paymentStatus === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.paymentStatus === "payment_reported"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                          }
                        >
                          {row.paymentStatus === "paid"
                            ? "Paid"
                            : row.paymentStatus === "payment_reported"
                              ? "Reported"
                              : "Unpaid"}
                        </Badge>
                        {row.paymentStatus !== "paid" ? (
                          <Button
                            size="sm"
                            className="block ml-auto"
                            disabled={!!busy}
                            onClick={() => mark(row.meetId, row.swimmerId, "markPaid")}
                          >
                            Mark paid
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="block ml-auto"
                            disabled={!!busy}
                            onClick={() => mark(row.meetId, row.swimmerId, "markUnpaid")}
                          >
                            Mark unpaid
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
