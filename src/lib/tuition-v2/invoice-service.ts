import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  applySiblingTuitionDiscounts,
} from "@/lib/swimmer-siblings";
import {
  TUITION_V2_INVOICES_SUBCOL,
  TUITION_V2_MONTHS_COLLECTION,
} from "@/lib/tuition-v2/constants";
import {
  buildLineItems,
  getBillableSessionsForSwimmer,
  getMonthlyRate,
  practiceTextFromLineItems,
  toSiblingDiscountRows,
} from "@/lib/tuition-v2/calculate-engine";
import { enrollmentForMonth, loadSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";
import { ensureMonthDoc, loadLevelPlans, loadSessions, normalizeMonthDoc } from "@/lib/tuition-v2/month-service";
import { resolveSessionsForMonth, schedulePeriodCoverage } from "@/lib/tuition-v2/session-generator";
import { loadSwimmerResponses } from "@/lib/tuition-v2/swimmer-response-service";
import { loadV2Templates } from "@/lib/tuition-v2/templates";
import { defaultDueDateForMonth, monthLabel } from "@/lib/tuition-v2/shared-ui";
import { commitWrites, withoutUndefined } from "@/lib/tuition-v2/firestore-utils";
import {
  invoicesNeedingAppPublish,
  invoicesPublishedToApp,
  keepPublishedToAppAfterRecalc,
} from "@/lib/tuition-v2/parent-tuition";
import {
  applyPriorMonthSessionCredit,
  isAutoPriorMonthCreditNote,
  normalizePriorMonthCredit,
  toPriorMonthCredit,
} from "@/lib/tuition-v2/prior-month-credit";
import type { TuitionV2Invoice, TuitionV2MonthDoc } from "@/lib/tuition-v2/types";

function invoiceBillingUnchanged(prev: TuitionV2Invoice, next: TuitionV2Invoice): boolean {
  return (
    prev.swimmerName === next.swimmerName &&
    prev.level === next.level &&
    prev.parentEmail === next.parentEmail &&
    prev.amount === next.amount &&
    prev.baseAmount === next.baseAmount &&
    prev.ratePerHour === next.ratePerHour &&
    prev.rateTier === next.rateTier &&
    prev.billableSessionCount === next.billableSessionCount &&
    prev.practiceText === next.practiceText &&
    prev.siblingDiscountApplied === next.siblingDiscountApplied &&
    (prev.priorMonthCredit?.sessions ?? 0) === (next.priorMonthCredit?.sessions ?? 0) &&
    (prev.priorMonthCredit?.creditAmount ?? 0) === (next.priorMonthCredit?.creditAmount ?? 0) &&
    JSON.stringify(prev.regularWeekdays) === JSON.stringify(next.regularWeekdays) &&
    JSON.stringify(prev.lineItems) === JSON.stringify(next.lineItems)
  );
}

function creditFromSessions(
  invoice: Pick<
    TuitionV2Invoice,
    "billableSessionCount" | "ratePerHour" | "siblingDiscountApplied" | "siblingDiscountPercent"
  >,
  creditSessions: number
) {
  return applyPriorMonthSessionCredit({
    sessionCount: invoice.billableSessionCount,
    ratePerHour: invoice.ratePerHour,
    siblingDiscountApplied: invoice.siblingDiscountApplied,
    siblingDiscountPercent: invoice.siblingDiscountPercent,
    creditSessions,
  });
}

function invoicesCol(db: Firestore, month: string) {
  return db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).collection(TUITION_V2_INVOICES_SUBCOL);
}

