/**
 * Sibling linking and tuition discount helpers.
 */

export const SIBLING_TUITION_DISCOUNT_PERCENT = 10;

export function normalizeSiblingIds(ids: unknown, selfId: string): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = [
    ...new Set(
      ids.filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0 && id !== selfId
      )
    ),
  ];
  return unique.sort();
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

/** Earlier enrollment = earlier registrationAnchorDate, else createdAt. */
export function getSwimmerEnrollmentMillis(data: Record<string, unknown>): number {
  return (
    toMillis(data.registrationAnchorDate) ??
    toMillis(data.createdAt) ??
    Number.MAX_SAFE_INTEGER
  );
}

export type SiblingDiscountMeta = {
  baseTuition: number;
  siblingDiscountPercent?: number;
  siblingDiscountApplied?: boolean;
};

export function applySiblingTuitionDiscounts<
  T extends { swimmerId: string; tuition: number }
>(
  rows: T[],
  enrollmentById: Map<string, number>,
  siblingIdsBySwimmer: Map<string, string[]>
): Array<T & SiblingDiscountMeta> {
  const rowIds = new Set(rows.map((r) => r.swimmerId));
  const adjacency = new Map<string, Set<string>>();

  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (const [swimmerId, siblingIds] of siblingIdsBySwimmer) {
    if (!rowIds.has(swimmerId)) continue;
    for (const siblingId of siblingIds) {
      if (rowIds.has(siblingId)) addEdge(swimmerId, siblingId);
    }
  }

  const visited = new Set<string>();
  const discountIds = new Set<string>();

  for (const startId of rowIds) {
    if (visited.has(startId)) continue;
    if (!adjacency.has(startId)) {
      visited.add(startId);
      continue;
    }

    const component: string[] = [];
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    if (component.length < 2) continue;

    const sorted = [...component].sort((a, b) => {
      const ta = enrollmentById.get(a) ?? Number.MAX_SAFE_INTEGER;
      const tb = enrollmentById.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    });

    for (let i = 1; i < sorted.length; i += 1) {
      discountIds.add(sorted[i]);
    }
  }

  return rows.map((row) => {
    if (!discountIds.has(row.swimmerId)) {
      return { ...row, baseTuition: row.tuition };
    }
    const discounted = Math.round(
      row.tuition * (1 - SIBLING_TUITION_DISCOUNT_PERCENT / 100)
    );
    return {
      ...row,
      baseTuition: row.tuition,
      tuition: discounted,
      siblingDiscountPercent: SIBLING_TUITION_DISCOUNT_PERCENT,
      siblingDiscountApplied: true,
    };
  });
}
