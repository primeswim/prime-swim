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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TuitionV2Invoice, TuitionV2MonthDoc } from "@/lib/tuition-v2/types";
import { applyPriorMonthSessionCredit } from "@/lib/tuition-v2/prior-month-credit";
import { getNextMonth, monthLabel, monthToApiPath, normalizeBillingMonth } from "@/lib/tuition-v2/shared-ui";
import { LEVEL_GROUPS, SWIMMER_LEVELS } from "@/lib/swimmer-levels";
import {
  invoiceNeedsAppPublish,
  invoicesNeedingAppPublish,
  invoicesPublishedToApp,
} from "@/lib/tuition-v2/parent-tuition";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Search } from "lucide-react";

const LEVEL_FILTER_STYLES: Record<string, { dot: string; on: string; off: string }> = {
  Bronze: {
    dot: "bg-amber-500",
    on: "bg-amber-600 text-white shadow-sm",
    off: "text-slate-600 hover:bg-amber-50 hover:text-amber-900",
  },
  Silver: {
    dot: "bg-slate-400",
    on: "bg-slate-700 text-white shadow-sm",
    off: "text-slate-600 hover:bg-slate-100",
  },
  Gold: {
    dot: "bg-yellow-400",
    on: "bg-yellow-600 text-white shadow-sm",
    off: "text-slate-600 hover:bg-yellow-50 hover:text-yellow-900",
  },
  Platinum: {
    dot: "bg-purple-500",
    on: "bg-purple-600 text-white shadow-sm",
    off: "text-slate-600 hover:bg-purple-50 hover:text-purple-900",
  },
};

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
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [editInv, setEditInv] = useState<TuitionV2Invoice | null>(null);
  const [editBillAs, setEditBillAs] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [listLevels, setListLevels] = useState<string[]>([]);

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
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}/invoices?ensure=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      setInvoices(data.invoices || []);
      if (data.refreshed) {
        setStatusMsg("New swimmers or roster changes were applied to this month automatically.");
      }
      const monthRes = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(month)}`, {
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
    return invoices.filter((i) => {
      if (listLevels.length > 0 && !listLevels.includes(i.level)) return false;
      if (q && !i.swimmerName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [invoices, nameSearch, listLevels]);

  const total = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered]);
  const publishedCount = useMemo(
    () => invoices.filter((i) => !invoiceNeedsAppPublish(i)).length,
    [invoices]
  );
  const unpublishedInList = useMemo(() => invoicesNeedingAppPublish(filtered), [filtered]);
  const publishedInList = useMemo(() => invoicesPublishedToApp(filtered), [filtered]);
  const levelFilter = listLevels.length > 0 ? listLevels : null;
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const invoice of invoices) {
      counts[invoice.level] = (counts[invoice.level] ?? 0) + 1;
    }
    return counts;
  }, [invoices]);

  const toggleListLevel = (level: string) => {
    setListLevels((prev) => {
      const next = prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level];
      return next.length === SWIMMER_LEVELS.length ? [] : next;
    });
  };

  const toggleLevelGroup = (levels: readonly string[]) => {
    setListLevels((prev) => {
      const allOn = levels.every((level) => prev.includes(level));
      const next = allOn
        ? prev.filter((level) => !levels.includes(level))
        : [...new Set([...prev, ...levels])];
      return next.length === SWIMMER_LEVELS.length ? [] : next;
    });
  };

  const recalculate = async () => {
    const token = await fetchToken();
    if (!token) return;
    setRecalcBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const body = levelFilter ? { levels: levelFilter } : {};
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/recalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Recalculate failed");
        return;
      }
      setInvoices(data.invoices || []);
      setMonthDoc(data.month);
      const levelNote =
        Array.isArray(data.levelsFilter) && data.levelsFilter.length > 0
          ? ` (${data.levelsFilter.length} level(s))`
          : "";
      setStatusMsg(
        `Recalculated ${data.count ?? 0} invoice(s)${levelNote}. Other levels were left unchanged.`
      );
    } finally {
      setRecalcBusy(false);
    }
  };

  const publishToApp = async (
    scope: { swimmerIds?: string[]; levels?: string[] },
    action: "publish" | "unpublish" = "publish"
  ) => {
    const token = await fetchToken();
    if (!token) return;
    const singleId = scope.swimmerIds?.length === 1 ? scope.swimmerIds[0] : null;
    if (singleId) setPublishingId(singleId);
    else setPublishBusy(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await fetch(`/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...scope, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (action === "unpublish" ? "Unpublish failed" : "Publish failed"));
        return;
      }
      if (data.month) setMonthDoc(data.month);
      if (Array.isArray(data.invoices)) setInvoices(data.invoices);
      if (action === "unpublish") {
        const n = typeof data.unpublishedCount === "number" ? data.unpublishedCount : 0;
        setStatusMsg(
          n === 0
            ? "Nothing to unpublish in this selection."
            : n === 1
              ? "Unpublished 1 swimmer. App shows 核算中."
              : `Unpublished ${n} swimmers. App shows 核算中.`
        );
        return;
      }
      const n = typeof data.publishedCount === "number" ? data.publishedCount : 0;
      setStatusMsg(
        n === 0
          ? "Nothing new to publish in this selection."
          : n === 1
            ? "Published 1 swimmer to the app."
            : `Published ${n} swimmers to the app.`
      );
    } finally {
      setPublishBusy(false);
      setPublishingId(null);
    }
  };

  const editCreditPreview = useMemo(() => {
    if (!editInv) return null;
    const billed = Number(editBillAs);
    const billedSessions =
      editBillAs.trim() !== "" && Number.isFinite(billed)
        ? Math.max(0, Math.floor(billed))
        : editInv.billableSessionCount;
    const creditSessions = Math.max(0, editInv.billableSessionCount - billedSessions);
    return applyPriorMonthSessionCredit({
      sessionCount: editInv.billableSessionCount,
      ratePerHour: editInv.ratePerHour,
      siblingDiscountApplied: editInv.siblingDiscountApplied,
      siblingDiscountPercent: editInv.siblingDiscountPercent,
      creditSessions,
    });
  }, [editInv, editBillAs]);

  const openEdit = (inv: TuitionV2Invoice) => {
    const billed = Math.max(0, inv.billableSessionCount - (inv.priorMonthCredit?.sessions ?? 0));
    const preview = applyPriorMonthSessionCredit({
      sessionCount: inv.billableSessionCount,
      ratePerHour: inv.ratePerHour,
      siblingDiscountApplied: inv.siblingDiscountApplied,
      siblingDiscountPercent: inv.siblingDiscountPercent,
      creditSessions: inv.priorMonthCredit?.sessions ?? 0,
    });
    setEditInv(inv);
    setEditBillAs(String(billed));
    setEditNote(
      (inv.priorMonthCredit?.sessions ?? 0) > 0
        ? inv.priorMonthCredit?.note || preview.note
        : inv.afterFeeNote
    );
    setEditAmount(String(inv.amount));
    setEditReason(inv.manualOverride?.reason ?? "");
  };

  const saveOverride = async () => {
    if (!editInv || !editCreditPreview) return;
    const token = await fetchToken();
    if (!token) return;
    const billed = Number(editBillAs);
    if (editBillAs.trim() === "" || !Number.isFinite(billed) || billed < 0) {
      setError("Invalid session count");
      return;
    }
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Invalid amount");
      return;
    }
    const creditSessions = Math.max(0, editInv.billableSessionCount - Math.floor(billed));
    const body: Record<string, unknown> = {
      priorMonthCreditSessions: creditSessions,
      afterFeeNote: editNote.trim(),
    };
    if (Math.round(amt) !== editCreditPreview.amount) {
      body.manualOverride = { amount: Math.round(amt), reason: editReason || "Admin override" };
    }
    setSaveBusy(true);
    try {
      const res = await fetch(
        `/api/admin/tuition-v2/months/${monthToApiPath(selectedMonth)}/invoices/${encodeURIComponent(editInv.swimmerId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setError("");
      setStatusMsg(
        creditSessions > 0
          ? `Applied ${creditSessions} session credit for ${editInv.swimmerName} ($${editCreditPreview.creditAmount}).`
          : `Saved tuition for ${editInv.swimmerName}.`
      );
      setEditInv(null);
      await load();
    } finally {
      setSaveBusy(false);
    }
  };

  if (isAdmin === null) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8 px-4">Checking permission…</div>
      </>
    );
  }
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
              Tuition recalculates automatically. Publish is per swimmer: a new kid or a schedule
              change only needs that row (or this level) published. Others stay as they are.
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
          <Badge variant={unpublishedInList.length === 0 && invoices.length > 0 ? "default" : "outline"}>
            App: {publishedCount} published · {invoices.length - publishedCount} 核算中
          </Badge>
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
          <Button
            onClick={() =>
              void publishToApp(
                levelFilter
                  ? { levels: levelFilter }
                  : { swimmerIds: unpublishedInList.map((i) => i.swimmerId) }
              )
            }
            disabled={publishBusy || unpublishedInList.length === 0}
          >
            {publishBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {levelFilter
              ? levelFilter.length === 1
                ? `Publish ${levelFilter[0]} (${unpublishedInList.length})`
                : `Publish ${levelFilter.length} levels (${unpublishedInList.length})`
              : `Publish unpublished (${unpublishedInList.length})`}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void publishToApp(
                levelFilter
                  ? { levels: levelFilter }
                  : { swimmerIds: publishedInList.map((i) => i.swimmerId) },
                "unpublish"
              )
            }
            disabled={publishBusy || publishedInList.length === 0}
          >
            {levelFilter
              ? levelFilter.length === 1
                ? `Unpublish ${levelFilter[0]} (${publishedInList.length})`
                : `Unpublish ${levelFilter.length} levels (${publishedInList.length})`
              : `Unpublish (${publishedInList.length})`}
          </Button>
        </div>

        <div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            aria-pressed={!levelFilter}
            onClick={() => setListLevels([])}
            className={cn(
              "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
              !levelFilter ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            All
          </button>
          {(Object.entries(LEVEL_GROUPS) as [string, readonly string[]][]).map(([group, levels], index) => {
            const style = LEVEL_FILTER_STYLES[group];
            const groupOn =
              Boolean(levelFilter) && levels.every((level) => listLevels.includes(level));
            return (
              <div
                key={group}
                className={cn(
                  "inline-flex items-center gap-0.5 whitespace-nowrap",
                  index > 0 && "border-l border-slate-200 pl-1 ml-0.5"
                )}
              >
                <button
                  type="button"
                  aria-pressed={groupOn}
                  title={`All ${group}`}
                  onClick={() => toggleLevelGroup(levels)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors",
                    groupOn ? style.on : style.off
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", style.dot, groupOn && "bg-white/90")} />
                  {group}
                </button>
                {levels.map((level) => {
                  const selected = listLevels.includes(level);
                  const short = level.includes("Beginner") ? "Beg" : "Perf";
                  const count = levelCounts[level] ?? 0;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={selected}
                      title={level}
                      onClick={() => toggleListLevel(level)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium transition-colors",
                        selected ? style.on : style.off
                      )}
                    >
                      {short}
                      <span className={cn("ml-1 tabular-nums text-[11px]", selected ? "text-white/80" : "text-slate-400")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Invoices ({filtered.length})</CardTitle>
            <CardAction>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search swimmer…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="h-8 pl-9"
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoices yet. Set up the month in Plan — saving there (or adding a swimmer)
                fills this list automatically.
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
                    <th className="py-2 pr-2">App</th>
                    <th className="py-2 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const needsPublish = invoiceNeedsAppPublish(inv);
                    return (
                      <tr key={inv.swimmerId} className="border-b">
                        <td className="py-2 pr-2 font-medium">{inv.swimmerName}</td>
                        <td className="py-2 pr-2">{inv.level}</td>
                        <td className="py-2 pr-2">{inv.regularWeekdays.length} d/wk</td>
                        <td className="py-2 pr-2">
                          <span title={inv.rateTierReason}>
                            ${inv.ratePerHour} ({inv.rateTier})
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {inv.priorMonthCredit?.sessions
                            ? `${inv.billableSessionCount - inv.priorMonthCredit.sessions} / ${inv.billableSessionCount}`
                            : inv.billableSessionCount}
                          {inv.priorMonthCredit?.sessions ? (
                            <span className="block text-xs text-amber-700">
                              −{inv.priorMonthCredit.sessions} credit
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2">
                          ${inv.amount}
                          {inv.siblingDiscountApplied && (
                            <span className="block text-xs text-green-700">-{inv.siblingDiscountPercent}% sibling</span>
                          )}
                          {inv.priorMonthCredit?.creditAmount ? (
                            <span className="block text-xs text-amber-700">
                              −${inv.priorMonthCredit.creditAmount} prior month
                            </span>
                          ) : null}
                          {inv.manualOverride && (
                            <span className="block text-xs text-amber-700">override</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <Badge variant={needsPublish ? "outline" : "default"}>
                            {needsPublish ? "核算中" : "In app"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {needsPublish ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={publishingId === inv.swimmerId || publishBusy}
                              onClick={() => void publishToApp({ swimmerIds: [inv.swimmerId] })}
                            >
                              {publishingId === inv.swimmerId ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : null}
                              Publish
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={publishingId === inv.swimmerId || publishBusy}
                              onClick={() => void publishToApp({ swimmerIds: [inv.swimmerId] }, "unpublish")}
                            >
                              {publishingId === inv.swimmerId ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : null}
                              Unpublish
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                            Edit
                          </Button>
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
              <DialogTitle>Edit tuition — {editInv?.swimmerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This month: <strong>{editInv?.billableSessionCount}</strong> sessions × ${editInv?.ratePerHour}
                {editInv?.siblingDiscountApplied
                  ? ` · ${editInv.siblingDiscountPercent}% sibling discount`
                  : ""}
              </p>
              <div>
                <Label>Bill as (sessions)</Label>
                <Input
                  type="number"
                  min={0}
                  max={editInv?.billableSessionCount}
                  value={editBillAs}
                  onChange={(e) => {
                    setEditBillAs(e.target.value);
                    const billed = Number(e.target.value);
                    if (!editInv || !Number.isFinite(billed)) return;
                    const preview = applyPriorMonthSessionCredit({
                      sessionCount: editInv.billableSessionCount,
                      ratePerHour: editInv.ratePerHour,
                      siblingDiscountApplied: editInv.siblingDiscountApplied,
                      siblingDiscountPercent: editInv.siblingDiscountPercent,
                      creditSessions: Math.max(0, editInv.billableSessionCount - Math.floor(billed)),
                    });
                    setEditAmount(String(preview.amount));
                    setEditNote(preview.note);
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Lower this when last month had a team cancellation (pool closed, etc.). Sibling discount still
                  applies to the remaining sessions.
                </p>
              </div>
              {editCreditPreview && editCreditPreview.creditSessions > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p>
                    Billed {editCreditPreview.billedSessions} sessions
                    {editInv?.siblingDiscountApplied
                      ? ` · $${editCreditPreview.baseAmount} → $${editCreditPreview.amount} after sibling`
                      : ` · $${editCreditPreview.amount}`}
                  </p>
                  <p className="mt-1 font-medium">
                    ${editCreditPreview.creditAmount} credit from previous month
                  </p>
                </div>
              ) : null}
              <div>
                <Label>Note for parent / email</Label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Optional. Left blank unless you lower Bill as."
                />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-filled from sessions. Change only if you need a custom dollar override.
                </p>
              </div>
              {editInv && editCreditPreview && Number(editAmount) !== editCreditPreview.amount ? (
                <div>
                  <Label>Override reason</Label>
                  <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} />
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{editInv?.rateTierReason}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{editInv?.practiceText}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => void saveOverride()} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
