import type { Firestore } from "firebase-admin/firestore";
import {
  TUITION_V2_MONTHS_COLLECTION,
  TUITION_V2_SWIMMER_RESPONSES_SUBCOL,
} from "@/lib/tuition-v2/constants";
import type { TuitionV2SwimmerAdjustment, TuitionV2SwimmerResponse } from "@/lib/tuition-v2/types";

function responsesCol(db: Firestore, month: string) {
  return db
    .collection(TUITION_V2_MONTHS_COLLECTION)
    .doc(month)
    .collection(TUITION_V2_SWIMMER_RESPONSES_SUBCOL);
}

function normalizeAdjustments(raw: unknown): TuitionV2SwimmerAdjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: TuitionV2SwimmerAdjustment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const type = a.type;
    if (type !== "skip_session" && type !== "swap_session" && type !== "add_session") continue;
    out.push({
      type,
      fromSessionId: typeof a.fromSessionId === "string" ? a.fromSessionId : undefined,
      toSessionId: typeof a.toSessionId === "string" ? a.toSessionId : undefined,
      note: typeof a.note === "string" ? a.note : undefined,
    });
  }
  return out;
}

function normalizeWeekdayAvailability(
  raw: unknown
): Record<number, "available" | "unavailable"> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<number, "available" | "unavailable"> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const wd = Number(key);
    if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue;
    if (value === "available" || value === "unavailable") {
      out[wd] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function normalizeSwimmerResponse(
  swimmerId: string,
  raw: Record<string, unknown> | undefined
): TuitionV2SwimmerResponse {
  return {
    swimmerId,
    weekdayAvailability: normalizeWeekdayAvailability(raw?.weekdayAvailability),
    adjustments: normalizeAdjustments(raw?.adjustments),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined,
    updatedBy: typeof raw?.updatedBy === "string" ? raw.updatedBy : undefined,
  };
}

export async function loadSwimmerResponses(
  db: Firestore,
  month: string
): Promise<TuitionV2SwimmerResponse[]> {
  const snap = await responsesCol(db, month).get();
  return snap.docs.map((d) => normalizeSwimmerResponse(d.id, d.data()));
}

export async function saveSwimmerResponse(
  db: Firestore,
  month: string,
  response: TuitionV2SwimmerResponse,
  updatedBy: string
): Promise<TuitionV2SwimmerResponse> {
  const now = new Date().toISOString();
  const doc = {
    swimmerId: response.swimmerId,
    weekdayAvailability: response.weekdayAvailability ?? {},
    adjustments: response.adjustments ?? [],
    updatedAt: now,
    updatedBy,
  };
  await responsesCol(db, month).doc(response.swimmerId).set(doc, { merge: true });
  return { ...response, updatedAt: now, updatedBy };
}

export async function saveSwimmerResponsesBatch(
  db: Firestore,
  month: string,
  responses: TuitionV2SwimmerResponse[],
  updatedBy: string
): Promise<void> {
  const batch = db.batch();
  const now = new Date().toISOString();
  for (const response of responses) {
    const ref = responsesCol(db, month).doc(response.swimmerId);
    batch.set(
      ref,
      {
        swimmerId: response.swimmerId,
        weekdayAvailability: response.weekdayAvailability ?? {},
        adjustments: response.adjustments ?? [],
        updatedAt: now,
        updatedBy,
      },
      { merge: true }
    );
  }
  await batch.commit();
}
