import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { SWIMMER_LEVELS } from "@/lib/swimmer-levels";
import {
  TUITION_V2_LEVEL_PLANS_SUBCOL,
  TUITION_V2_MONTHS_COLLECTION,
  TUITION_V2_SESSIONS_SUBCOL,
} from "@/lib/tuition-v2/constants";
import {
  generateSessionsForMonth,
  mergeRegeneratedSessions,
  normalizeSession,
} from "@/lib/tuition-v2/session-generator";
import {
  levelPlanFromTemplate,
  loadV2Templates,
  mergeTemplateWeeklySlotsIntoPlan,
  normalizeLevelPlan,
} from "@/lib/tuition-v2/templates";
import type { TuitionV2LevelTemplateMap } from "@/lib/tuition-v2/types";
import type {
  TuitionV2LevelPlan,
  TuitionV2MonthDoc,
  TuitionV2MonthStatus,
  TuitionV2Session,
} from "@/lib/tuition-v2/types";

function monthRef(db: Firestore, month: string) {
  return db.collection(TUITION_V2_MONTHS_COLLECTION).doc(month);
}

function levelPlansCol(db: Firestore, month: string) {
  return monthRef(db, month).collection(TUITION_V2_LEVEL_PLANS_SUBCOL);
}

function sessionsCol(db: Firestore, month: string) {
  return monthRef(db, month).collection(TUITION_V2_SESSIONS_SUBCOL);
}