export function normalizeInvoice(swimmerId: string, raw: Record<string, unknown> | undefined): TuitionV2Invoice | null {
  if (!raw) return null;
  const amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    swimmerId,
    swimmerName: String(raw.swimmerName || swimmerId),
    level: String(raw.level || ""),
    parentName: String(raw.parentName || ""),
    parentEmail: String(raw.parentEmail || ""),
    regularWeekdays: Array.isArray(raw.regularWeekdays)
      ? raw.regularWeekdays.filter((n): n is number => typeof n === "number")
      : [],
    ratePerHour: typeof raw.ratePerHour === "number" ? raw.ratePerHour : 0,
    rateTier: raw.rateTier === "reduced" || raw.rateTier === "override" ? raw.rateTier : "normal",
    rateTierReason: String(raw.rateTierReason || ""),
    billableSessionCount: typeof raw.billableSessionCount === "number" ? raw.billableSessionCount : 0,
    amount: Math.round(amount),
    baseAmount: typeof raw.baseAmount === "number" ? raw.baseAmount : Math.round(amount),
    practiceText: String(raw.practiceText || ""),
    lineItems: Array.isArray(raw.lineItems) ? (raw.lineItems as TuitionV2Invoice["lineItems"]) : [],
    siblingDiscountApplied: raw.siblingDiscountApplied === true,
    siblingDiscountPercent:
      typeof raw.siblingDiscountPercent === "number" ? raw.siblingDiscountPercent : undefined,
    priorMonthCredit: normalizePriorMonthCredit(raw.priorMonthCredit),
    manualOverride:
      raw.manualOverride && typeof raw.manualOverride === "object"
        ? (raw.manualOverride as TuitionV2Invoice["manualOverride"])
        : null,
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : defaultDueDateForMonth(""),
    months: Array.isArray(raw.months) ? raw.months.map(String) : [],
    afterFeeNote: typeof raw.afterFeeNote === "string" ? raw.afterFeeNote : "",
    paid: raw.paid === true,
    paidOn: typeof raw.paidOn === "string" ? raw.paidOn : null,
    emailStatus: raw.emailStatus === "sent" || raw.emailStatus === "failed" ? raw.emailStatus : "pending",
    lastSentAt: typeof raw.lastSentAt === "string" ? raw.lastSentAt : undefined,
    lastEmailKind: typeof raw.lastEmailKind === "string" ? raw.lastEmailKind : undefined,
    firstInvoiceSentAt: typeof raw.firstInvoiceSentAt === "string" ? raw.firstInvoiceSentAt : undefined,
    publishedToApp:
      raw.publishedToApp === true ? true : raw.publishedToApp === false ? false : undefined,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export async function loadInvoices(db: Firestore, month: string): Promise<TuitionV2Invoice[]> {
  const snap = await invoicesCol(db, month).get();
  const out: TuitionV2Invoice[] = [];
  for (const doc of snap.docs) {
    const inv = normalizeInvoice(doc.id, doc.data());
    if (inv) out.push(inv);
  }
  out.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
  return out;
}

export type RecalculateInvoicesOptions = {
  /** When set, only compute and write invoices for these swimmer levels. */
  levels?: string[];
  /** When set, only write these swimmers. Other families are left unchanged. */
  swimmerIds?: string[];
  /**
   * Sync active team roster into enrollments before calc.
   * Default false — auto-refresh after plan saves must not scan all swimmers.
   */
  syncRoster?: boolean;
};

export async function recalculateInvoices(
  db: Firestore,
  month: string,
  options: RecalculateInvoicesOptions = {}
): Promise<{
  month: TuitionV2MonthDoc;
  invoices: TuitionV2Invoice[];
  count: number;
  levelsFilter: string[] | null;
  wroteCount: number;
}> {
  const levelFilter =
    options.levels?.length &&
    options.levels.every((l) => typeof l === "string" && l.trim().length > 0)
      ? new Set(options.levels.map((l) => l.trim()))
      : null;
  const swimmerFilter =
    options.swimmerIds?.length &&
    options.swimmerIds.every((id) => typeof id === "string" && id.trim().length > 0 && !id.includes("/"))
      ? new Set(options.swimmerIds)
      : null;

  const monthDoc = await ensureMonthDoc(db, month);
  const [templates, enrollments, sessions, responses, existingInvoices, levelPlans] =
    await Promise.all([
    loadV2Templates(db),
    loadSwimmerEnrollments(db, { syncRoster: options.syncRoster === true }),
    loadSessions(db, month),
    loadSwimmerResponses(db, month),
    loadInvoices(db, month),
    loadLevelPlans(db, month),
  ]);

  const billingSessions = resolveSessionsForMonth(
    month,
    levelPlans,
    sessions,
    monthDoc.noTrainingDates
  );
  const periodCoverage = schedulePeriodCoverage(levelPlans, month);

  const responseById = new Map(responses.map((r) => [r.swimmerId, r]));
  const existingById = new Map(existingInvoices.map((i) => [i.swimmerId, i]));
  const minDaysByLevel = new Map(Object.entries(templates).map(([level, t]) => [level, t.minDaysPerWeek]));

  const preSibling: Array<{
    enrollment: (typeof enrollments)[0];
    ratePerHour: number;
    rateTier: TuitionV2Invoice["rateTier"];
    rateTierReason: string;
    lineItems: TuitionV2Invoice["lineItems"];
    tuition: number;
  }> = [];

  for (const rawEnrollment of enrollments) {
    const enrollment = enrollmentForMonth(rawEnrollment, month);
    if (levelFilter && !levelFilter.has(enrollment.level)) continue;
    const template = templates[enrollment.level];
    const rate = getMonthlyRate(enrollment, template);
    const billable = getBillableSessionsForSwimmer(
      enrollment,
      billingSessions,
      responseById.get(enrollment.swimmerId) ?? null,
      periodCoverage.explicit,
      periodCoverage.periodDatesByLevel
    );
    if (billable.length === 0) continue;
    const lineItems = buildLineItems(billable, rate.ratePerHour);
    const tuition = lineItems.reduce((sum, li) => sum + li.amount, 0);
    preSibling.push({
      enrollment,
      ratePerHour: rate.ratePerHour,
      rateTier: rate.rateTier,
      rateTierReason: rate.rateTierReason,
      lineItems,
      tuition,
    });
  }

  const tuitionById = new Map(preSibling.map((r) => [r.enrollment.swimmerId, r.tuition]));
  const monthEnrollments = enrollments.map((raw) => enrollmentForMonth(raw, month));
  const siblingRows = toSiblingDiscountRows(monthEnrollments, tuitionById, minDaysByLevel);

  const enrollmentById = new Map<string, number>();
  const siblingIdsBySwimmer = new Map<string, string[]>();
  const trainingEligibilityById = new Map<string, { trainingWeekdays: number[]; minDaysPerWeek: number }>();

  for (const raw of enrollments) {
    const e = enrollmentForMonth(raw, month);
    enrollmentById.set(e.swimmerId, e.enrollmentMillis ?? Number.MAX_SAFE_INTEGER);
    siblingIdsBySwimmer.set(e.swimmerId, e.siblingIds ?? []);
    trainingEligibilityById.set(e.swimmerId, {
      trainingWeekdays: e.regularWeekdays,
      minDaysPerWeek: minDaysByLevel.get(e.level) ?? 0,
    });
  }

  const discounted = applySiblingTuitionDiscounts(
    siblingRows.map((r) => ({
      swimmerId: r.swimmerId,
      tuition: r.tuition,
      trainingWeekdays: r.trainingWeekdays,
      minDaysPerWeek: r.minDaysPerWeek,
    })),
    enrollmentById,
    siblingIdsBySwimmer,
    trainingEligibilityById
  );
  const discountedById = new Map(discounted.map((d) => [d.swimmerId, d]));

  const now = new Date().toISOString();
  const dueDate = defaultDueDateForMonth(month);
  const months = [monthLabel(month)];
  const invoices: TuitionV2Invoice[] = [];
  const writes: Parameters<typeof commitWrites>[1] = [];

  for (const row of preSibling) {
    const { enrollment, ratePerHour, rateTier, rateTierReason, lineItems } = row;
    if (swimmerFilter && !swimmerFilter.has(enrollment.swimmerId)) continue;
    const disc = discountedById.get(enrollment.swimmerId);
    const computedAmount = disc?.tuition ?? row.tuition;
    const existing = existingById.get(enrollment.swimmerId);

    let amount = computedAmount;
    let baseAmount = disc?.baseTuition ?? computedAmount;
    let priorMonthCredit = existing?.priorMonthCredit ?? null;
    let afterFeeNote = existing?.afterFeeNote ?? "";

    const creditSessions = priorMonthCredit?.sessions ?? 0;
    if (creditSessions > 0) {
      const applied = applyPriorMonthSessionCredit({
        sessionCount: lineItems.length,
        ratePerHour,
        siblingDiscountApplied: disc?.siblingDiscountApplied,
        siblingDiscountPercent: disc?.siblingDiscountPercent,
        creditSessions,
      });
      amount = applied.amount;
      baseAmount = applied.baseAmount;
      priorMonthCredit = toPriorMonthCredit(applied);
      if (!afterFeeNote || isAutoPriorMonthCreditNote(afterFeeNote, existing?.priorMonthCredit)) {
        afterFeeNote = applied.note;
      }
    }

    if (existing?.manualOverride && typeof existing.manualOverride.amount === "number") {
      amount = existing.manualOverride.amount;
    }

    const invoice: TuitionV2Invoice = {
      swimmerId: enrollment.swimmerId,
      swimmerName: enrollment.swimmerName,
      level: enrollment.level,
      parentName: enrollment.parentName,
      parentEmail: existing?.parentEmail || enrollment.parentEmail,
      regularWeekdays: enrollment.regularWeekdays,
      ratePerHour,
      rateTier,
      rateTierReason,
      billableSessionCount: lineItems.length,
      amount,
      baseAmount,
      practiceText: practiceTextFromLineItems(lineItems),
      lineItems,
      siblingDiscountApplied: disc?.siblingDiscountApplied,
      siblingDiscountPercent: disc?.siblingDiscountPercent,
      priorMonthCredit,
      manualOverride: existing?.manualOverride ?? null,
      dueDate: existing?.dueDate ?? dueDate,
      months: existing?.months?.length ? existing.months : months,
      afterFeeNote,
      paid: existing?.paid ?? false,
      paidOn: existing?.paidOn ?? null,
      emailStatus: existing?.emailStatus ?? "pending",
      lastSentAt: existing?.lastSentAt,
      lastEmailKind: existing?.lastEmailKind,
      firstInvoiceSentAt: existing?.firstInvoiceSentAt,
      updatedAt: now,
      publishedToApp: false,
      publishedAt: undefined,
    };

    const billingSame = !!existing && invoiceBillingUnchanged(existing, invoice);
    const keepPublished = keepPublishedToAppAfterRecalc(existing, billingSame);
    invoice.publishedToApp = keepPublished;
    invoice.publishedAt = keepPublished ? existing?.publishedAt : undefined;

    invoices.push(invoice);
    const publishFlagChanged = existing?.publishedToApp !== keepPublished;
    if (!existing || !billingSame || publishFlagChanged) {
      const data = withoutUndefined(invoice as unknown as Record<string, unknown>);
      data.publishedToApp = keepPublished;
      if (keepPublished) {
        if (invoice.publishedAt) data.publishedAt = invoice.publishedAt;
      } else {
        data.publishedAt = FieldValue.delete();
      }
      writes.push({
        type: "set",
        ref: invoicesCol(db, month).doc(enrollment.swimmerId),
        data,
        merge: true,
      });
    }
  }

  const rewrittenIds = new Set(preSibling.map((row) => row.enrollment.swimmerId));
  const enrollmentByIdForLevel = new Map(enrollments.map((enrollment) => [enrollment.swimmerId, enrollment]));
  for (const existing of existingInvoices) {
    if (swimmerFilter && !swimmerFilter.has(existing.swimmerId)) continue;
    if (rewrittenIds.has(existing.swimmerId)) continue;
    const enrollment = enrollmentByIdForLevel.get(existing.swimmerId);
    const monthEnrollment = enrollment ? enrollmentForMonth(enrollment, month) : null;
    if (!monthEnrollment || monthEnrollment.active === false || monthEnrollment.level === existing.level) continue;
    if (
      levelFilter &&
      !levelFilter.has(monthEnrollment.level) &&
      !levelFilter.has(existing.level)
    ) {
      continue;
    }
    writes.push({
      type: "delete",
      ref: invoicesCol(db, month).doc(existing.swimmerId),
    });
  }

  if (writes.length > 0) {
    writes.push({
      type: "update",
      ref: db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month),
      data: {
        status: "computed",
        lastCalculatedAt: now,
        updatedAt: now,
      },
    });
    await commitWrites(db, writes);
  }

  const wroteCount = writes.filter((w) => w.type === "set" || w.type === "delete").length;
  if (wroteCount === 0) {
    return {
      month: monthDoc,
      invoices: invoices.length ? invoices : existingInvoices,
      count: invoices.length,
      levelsFilter: levelFilter ? [...levelFilter] : null,
      wroteCount: 0,
    };
  }

  const [monthSnap, allInvoices] = await Promise.all([
    db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get(),
    loadInvoices(db, month),
  ]);
  return {
    month: normalizeMonthDoc(month, monthSnap.data()),
    invoices: allInvoices,
    count: invoices.length,
    levelsFilter: levelFilter ? [...levelFilter] : null,
    wroteCount,
  };
}

