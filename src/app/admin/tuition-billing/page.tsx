"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TuitionBillingRow } from "@/lib/tuition-billing-shared";
import {
  billingVariantPreviewLabel,
  daysUntilLocalYmd,
  isBillingPrepWeekForNextMonth,
} from "@/lib/tuition-billing-shared";
import {
  Loader2,
  Mail,
  AlertCircle,
  RefreshCw,
  Pencil,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

function getNextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TuitionBillingPage() {
  const isAdmin = useIsAdminFromDB();
  const [month, setMonth] = useState(getNextMonth);
  const [rows, setRows] = useState<TuitionBillingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [overwriteUnpaidComputed, setOverwriteUnpaidComputed] = useState(false);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [editRow, setEditRow] = useState<TuitionBillingRow | null>(null);
  const [editForm, setEditForm] = useState({
    parentName: "",
    parentEmail: "",
    amount: "",
    practiceText: "",
    dueDate: "",
    monthsLine: "",
    afterFeeNote: "",
  });
  const [saveBusy, setSaveBusy] = useState(false);
  const [paidDateById, setPaidDateById] = useState<Record<string, string>>({});
  const [levelFilter, setLevelFilter] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  /** "" = all; "unpaid" | "paid" */
  const [paidFilter, setPaidFilter] = useState<"" | "unpaid" | "paid">("");

  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const lv = (r.level || "").trim();
      if (lv) seen.add(lv);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = nameSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelFilter && r.level !== levelFilter) return false;
      if (paidFilter === "paid" && !r.paid) return false;
      if (paidFilter === "unpaid" && r.paid) return false;
      if (!needle) return true;
      return r.swimmerName.toLowerCase().includes(needle);
    });
  }, [rows, levelFilter, paidFilter, nameSearch]);

  const fetchToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, []);

  const loadRows = useCallback(async () => {
    const token = await fetchToken();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tuition/billing?month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      const list = data.rows || [];
      setRows(list);
      const paidMap: Record<string, string> = {};
      for (const r of list as TuitionBillingRow[]) {
        if (r.paidOn) paidMap[r.swimmerId] = r.paidOn;
      }
      setPaidDateById(paidMap);
    } finally {
      setLoading(false);
    }
  }, [month, fetchToken]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadRows();
  }, [isAdmin, loadRows]);

  useEffect(() => {
    setLevelFilter("");
    setNameSearch("");
    setPaidFilter("");
  }, [month]);

  const runPrepare = async () => {
    const token = await fetchToken();
    if (!token) return;
    setPrepareBusy(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/admin/tuition/billing/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month, overwriteUnpaidComputed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Prepare failed");
        return;
      }
      setStatus(
        `Prepared: ${data.counts.created} created, ${data.counts.updated} updated, ${data.counts.skipped} skipped (${data.counts.totalCalculateRows} swimmers in calculator).`
      );
      await loadRows();
    } finally {
      setPrepareBusy(false);
    }
  };

  const openEdit = (r: TuitionBillingRow) => {
    setEditRow(r);
    setEditForm({
      parentName: r.parentName,
      parentEmail: r.parentEmail,
      amount: String(r.amount),
      practiceText: r.practiceText,
      dueDate: r.dueDate,
      monthsLine: (r.months || []).join(", "),
      afterFeeNote: r.afterFeeNote,
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const token = await fetchToken();
    if (!token) return;
    const amt = Number(editForm.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Amount must be a valid number.");
      return;
    }
    setSaveBusy(true);
    setError("");
    try {
      const months = editForm.monthsLine
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/tuition/billing/row", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          month,
          swimmerId: editRow.swimmerId,
          parentName: editForm.parentName,
          parentEmail: editForm.parentEmail,
          amount: amt,
          practiceText: editForm.practiceText,
          dueDate: editForm.dueDate,
          afterFeeNote: editForm.afterFeeNote,
          months: months.length ? months : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setEditRow(null);
      await loadRows();
    } finally {
      setSaveBusy(false);
    }
  };

  const sendBillingEmail = async (r: TuitionBillingRow) => {
    const token = await fetchToken();
    if (!token) return;
    setStatus("");
    setError("");
    const preview = billingVariantPreviewLabel(r.dueDate);
    setStatus(`Sending (${preview.label})…`);
    try {
      const res = await fetch("/api/admin/tuition/billing/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month, swimmerId: r.swimmerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Send failed");
        setStatus("");
        return;
      }
      const used = typeof data.variantUsed === "string" ? data.variantUsed : preview.variant;
      setStatus(`Sent “${used}” template to ${r.parentEmail}`);
      await loadRows();
    } catch {
      setStatus("");
    }
  };

  const markPaid = async (r: TuitionBillingRow) => {
    const paidOn = paidDateById[r.swimmerId] || r.dueDate;
    const token = await fetchToken();
    if (!token) return;
    setError("");
    if (!paidOn || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
      setError("Paid date must be YYYY-MM-DD.");
      return;
    }
    const res = await fetch("/api/admin/tuition/billing/row", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ month, swimmerId: r.swimmerId, paid: true, paidOn }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    await loadRows();
  };

  const markUnpaid = async (r: TuitionBillingRow) => {
    const token = await fetchToken();
    if (!token) return;
    setError("");
    const res = await fetch("/api/admin/tuition/billing/row", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ month, swimmerId: r.swimmerId, paid: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    await loadRows();
  };

  const prepWeek = isBillingPrepWeekForNextMonth(month);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-[1100px]">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Mail className="w-8 h-8 text-blue-600" />
          Monthly tuition billing
        </h1>
        <p className="text-slate-600 mb-6 max-w-3xl">
          Create per-swimmer drafts from the calculator (typically the week before the billed month begins), edit amount and schedule,
          then use <strong>Send email</strong>: the template is chosen automatically from the due date (invoice-style before the last few days,
          reminder within 3 days including due day, past-due after the due date). Finally mark paid with the payment date.
        </p>

        {prepWeek && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              This week is usually when you draft <strong>{monthLabel(month)}</strong> invoices (last week before the month starts).
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {status && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900 text-sm">
            {status}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Month &amp; prepare</CardTitle>
            <CardDescription>
              Run &quot;Prepare&quot; after you set no-training dates and swimmers on Monthly Tuition. New swimmers get rows; unpaid rows stay as-is unless you check overwrite. Once a row exists, you can edit amounts, send emails, and mark paid <strong>without</strong> Prepare again—only use Prepare when adding new swimmers to the month or re-syncing from the calculator.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Billing month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button variant="outline" onClick={() => loadRows()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Reload
            </Button>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <Checkbox checked={overwriteUnpaidComputed} onCheckedChange={(v) => setOverwriteUnpaidComputed(Boolean(v))} />
              Overwrite amount &amp; schedule for unpaid rows from calculator
            </label>
            <Button onClick={runPrepare} disabled={prepareBusy}>
              {prepareBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Prepare drafts
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{monthLabel(month)} — Invoices</CardTitle>
            <CardDescription>
              One <strong>Send email</strong> button picks the variant: at least three full days before due → invoice wording; due in two days / one day / today → reminder (same reminder template); after the due date → past due.{' '}
              <strong>There is no automatic send schedule yet</strong>—reminder/past-due wording only goes out when you click Send (or a future cron job calls the API). Automated jobs can POST with{' '}
              <code className="text-xs">kind: &quot;invoice&quot;</code>,<code className="text-xs"> kind: &quot;reminder&quot;</code>, or{' '}
              <code className="text-xs">kind: &quot;past_due&quot;</code> to force a template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!loading && rows.length === 0 ? (
              <p className="text-slate-500 py-6">No billing rows yet. Choose the month and click Prepare drafts.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2 min-w-[200px] flex-1 max-w-xs">
                    <Label htmlFor="billing-search-name">Search by swimmer name</Label>
                    <Input
                      id="billing-search-name"
                      placeholder="Name…"
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select
                      value={levelFilter === "" ? "_all_" : levelFilter}
                      onValueChange={(v) => setLevelFilter(v === "_all_" ? "" : v)}
                      disabled={rows.length === 0}
                    >
                      <SelectTrigger size="sm" className="w-[220px]">
                        <SelectValue placeholder="All levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all_">All levels</SelectItem>
                        {levelOptions.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>
                            {lvl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment</Label>
                    <Select
                      value={paidFilter === "" ? "_all_" : paidFilter}
                      onValueChange={(v) =>
                        setPaidFilter(v === "_all_" ? "" : (v as "paid" | "unpaid"))
                      }
                      disabled={rows.length === 0}
                    >
                      <SelectTrigger size="sm" className="w-[160px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all_">All (paid &amp; unpaid)</SelectItem>
                        <SelectItem value="unpaid">Unpaid only</SelectItem>
                        <SelectItem value="paid">Paid only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(levelFilter || nameSearch.trim() || paidFilter) && (
                    <p className="text-xs text-slate-500 pb-2">
                      Showing {filteredRows.length} of {rows.length}
                    </p>
                  )}
                </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-slate-600">
                      <th className="p-2">Swimmer</th>
                      <th className="p-2">Level</th>
                      <th className="p-2">Parent email</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2">Due</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Last email</th>
                      <th className="p-2 w-[280px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin inline-block" />
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          No swimmers match filters. Adjust search, level, or payment filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => {
                        const du = daysUntilLocalYmd(r.dueDate);
                        const overdue = typeof du === "number" && du < 0 && !r.paid;
                        return (
                          <tr key={r.swimmerId} className={`border-b ${overdue ? "bg-red-50/60" : r.paid ? "bg-green-50/40" : ""}`}>
                            <td className="p-2 font-medium">{r.swimmerName}</td>
                            <td className="p-2 text-slate-700 whitespace-nowrap">
                              {r.level?.trim() || "—"}
                            </td>
                            <td className="p-2 max-w-[140px] truncate">{r.parentEmail || "—"}</td>
                            <td className="p-2 text-right">${r.amount}</td>
                            <td className="p-2 whitespace-nowrap">
                              {r.dueDate}
                              {typeof du === "number" && !r.paid && (
                                <span className="block text-xs text-slate-500">
                                  {du < 0 ? `${Math.abs(du)}d overdue` : du === 0 ? "due today" : `${du}d left`}
                                </span>
                              )}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {r.paid ? (
                                <span className="inline-flex items-center gap-1 text-green-800">
                                  <CheckCircle className="w-4 h-4" />
                                  Paid{r.paidOn ? ` (${r.paidOn})` : ""}
                                </span>
                              ) : overdue ? (
                                <span className="text-red-700 font-medium">Past due</span>
                              ) : (
                                <span>Unpaid</span>
                              )}
                            </td>
                            <td className="p-2 text-xs max-w-[100px]">
                              {r.lastEmailKind ? r.lastEmailKind : "—"}
                              {r.lastSentAtMillis
                                ? ` · ${new Date(r.lastSentAtMillis).toLocaleDateString()}`
                                : ""}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                <Button size="sm" variant="outline" onClick={() => openEdit(r)} title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                {!r.paid && (
                                  <>
                                    <div className="flex flex-col items-start gap-0.5">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={!r.parentEmail?.includes("@")}
                                        onClick={() => sendBillingEmail(r)}
                                      >
                                        Send email
                                      </Button>
                                      <span className="text-[10px] text-slate-500 leading-tight max-w-[200px]" title="Based on due date">
                                        Uses: {billingVariantPreviewLabel(r.dueDate).label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 w-full mt-1">
                                      <Input
                                        type="date"
                                        className="h-8 text-xs w-[132px]"
                                        value={paidDateById[r.swimmerId] || ""}
                                        onChange={(e) =>
                                          setPaidDateById((prev) => ({ ...prev, [r.swimmerId]: e.target.value }))
                                        }
                                      />
                                      <Button size="sm" className="h-8 text-xs" onClick={() => markPaid(r)}>
                                        Paid
                                      </Button>
                                    </div>
                                  </>
                                )}
                                {r.paid && (
                                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => markUnpaid(r)}>
                                    Undo paid
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton>
            <DialogHeader>
              <DialogTitle>
                Edit billing — {editRow?.swimmerName}
                {editRow?.level?.trim() ? (
                  <span className="block text-sm font-normal text-slate-500 mt-1">Level: {editRow.level}</span>
                ) : null}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Parent name</Label>
                <Input
                  value={editForm.parentName}
                  onChange={(e) => setEditForm((p) => ({ ...p, parentName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Parent email</Label>
                <Input
                  type="email"
                  value={editForm.parentEmail}
                  onChange={(e) => setEditForm((p) => ({ ...p, parentEmail: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={editForm.amount}
                    onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Months label (comma-separated)</Label>
                <Input
                  placeholder="February 2026"
                  value={editForm.monthsLine}
                  onChange={(e) => setEditForm((p) => ({ ...p, monthsLine: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Training schedule (email body)</Label>
                <Textarea rows={8} value={editForm.practiceText} onChange={(e) => setEditForm((p) => ({ ...p, practiceText: e.target.value }))} className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label>Extra note (optional)</Label>
                <Textarea rows={3} value={editForm.afterFeeNote} onChange={(e) => setEditForm((p) => ({ ...p, afterFeeNote: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRow(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
