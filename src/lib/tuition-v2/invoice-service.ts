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
import { loadSwimmerEnrollments } from "@/lib/tuition-v2/enrollment-service";
import { ensureMonthDoc, loadLevelPlans, loadSessions, normalizeMonthDoc } from "@/lib/tuition-v2/month-service";
import { resolveSessionsForMonth, schedulePeriodCoverage } from "@/lib/tuition-v2/session-generator";
import { loadSwimmerResponses } from "@/lib/tuition-v2/swimmer-response-service";
import { loadV2Templates } from "@/lib/tuition-v2/templates";
import { defaultDueDateForMonth, monthLabel } from "@/lib/tuition-v2/shared-ui";
import { commitWrites, withoutUndefined } from "@/lib/tuition-v2/firestore-utils";
import type { TuitionV2Invoice, TuitionV2MonthDoc } from "@/lib/tuition-v2/types";

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
}> {
  const levelFilter =
    options.levels?.length &&
    options.levels.every((l) => typeof l === "string" && l.trim().length > 0)
      ? new Set(options.levels.map((l) => l.trim()))
      : null;

  const monthDoc = await ensureMonthDoc(db, month);
  const [templates, enrollments, sessions, responses, existingInvoices, levelPlans] =
    await Promise.all([
    loadV2Templates(db),
    loadSwimmerEnrollments(db, { syncRoster: !levelFilter }),
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

  for (const enrollment of enrollments) {
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
  const siblingRows = toSiblingDiscountRows(enrollments, tuitionById, minDaysByLevel);

  const enrollmentById = new Map<string, number>();
  const siblingIdsBySwimmer = new Map<string, string[]>();
  const trainingEligibilityById = new Map<string, { trainingWeekdays: number[]; minDaysPerWeek: number }>();

  for (const e of enrollments) {
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
    const disc = discountedById.get(enrollment.swimmerId);
    const computedAmount = disc?.tuition ?? row.tuition;
    const existing = existingById.get(enrollment.swimmerId);

    let amount = computedAmount;
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
      baseAmount: disc?.baseTuition ?? computedAmount,
      practiceText: practiceTextFromLineItems(lineItems),
      lineItems,
      siblingDiscountApplied: disc?.siblingDiscountApplied,
      siblingDiscountPercent: disc?.siblingDiscountPercent,
      manualOverride: existing?.manualOverride ?? null,
      dueDate: existing?.dueDate ?? dueDate,
      months: existing?.months?.length ? existing.months : months,
      afterFeeNote: existing?.afterFeeNote ?? "",
      paid: existing?.paid ?? false,
      paidOn: existing?.paidOn ?? null,
      emailStatus: existing?.emailStatus ?? "pending",
      lastSentAt: existing?.lastSentAt,
      lastEmailKind: existing?.lastEmailKind,
      firstInvoiceSentAt: existing?.firstInvoiceSentAt,
      updatedAt: now,
    };

    invoices.push(invoice);
    writes.push({
      type: "set",
      ref: invoicesCol(db, month).doc(enrollment.swimmerId),
      data: withoutUndefined(invoice as unknown as Record<string, unknown>),
      merge: true,
    });
  }

  writes.push({
    type: "update",
    ref: db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month),
    data: {
      status: "computed",
      lastCalculatedAt: now,
      updatedAt: now,
      approvedAt: FieldValue.delete(),
      approvedBy: FieldValue.delete(),
    },
  });

  await commitWrites(db, writes);
  const [monthSnap, allInvoices] = await Promise.all([
    db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get(),
    loadInvoices(db, month),
  ]);
  return {
    month: normalizeMonthDoc(month, monthSnap.data()),
    invoices: allInvoices,
    count: invoices.length,
    levelsFilter: levelFilter ? [...levelFilter] : null,
  };
}

export async function approveMonth(
  db: Firestore,
  month: string,
  approvedBy: string
): Promise<TuitionV2MonthDoc> {
  const now = new Date().toISOString();
  await db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).set(
    {
      status: "approved",
      approvedAt: now,
      approvedBy,
      updatedAt: now,
    },
    { merge: true }
  );
  const snap = await db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).get();
  return normalizeMonthDoc(month, snap.data());
}

export async function updateInvoice(
  db: Firestore,
  month: string,
  swimmerId: string,
  patch: Partial<
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
    >
  >
): Promise<TuitionV2Invoice | null> {
  const ref = invoicesCol(db, month).doc(swimmerId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = normalizeInvoice(swimmerId, snap.data());
  if (!current) return null;

  const next: TuitionV2Invoice = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (patch.amount !== undefined && !patch.manualOverride) {
    next.manualOverride = { amount: patch.amount, reason: "Admin edit" };
    next.amount = patch.amount;
  }

  await ref.set(withoutUndefined(next as unknown as Record<string, unknown>), { merge: true });

  const emailOnly =
    patch.dueDate !== undefined ||
    patch.afterFeeNote !== undefined ||
    patch.months !== undefined ||
    patch.parentEmail !== undefined ||
    patch.parentName !== undefined ||
    patch.paid !== undefined;

  const affectsTuition = patch.amount !== undefined || patch.manualOverride !== undefined;

  if (affectsTuition && !emailOnly) {
    await db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month).set(
      {
        status: "computed",
        approvedAt: FieldValue.delete(),
        approvedBy: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  return next;
}