export async function approveMonth(
  db: Firestore,
  month: string,
  approvedBy: string
): Promise<TuitionV2MonthDoc> {
  const published = await publishInvoicesToApp(db, month, { actor: approvedBy });
  return published.month;
}

export type PublishInvoicesToAppOptions = {
  actor: string;
  swimmerIds?: string[];
  levels?: string[];
};

export async function publishInvoicesToApp(
  db: Firestore,
  month: string,
  options: PublishInvoicesToAppOptions
): Promise<{
  month: TuitionV2MonthDoc;
  invoices: TuitionV2Invoice[];
  publishedCount: number;
  publishedSwimmerIds: string[];
}> {
  const invoices = await loadInvoices(db, month);
  const targets = invoicesNeedingAppPublish(invoices, {
    swimmerIds: options.swimmerIds,
    levels: options.levels,
  });
  const monthRef = db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month);
  const monthSnap = await monthRef.get();
  const monthDoc = normalizeMonthDoc(month, monthSnap.data());
  if (targets.length === 0) {
    return { month: monthDoc, invoices, publishedCount: 0, publishedSwimmerIds: [] };
  }

  const now = new Date().toISOString();
  const writes: Parameters<typeof commitWrites>[1] = targets.map((inv) => ({
    type: "set",
    ref: invoicesCol(db, month).doc(inv.swimmerId),
    data: { publishedToApp: true, publishedAt: now, updatedAt: now },
    merge: true,
  }));
  await commitWrites(db, writes);

  const publishedIds = new Set(targets.map((t) => t.swimmerId));
  return {
    month: monthDoc,
    invoices: invoices.map((inv) =>
      publishedIds.has(inv.swimmerId)
        ? { ...inv, publishedToApp: true, publishedAt: now, updatedAt: now }
        : inv
    ),
    publishedCount: targets.length,
    publishedSwimmerIds: targets.map((t) => t.swimmerId),
  };
}

