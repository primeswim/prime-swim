import type { DocumentReference, Firestore } from "firebase-admin/firestore";

/** Firestore rejects undefined field values. */
export function withoutUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const MAX_BATCH_OPS = 450;

type BatchWrite =
  | { type: "set"; ref: DocumentReference; data: Record<string, unknown>; merge?: boolean }
  | { type: "update"; ref: DocumentReference; data: Record<string, unknown> }
  | { type: "delete"; ref: DocumentReference };

export async function commitWrites(db: Firestore, writes: BatchWrite[]): Promise<void> {
  for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + MAX_BATCH_OPS);
    for (const w of chunk) {
      if (w.type === "set") {
        if (w.merge) {
          batch.set(w.ref, withoutUndefined(w.data), { merge: true });
        } else {
          batch.set(w.ref, withoutUndefined(w.data));
        }
      } else if (w.type === "update") {
        batch.update(w.ref, w.data);
      } else {
        batch.delete(w.ref);
      }
    }
    await batch.commit();
  }
}