export function normalizeMonthDoc(month: string, raw: Record<string, unknown> | undefined): TuitionV2MonthDoc {
  const statusRaw = raw?.status;
  const status: TuitionV2MonthStatus =
    statusRaw === "computed" ||
    statusRaw === "approved" ||
    statusRaw === "sent" ||
    statusRaw === "closed"
      ? statusRaw
      : "planning";
  const noTrainingDates = Array.isArray(raw?.noTrainingDates)
    ? raw!.noTrainingDates.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
  return {
    month,
    status,
    noTrainingDates,
    lastSessionsGeneratedAt:
      typeof raw?.lastSessionsGeneratedAt === "string" ? raw.lastSessionsGeneratedAt : undefined,
    lastCalculatedAt: typeof raw?.lastCalculatedAt === "string" ? raw.lastCalculatedAt : undefined,
    approvedAt: typeof raw?.approvedAt === "string" ? raw.approvedAt : undefined,
    approvedBy: typeof raw?.approvedBy === "string" ? raw.approvedBy : undefined,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export async function ensureMonthDoc(db: Firestore, month: string): Promise<TuitionV2MonthDoc> {
  const ref = monthRef(db, month);
  const snap = await ref.get();
  if (snap.exists) {
    return normalizeMonthDoc(month, snap.data());
  }
  const now = new Date().toISOString();
  const doc: TuitionV2MonthDoc = {
    month,
    status: "planning",
    noTrainingDates: [],
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(doc);
  return doc;
}

export async function loadLevelPlans(db: Firestore, month: string): Promise<TuitionV2LevelPlan[]> {
  const templates = await loadV2Templates(db);
  const snap = await levelPlansCol(db, month).get();
  const byLevel = new Map<string, TuitionV2LevelPlan>();
  for (const doc of snap.docs) {
    const level = doc.id;
    const template = templates[level] ?? levelPlanFromTemplate(level, {
      defaultRatePerHour: 0,
      minDaysPerWeek: 2,
      reducedRatePerHour: null,
      weeklySlots: [],
      defaultTimeSlot: "7-8PM",
      defaultLocation: "Mary Wayte Pool",
    });
    byLevel.set(level, normalizeLevelPlan(level, doc.data(), template, month));
  }
  const out: TuitionV2LevelPlan[] = [];
  for (const level of SWIMMER_LEVELS) {
    if (byLevel.has(level)) {
      out.push(byLevel.get(level)!);
    } else {
      const template = templates[level];
      if (template) out.push(levelPlanFromTemplate(level, template));
    }
  }
  return out;
}

export async function saveLevelPlans(
  db: Firestore,
  month: string,
  plans: TuitionV2LevelPlan[]
): Promise<void> {
  const now = new Date().toISOString();
  await ensureMonthDoc(db, month);
  const batch = db.batch();
  for (const plan of plans) {
    if (!plan.level) continue;
    const ref = levelPlansCol(db, month).doc(plan.level);
    batch.set(
      ref,
      {
        level: plan.level,
        weeklySlots: plan.weeklySlots,
        schedulePeriods: plan.schedulePeriods ?? [],
        notes: plan.notes ?? "",
        updatedAt: now,
      },
      { merge: true }
    );
  }
  batch.update(monthRef(db, month), {
    updatedAt: now,
    ...(await shouldDowngradeApproved(db, month) ? { status: "computed", approvedAt: FieldValue.delete(), approvedBy: FieldValue.delete() } : {}),
  });
  await batch.commit();
}

async function shouldDowngradeApproved(db: Firestore, month: string): Promise<boolean> {
  const snap = await monthRef(db, month).get();
  return snap.data()?.status === "approved";
}

/**
 * Sync default weekly schedule from templates into this month's level plans.
 * Creates missing level docs; updates weeklySlots only — schedule periods and notes are preserved.
 */
export async function syncLevelPlansFromTemplates(
  db: Firestore,
  month: string,
  templates?: TuitionV2LevelTemplateMap
): Promise<TuitionV2LevelPlan[]> {
  const tpl = templates ?? (await loadV2Templates(db));
  await ensureMonthDoc(db, month);
  const existingSnap = await levelPlansCol(db, month).get();
  const existingByLevel = new Map<string, TuitionV2LevelPlan>();
  for (const doc of existingSnap.docs) {
    const level = doc.id;
    const template = tpl[level] ?? {
      defaultRatePerHour: 0,
      minDaysPerWeek: 2,
      reducedRatePerHour: null,
      weeklySlots: [],
      defaultTimeSlot: "7-8PM",
      defaultLocation: "Mary Wayte Pool",
    };
    existingByLevel.set(level, normalizeLevelPlan(level, doc.data(), template, month));
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  const plans: TuitionV2LevelPlan[] = [];

  for (const level of SWIMMER_LEVELS) {
    const template = tpl[level];
    if (!template) continue;
    const plan = mergeTemplateWeeklySlotsIntoPlan(existingByLevel.get(level), level, template);
    plans.push(plan);
    batch.set(
      levelPlansCol(db, month).doc(level),
      {
        level: plan.level,
        weeklySlots: plan.weeklySlots,
        schedulePeriods: plan.schedulePeriods ?? [],
        notes: plan.notes ?? "",
        updatedAt: now,
      },
      { merge: true }
    );
  }

  batch.update(monthRef(db, month), { updatedAt: now });
  await batch.commit();
  return plans;
}

/** @deprecated Use syncLevelPlansFromTemplates — same behavior (merge, not wipe). */
export async function initLevelPlansFromTemplates(
  db: Firestore,
  month: string,
  templates?: TuitionV2LevelTemplateMap
): Promise<TuitionV2LevelPlan[]> {
  return syncLevelPlansFromTemplates(db, month, templates);
}

export async function loadSessions(db: Firestore, month: string): Promise<TuitionV2Session[]> {
  const snap = await sessionsCol(db, month).get();
  const out: TuitionV2Session[] = [];
  for (const doc of snap.docs) {
    const s = normalizeSession(doc.data(), doc.id);
    if (s) out.push(s);
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.level.localeCompare(b.level));
  return out;
}

export async function regenerateSessions(db: Firestore, month: string): Promise<TuitionV2Session[]> {
  const monthDoc = await ensureMonthDoc(db, month);
  const levelPlans = await loadLevelPlans(db, month);
  const existing = await loadSessions(db, month);
  const generated = generateSessionsForMonth(month, levelPlans, monthDoc.noTrainingDates);
  const merged = mergeRegeneratedSessions(generated, existing);
  const col = sessionsCol(db, month);
  const batch = db.batch();

  for (const doc of (await col.get()).docs) {
    if (doc.data()?.source !== "manual") {
      batch.delete(doc.ref);
    }
  }

  for (const session of merged) {
    batch.set(col.doc(session.id), {
      date: session.date,
      level: session.level,
      weekday: session.weekday,
      timeSlot: session.timeSlot,
      location: session.location,
      source: session.source,
      cancelled: session.cancelled,
      ...(session.extraTraining ? { extraTraining: true } : {}),
      ...(session.cancelReason ? { cancelReason: session.cancelReason } : {}),
    });
  }

  const now = new Date().toISOString();
  const downgrade = monthDoc.status === "approved";
  batch.update(monthRef(db, month), {
    lastSessionsGeneratedAt: now,
    updatedAt: now,
    ...(downgrade ? { status: "computed", approvedAt: FieldValue.delete(), approvedBy: FieldValue.delete() } : {}),
  });
  await batch.commit();
  return merged;
}

export async function updateSession(
  db: Firestore,
  month: string,
  sessionId: string,
  patch: Partial<Pick<TuitionV2Session, "cancelled" | "cancelReason" | "timeSlot" | "location">>,
  fallback?: TuitionV2Session
): Promise<TuitionV2Session | null> {
  const ref = sessionsCol(db, month).doc(sessionId);
  const snap = await ref.get();
  let current = snap.exists ? normalizeSession(snap.data(), snap.id) : null;
  if (!current) current = fallback ?? null;
  if (!current) return null;

  const next = {
    ...current,
    ...patch,
  };
  await ref.set(
    {
      date: next.date,
      level: next.level,
      weekday: next.weekday,
      timeSlot: next.timeSlot,
      location: next.location,
      source: next.source,
      cancelled: next.cancelled,
      ...(next.extraTraining ? { extraTraining: true } : {}),
      cancelReason: next.cancelReason ?? FieldValue.delete(),
    },
    { merge: true }
  );

  const monthSnap = await monthRef(db, month).get();
  if (monthSnap.data()?.status === "approved") {
    await monthRef(db, month).update({
      status: "computed",
      approvedAt: FieldValue.delete(),
      approvedBy: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  }
  return next;
}

export async function updateMonthNoTraining(
  db: Firestore,
  month: string,
  noTrainingDates: string[]
): Promise<TuitionV2MonthDoc> {
  await ensureMonthDoc(db, month);
  const ref = monthRef(db, month);
  const snap = await ref.get();
  const downgrade = snap.data()?.status === "approved";
  const now = new Date().toISOString();
  await ref.set(
    {
      noTrainingDates,
      updatedAt: now,
      ...(downgrade ? { status: "computed", approvedAt: FieldValue.delete(), approvedBy: FieldValue.delete() } : {}),
    },
    { merge: true }
  );
  const updated = await ref.get();
  return normalizeMonthDoc(month, updated.data());
}
