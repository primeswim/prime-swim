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
import { Textarea } from "@/components/ui/textarea";
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
import { billingVariantPreviewLabel } from "@/lib/tuition-billing-shared";
import { getNextMonth, monthLabel, monthReadyToSendEmail, monthToApiPath, normalizeBillingMonth } from "@/lib/tuition-v2/shared-ui";
import { AlertCircle, Loader2, Mail, RefreshCw } from "lucide-react";

export default function TuitionV2EmailPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading…</div>}>
      <TuitionV2EmailContent />
    </Suspense>
  );
}

function TuitionV2EmailContent() {
  const isAdmin = useIsAdminFromDB();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(
    () => searchParams.get("month") || getNextMonth()
  );
  const [monthDoc, setMonthDoc] = useState<TuitionV2MonthDoc | null>(null);
  const [invoices, setInvoices] = useState<TuitionV2Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [editInv, setEditInv] = useState<TuitionV2Invoice | null>(null);
  const [editForm, setEditForm] = useState({ dueDate: "", afterFeeNote: "", parentEmail: "" });
  const [saveBusy, setSaveBusy] = useState(false);
  const [paidInv, setPaidInv] = useState<TuitionV2Invoice | null>(null);
  const [paidOnDate, setPaidOnDate] = useState("");
  const [paidBusy, setPaidBusy] = useState(false);
  const [nameSearch, setNameSearch] = useState("");

  const todayYmd = () => new Date().toISOString().slice(0, 10);

  function formatPaidDate(ymd: string | null | undefined): string {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
    const [y, mo, d] = ymd.split("-").map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function invoiceWasEmailed(inv: TuitionV2Invoice): boolean {
    return inv.emailStatus === "sent" || Boolean(inv.firstInvoiceSentAt || inv.lastSentAt);
  }

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const load = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    const month = normalizeBillingMonth(selectedMonth);
    if (!month) return;
    setLoading(true);
    setError("");
    try {
      const [invRes, monthRes] = await Promise.all([
        fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const invData = await invRes.json().catch(() => ({}));
      const monthData = await monthRes.json().catch(() => ({}));
      if (!invRes.ok) {
        setError(invData.error || "Failed to load");
        return;
      }
      setInvoices(invData.invoices || []);
      if (monthRes.ok) setMonthDoc(monthData.month);
    } finally {
      setLoading(false);
    }
  }, [fetchToken, selectedMonth]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  useEffect(() => {
    router.replace(`/admin/tuition-v2/email?month=${encodeURIComponent(selectedMonth)}`);
  }, [selectedMonth, router]);

  const filtered = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    return invoices.filter((i) => {
      if (!q) return true;
      return i.swimmerName.toLowerCase().includes(q);
    });
  }, [invoices, nameSearch]);

  const canSend = monthReadyToSendEmail(monthDoc?.status) && invoices.length > 0;

  const sendOne = async (swimmerId: string, resend: boolean) => {
    const token = await fetchToken();
    if (!token) return;
    setSendBusy(swimmerId);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ swimmerId, kind: "auto" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (resend ? "Resend failed" : "Send failed"));
        return;
      }
      const name = invoices.find((i) => i.swimmerId === swimmerId)?.swimmerName ?? swimmerId;
      setStatusMsg(resend ? `Resent to ${name}` : `Sent to ${name}`);
      await load();
    } finally {
      setSendBusy(null);
    }
  };

  const sendBatch = async () => {
    const token = await fetchToken();
    if (!token) return;
    setBatchBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ batch: true, kind: "auto" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Batch send failed");
        return;
      }
      setStatusMsg(`Batch sent: ${data.sent} ok, ${data.failed} failed.`);
      await load();
    } finally {
      setBatchBusy(false);
    }
  };

  const openEdit = (inv: TuitionV2Invoice) => {
    setEditInv(inv);
    setEditForm({
      dueDate: inv.dueDate,
      afterFeeNote: inv.afterFeeNote,
      parentEmail: inv.parentEmail,
    });
  };

  const saveEmailFields = async () => {
    if (!editInv) return;
    const token = await fetchToken();
    if (!token) return;
    setSaveBusy(true);
    try {
      const res = await fetch(
        `/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/invoices/${encodeURIComponent(editInv.swimmerId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(editForm),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setEditInv(null);
      await load();
    } finally {
      setSaveBusy(false);
    }
  };

  const openMarkPaid = (inv: TuitionV2Invoice) => {
    setPaidInv(inv);
    setPaidOnDate(inv.paidOn && /^\d{4}-\d{2}-\d{2}$/.test(inv.paidOn) ? inv.paidOn : todayYmd());
  };

  const saveMarkPaid = async () => {
    if (!paidInv || !paidOnDate) return;
    const token = await fetchToken();
    if (!token) return;
    setPaidBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/invoices/${encodeURIComponent(paidInv.swimmerId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paid: true, paidOn: paidOnDate }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      setStatusMsg(`Marked ${paidInv.swimmerName} paid on ${formatPaidDate(paidOnDate)}`);
      setPaidInv(null);
      await load();
    } finally {
      setPaidBusy(false);
    }
  };

  const markUnpaid = async (inv: TuitionV2Invoice) => {
    const token = await fetchToken();
    if (!token) return;
    const res = await fetch(
      `/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/invoices/${encodeURIComponent(inv.swimmerId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paid: false, paidOn: null }),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Update failed");
      return;
    }
    setStatusMsg(`Marked ${inv.swimmerName} unpaid`);
    await load();
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
            <h1 className="text-2xl font-bold">Tuition V2 — Email</h1>
            <p className="text-sm text-muted-foreground">Email fields and sending only. Amounts come from Review.</p>
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
        </div>

        {!canSend && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Run <strong>Recalculate tuition</strong> in Review first, then you can Send or Resend here.
            </span>
          </div>
        )}

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {statusMsg && (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{statusMsg}</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={() => void sendBatch()} disabled={batchBusy || !canSend}>
            {batchBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Send all unpaid
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
              <p className="text-sm text-muted-foreground">No invoices. Complete Plan and Review first.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Swimmer</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Due</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const preview = billingVariantPreviewLabel(inv.dueDate);
                    const wasEmailed = invoiceWasEmailed(inv);
                    return (
                      <tr key={inv.swimmerId} className={`border-b ${inv.paid ? "opacity-60" : ""}`}>
                        <td className="py-2 pr-2 font-medium">{inv.swimmerName}</td>
                        <td className="py-2 pr-2">${inv.amount}</td>
                        <td className="py-2 pr-2">{inv.dueDate}</td>
                        <td className="py-2 pr-2 text-xs">{inv.parentEmail || "—"}</td>
                        <td className="py-2 pr-2 text-xs">
                          {inv.paid ? (
                            <>Paid{inv.paidOn ? ` · ${formatPaidDate(inv.paidOn)}` : ""}</>
                          ) : wasEmailed ? (
                            "Sent"
                          ) : (
                            preview.label
                          )}
                        </td>
                        <td className="py-2 pr-2 space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                            Email
                          </Button>
                          {!inv.paid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!canSend || sendBusy === inv.swimmerId}
                              onClick={() => void sendOne(inv.swimmerId, wasEmailed)}
                            >
                              {sendBusy === inv.swimmerId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : wasEmailed ? (
                                "Resend"
                              ) : (
                                "Send"
                              )}
                            </Button>
                          )}
                          {inv.paid ? (
                            <Button variant="ghost" size="sm" onClick={() => void markUnpaid(inv)}>
                              Unpaid
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => openMarkPaid(inv)}>
                              Paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editInv} onOpenChange={(o) => !o && setEditInv(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Email settings — {editInv?.swimmerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Parent email</Label>
                <Input
                  value={editForm.parentEmail}
                  onChange={(e) => setEditForm((f) => ({ ...f, parentEmail: e.target.value }))}
                />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea
                  value={editForm.afterFeeNote}
                  onChange={(e) => setEditForm((f) => ({ ...f, afterFeeNote: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="rounded border p-2 bg-muted/30 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                <strong>Schedule (read-only)</strong>
                {"\n"}
                {editInv?.practiceText}
              </div>
              <p className="text-sm">
                Amount: <strong>${editInv?.amount}</strong> (edit in Review hub)
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => void saveEmailFields()} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!paidInv} onOpenChange={(o) => !o && setPaidInv(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Mark paid — {paidInv?.swimmerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Amount: <strong>${paidInv?.amount}</strong>
              </p>
              <div>
                <Label>Paid on</Label>
                <Input
                  type="date"
                  value={paidOnDate}
                  onChange={(e) => setPaidOnDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaidInv(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveMarkPaid()} disabled={paidBusy || !paidOnDate}>
                {paidBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
