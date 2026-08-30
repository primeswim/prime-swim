import type { Firestore } from "firebase-admin/firestore";
import { normalizeSiblingIds, getSwimmerEnrollmentMillis } from "@/lib/swimmer-siblings";
import { isSwimmerEligibleForMonthlyTuition } from "@/lib/membership";
import { commitWrites, withoutUndefined } from "@/lib/tuition-v2/firestore-utils";
import { TUITION_V2_ENROLLMENT_COLLECTION } from "@/lib/tuition-v2/constants";
import type { TuitionV2SwimmerEnrollment } from "@/lib/tuition-v2/types";

function normalizeWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => typeof n === "number" && n >= 0 && n <= 6).sort((a, b) => a - b);
}

function enrollmentFromRoster(
  swimmerId: string,
  data: Record<string, unknown>
): TuitionV2SwimmerEnrollment | null {
  const level = typeof data.level === "string" ? data.level.trim() : "";
  if (!level) return null;

  const swimmerName =
    [data.childFirstName, data.childLastName]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" ")
      .trim() || swimmerId;
  const parentName =
    (typeof data.parentName === "string" && data.parentName.trim()) ||
    [data.parentFirstName, data.parentLastName]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" ")
      .trim() ||
    "";
  const parentEmailRaw =
    (typeof data.parentEmail === "string" && data.parentEmail.trim()) ||
    (Array.isArray(data.parentEmails)
      ? data.parentEmails.find((x: unknown) => typeof x === "string" && x.includes("@"))
      : "") ||
    "";
  const parentEmail = typeof parentEmailRaw === "string" ? parentEmailRaw.trim() : "";

  return {
    swimmerId,
    swimmerName,
    level,
    parentName,
    parentEmail,
    regularWeekdays: normalizeWeekdays(data.trainingWeekdays),
    siblingIds: normalizeSiblingIds(data.siblingIds, swimmerId),
    enrollmentMillis: getSwimmerEnrollmentMillis(data),
    active: true,
  };
}

export function parseEnrollmentDoc(
  swimmerId: string,
  raw: Record<string, unknown> | undefined
): TuitionV2SwimmerEnrollment | null {
  if (!raw) return null;
  const level = typeof raw.level === "string" ? raw.level.trim() : "";
  if (!level) return null;
  const swimmerName =
    (typeof raw.swimmerName === "string" && raw.swimmerName.trim()) || swimmerId;
  return {
    swimmerId,
    swimmerName,
    level,
    parentName: typeof raw.parentName === "string" ? raw.parentName : "",
    parentEmail: typeof raw.parentEmail === "string" ? raw.parentEmail : "",
    regularWeekdays: normalizeWeekdays(raw.regularWeekdays),
    unavailableWeekdays: normalizeWeekdays(raw.unavailableWeekdays).length
      ? normalizeWeekdays(raw.unavailableWeekdays)
      : undefined,
    ratePerHourOverride:
      typeof raw.ratePerHourOverride === "number" && raw.ratePerHourOverride > 0
        ? raw.ratePerHourOverride
        : raw.ratePerHourOverride === null
          ? null
          : undefined,
    siblingIds: Array.isArray(raw.siblingIds)
      ? raw.siblingIds.filter((id): id is string => typeof id === "string")
      : [],
    enrollmentMillis:
      typeof raw.enrollmentMillis === "number" ? raw.enrollmentMillis : undefined,
    active: raw.active !== false,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

/**
 * Keep tuition_v2_swimmer_enrollment in sync with active team roster.
 * Creates V2 docs for new active swimmers; marks frozen swimmers inactive.
 * Does not modify swimmers collection or V1 tuition data.
 */
export async function syncActiveSwimmerEnrollments(db: Firestore): Promise<void> {
  const [swimmersSnap, existingSnap] = await Promise.all([
    db.collection("swimmers").get(),
    db.collection(TUITION_V2_ENROLLMENT_COLLECTION).get(),
  ]);
  const existingById = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
  const now = new Date().toISOString();
  const writes: Parameters<typeof commitWrites>[1] = [];

  for (const doc of swimmersSnap.docs) {
    const data = doc.data();
    const existing = existingById.get(doc.id);
    const eligible =
      isSwimmerEligibleForMonthlyTuition(data) &&
      typeof data.level === "string" &&
      data.level.trim().length > 0;

    if (!eligible) {
      if (existing && existing.active !== false) {
        writes.push({
          type: "set",
          ref: db.collection(TUITION_V2_ENROLLMENT_COLLECTION).doc(doc.id),
          data: { active: false, updatedAt: now },
          merge: true,
        });
      }
      continue;
    }

    const fromRoster = enrollmentFromRoster(doc.id, data);
    if (!fromRoster) continue;

    if (!existing) {
      writes.push({
        type: "set",
        ref: db.collection(TUITION_V2_ENROLLMENT_COLLECTION).doc(doc.id),
        data: withoutUndefined({ ...fromRoster, updatedAt: now }),
      });
      continue;
    }

    writes.push({
      type: "set",
      ref: db.collection(TUITION_V2_ENROLLMENT_COLLECTION).doc(doc.id),
      data: {
        swimmerName: fromRoster.swimmerName,
        level: fromRoster.level,
        parentName: fromRoster.parentName,
        parentEmail: fromRoster.parentEmail,
        siblingIds: fromRoster.siblingIds,
        enrollmentMillis: fromRoster.enrollmentMillis,
        active: true,
        updatedAt: now,
      },
      merge: true,
    });
  }

  if (writes.length > 0) await commitWrites(db, writes);
}

/** Active swimmers for V2 tuition (auto-synced from roster). */
export async function loadSwimmerEnrollments(db: Firestore): Promise<TuitionV2SwimmerEnrollment[]> {
  await syncActiveSwimmerEnrollments(db);
  const snap = await db.collection(TUITION_V2_ENROLLMENT_COLLECTION).get();
  const out: TuitionV2SwimmerEnrollment[] = [];
  for (const doc of snap.docs) {
    const parsed = parseEnrollmentDoc(doc.id, doc.data());
    if (parsed && parsed.active !== false) out.push(parsed);
  }
  out.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
  return out;
}

export async function saveSwimmerEnrollment(
  db: Firestore,
  enrollment: TuitionV2SwimmerEnrollment
): Promise<void> {
  await db
    .collection(TUITION_V2_ENROLLMENT_COLLECTION)
    .doc(enrollment.swimmerId)
    .set(
      withoutUndefined({
        ...enrollment,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
}

/** Update default training weekdays (V2-only; does not touch swimmers collection). */
export async function updateEnrollmentRegularWeekdays(
  db: Firestore,
  swimmerId: string,
  regularWeekdays: number[]
): Promise<TuitionV2SwimmerEnrollment | null> {
  const ref = db.collection(TUITION_V2_ENROLLMENT_COLLECTION).doc(swimmerId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const parsed = parseEnrollmentDoc(swimmerId, snap.data());
  if (!parsed || parsed.active === false) return null;

  const sorted = [...regularWeekdays].sort((a, b) => a - b);
  const updated: TuitionV2SwimmerEnrollment = { ...parsed, regularWeekdays: sorted };
  await saveSwimmerEnrollment(db, updated);
  return updated;
}
