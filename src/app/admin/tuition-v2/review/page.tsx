"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { TuitionV2HubNav } from "@/components/tuition-v2-hub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TuitionV2Invoice, TuitionV2MonthDoc } from "@/lib/tuition-v2/types";
import { getNextMonth, monthLabel } from "@/lib/tuition-v2/shared-ui";
import { Loader2, RefreshCw } from "lucide-react";

export default function TuitionV2ReviewPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading…</div>}>
      <TuitionV2ReviewContent />
    </Suspense>
  );
}

function TuitionV2ReviewContent() {
  const isAdmin = useIsAdminFromDB();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(
    () => searchParams.get("month") || getNextMonth()
  );
  const [monthDoc, setMonthDoc] = useState<TuitionV2MonthDoc | null>(null);
  const [invoices, setInvoices] = useState<TuitionV2Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [editInv, setEditInv] = useState<TuitionV2Invoice | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [nameSearch, setNameSearch] = useState("");

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const load = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${selectedMonth}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setInvoices(data.invoices || []);
      const monthRes = await fetch(`/api/admin/tuition-v2/months/${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const monthData = await monthRes.json().catch(() => ({}));
      if (monthRes.ok) setMonthDoc(monthData.month);
    } finally {
      setLoading(false);
    }
  }, [fetchToken, selectedMonth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  useEffect(() => {
    router.replace(`/admin/tuition-v2/review?month=${encodeURIComponent(selectedMonth)}`);
  }, [selectedMonth, router]);

  const filtered = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((i) => i.swimmerName.toLowerCase().includes(q));
  }, [invoices, nameSearch]);

  const total = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered]);

  const recalculate = async () => {
    const token = await fetchToken();
    if (!token) return;
    setRecalcBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${selectedMonth}/recalculate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Recalculate failed");
        return;
      }
      setInvoices(data.invoices || []);
      setMonthDoc(data.month);
      setStatusMsg(`Recalculated ${data.count ?? 0} invoices. You can send emails from the Email hub.`);
    } finally {
      setRecalcBusy(false);
    }
  };

  const openEdit = (inv: TuitionV2Invoice) => {
    setEditInv(inv);
    setEditAmount(String(inv.amount));
    setEditReason(inv.manualOverride?.reason ?? "");
  };

  const saveOverride = async () => {
    if (!editInv) return;
    const token = await fetchToken();
    if (!token) return;
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Invalid amount");
      return;
    }
    setSaveBusy(true);
    try {
      const res = await fetch(
        `/api/admin/tuition-v2/months/${selectedMonth}/invoices/${encodeURIComponent(editInv.swimmerId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            manualOverride: { amount: Math.round(amt), reason: editReason || "Admin override" },
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setError("");
      setStatusMsg(`Saved override for ${editInv.swimmerName}.`);
      setEditInv(null);
      await load();
    } finally {
      setSaveBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8 px-4">Admin access required.</div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tuition V2 — Review</h1>
            <p className="text-sm text-muted-foreground">
              Review amounts, then send emails from the Email hub.
            </p>
          </div>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-44"
          />
        </div>

        <TuitionV2HubNav month={selectedMonth} />

        <div className="flex flex-wrap items-center gap-2">
          <Badge>{monthDoc?.status ?? "planning"}</Badge>
          <span className="text-sm text-muted-foreground">{monthLabel(selectedMonth)}</span>
          <span className="text-sm font-medium ml-auto">Total: ${total}</span>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {statusMsg && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{statusMsg}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={() => void recalculate()} disabled={recalcBusy}>
            {recalcBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Recalculate tuition
          </Button>
        </div>

        <Input
          placeholder="Search swimmer…"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="max-w-xs"
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoices ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoices yet. Set up the plan, then click Recalculate tuition.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Swimmer</th>
                    <th className="py-2 pr-2">Level</th>
                    <th className="py-2 pr-2">Plan</th>
                    <th className="py-2 pr-2">Rate</th>
                    <th className="py-2 pr-2">Sessions</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.swimmerId} className="border-b">
                      <td className="py-2 pr-2 font-medium">{inv.swimmerName}</td>
                      <td className="py-2 pr-2">{inv.level}</td>
                      <td className="py-2 pr-2">{inv.regularWeekdays.length} d/wk</td>
                      <td className="py-2 pr-2">
                        <span title={inv.rateTierReason}>
                          ${inv.ratePerHour} ({inv.rateTier})
                        </span>
                      </td>
                      <td className="py-2 pr-2">{inv.billableSessionCount}</td>
                      <td className="py-2 pr-2">
                        ${inv.amount}
                        {inv.siblingDiscountApplied && (
                          <span className="block text-xs text-green-700">-{inv.siblingDiscountPercent}% sibling</span>
                        )}
                        {inv.manualOverride && (
                          <span className="block text-xs text-amber-700">override</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editInv} onOpenChange={(o) => !o && setEditInv(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override amount — {editInv?.swimmerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Amount ($)</Label>
                <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">{editInv?.rateTierReason}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{editInv?.practiceText}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => void saveOverride()} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
