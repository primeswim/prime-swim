export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { runTuitionCalculate } from "@/lib/tuition-calculate";
import {
  normalizeClientCalculateRows,
  upsertBillingRowsFromCalculate,
} from "@/lib/tuition-billing-prepare";
import {
  applyTuitionOverridesMap,
  loadMonthTuitionOverrides,
  mergeMonthTuitionOverrides,
  normalizeTuitionOverridesMap,
} from "@/lib/tuition-month-overrides";

async function requireAdmin(req: Request): Promise<void> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
}

/** POST — create/update billing rows from calculator or saved preview rows */
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as {
      month?: string;
      overwriteUnpaidComputed?: boolean;
      levels?: string[];
      /** When set, use these rows (e.g. from Calculate Tuition preview with manual edits) instead of re-running the calculator */
      rows?: unknown;
      /** Compact manual tuition overrides (merged into month config) */
      tuitionOverrides?: unknown;
      clearTuitionOverrideIds?: string[];
      /** Last calculated baseline tuition per swimmer (for extracting overrides from full rows) */
      tuitionBaseline?: Record<string, number>;
    };
    const month = body.month?.trim();
    const overwriteUnpaidComputed = Boolean(body.overwriteUnpaidComputed);
    const levels = Array.isArray(body.levels)
      ? body.levels.map((l) => String(l).trim()).filter(Boolean)
      : undefined;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month (YYYY-MM)" }, { status: 400 });
    }

    const clientRows = normalizeClientCalculateRows(body.rows);
    let source: "preview" | "calculator" | "calculator_with_overrides";

    let results: Awaited<ReturnType<typeof runTuitionCalculate>>["results"];
    if (clientRows.length > 0) {
      results = clientRows;
      source = "preview";
      const explicitOverrides = normalizeTuitionOverridesMap(body.tuitionOverrides);
      const clearIds = body.clearTuitionOverrideIds ?? [];
      if (Object.keys(explicitOverrides).length > 0 || clearIds.length > 0) {
        await mergeMonthTuitionOverrides(adminDb, month, explicitOverrides, clearIds);
      }
    } else {
      const calculated = (await runTuitionCalculate(adminDb, month, { levels })).results;
      const overrides = await loadMonthTuitionOverrides(adminDb, month);
      results = applyTuitionOverridesMap(calculated, overrides);
      source = Object.keys(overrides).length > 0 ? "calculator_with_overrides" : "calculator";
    }

    const counts = await upsertBillingRowsFromCalculate(adminDb, month, results, {
      overwriteUnpaidComputed,
    });

    return NextResponse.json({
      ok: true,
      month,
      source,
      counts: {
        created: counts.created,
        updated: counts.updated,
        skipped: counts.skipped,
        totalCalculateRows: counts.totalRows,
      },
    });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition billing prepare:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