export async function unpublishInvoicesFromApp(
  db: Firestore,
  month: string,
  options: PublishInvoicesToAppOptions
): Promise<{
  month: TuitionV2MonthDoc;
  invoices: TuitionV2Invoice[];
  unpublishedCount: number;
  unpublishedSwimmerIds: string[];
}> {
  const invoices = await loadInvoices(db, month);
  const targets = invoicesPublishedToApp(invoices, {
    swimmerIds: options.swimmerIds,
    levels: options.levels,
  });
  const monthRef = db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month);
  const monthSnap = await monthRef.get();
  const monthDoc = normalizeMonthDoc(month, monthSnap.data());
  if (targets.length === 0) {
    return { month: monthDoc, invoices, unpublishedCount: 0, unpublishedSwimmerIds: [] };
  }

  const now = new Date().toISOString();
  const writes: Parameters<typeof commitWrites>[1] = targets.map((inv) => ({
    type: "set",
    ref: invoicesCol(db, month).doc(inv.swimmerId),
    data: { publishedToApp: false, publishedAt: FieldValue.delete(), updatedAt: now },
    merge: true,
  }));
  await commitWrites(db, writes);

  const unpublishedIds = new Set(targets.map((t) => t.swimmerId));
  return {
    month: monthDoc,
    invoices: invoices.map((inv) =>
      unpublishedIds.has(inv.swimmerId)
        ? { ...inv, publishedToApp: false, publishedAt: undefined, updatedAt: now }
        : inv
    ),
    unpublishedCount: targets.length,
    unpublishedSwimmerIds: targets.map((t) => t.swimmerId),
  };
}

export type InvoicePatch = Partial<
  Pick<
    TuitionV2Invoice,
    | "amount"
    | "dueDate"
    | "afterFeeNote"
    | "months"
    | "parentEmail"
    | "parentName"
    | "paid"
    | "paidOn"
    | "manualOverride"
    | "priorMonthCredit"
  >
> & {
  priorMonthCreditSessions?: number;
};

export async function updateInvoice(
  db: Firestore,
  month: string,
  swimmerId: string,
  patch: InvoicePatch
): Promise<TuitionV2Invoice | null> {
  const ref = invoicesCol(db, month).doc(swimmerId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = normalizeInvoice(swimmerId, snap.data());
  if (!current) return null;

  const { priorMonthCreditSessions: creditSessionsPatch, ...invoicePatch } = patch;
  const next: TuitionV2Invoice = {
    ...current,
    ...invoicePatch,
    updatedAt: new Date().toISOString(),
  };

  if (patch.amount !== undefined && !patch.manualOverride && creditSessionsPatch === undefined) {
    next.manualOverride = { amount: patch.amount, reason: "Admin edit" };
    next.amount = patch.amount;
  }

  if (creditSessionsPatch !== undefined) {
    const applied = creditFromSessions(current, creditSessionsPatch);
    const credit = toPriorMonthCredit(applied);
    next.priorMonthCredit = credit;
    next.amount = applied.amount;
    next.baseAmount = applied.baseAmount;
    if (patch.manualOverride && typeof patch.manualOverride.amount === "number") {
      next.manualOverride = patch.manualOverride;
      next.amount = patch.manualOverride.amount;
    } else {
      next.manualOverride = null;
    }
    if (typeof patch.afterFeeNote === "string") {
      next.afterFeeNote = patch.afterFeeNote;
      if (credit) next.priorMonthCredit = { ...credit, note: patch.afterFeeNote.trim() || credit.note };
    } else if (!current.afterFeeNote || isAutoPriorMonthCreditNote(current.afterFeeNote, current.priorMonthCredit)) {
      next.afterFeeNote = applied.note;
    }
  } else if (patch.priorMonthCredit !== undefined) {
    next.priorMonthCredit = patch.priorMonthCredit;
  }

  const affectsTuition =
    patch.amount !== undefined ||
    patch.manualOverride !== undefined ||
    creditSessionsPatch !== undefined ||
    patch.priorMonthCredit !== undefined;
  if (affectsTuition) {
    next.publishedToApp = false;
    next.publishedAt = undefined;
  }

  const data = withoutUndefined(next as unknown as Record<string, unknown>);
  if (affectsTuition) {
    data.publishedToApp = false;
    data.publishedAt = FieldValue.delete();
  }
  if (next.priorMonthCredit == null) {
    data.priorMonthCredit = FieldValue.delete();
  }
  if (next.manualOverride == null && (patch.manualOverride === null || creditSessionsPatch !== undefined)) {
    data.manualOverride = FieldValue.delete();
  }

  await ref.set(data, { merge: true });
  return next;
}
