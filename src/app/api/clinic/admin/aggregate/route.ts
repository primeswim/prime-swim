// app/api/clinic/admin/aggregate/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { SwimmerLevel } from "@/lib/swimmer-levels";

interface Submission {
  parentEmail: string;
  parentPhone?: string;
  swimmerName: string;
  level: SwimmerLevel | string; // Support both new and old levels for backward compatibility
  preferences: { location: string; selections: string[] }[];
  season?: string;
  submittedAt?: unknown;
}

function extractDateKey(label: string): string {
  const m = label.match(/([A-Za-z]{3}\s+\d{1,2})/);
  return m ? m[1] : label;
}

export async function GET(req: Request) {
  try {
    // --- AuthZ ---
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    // --- Filter by season (optional) ---
    const { searchParams } = new URL(req.url);
    const season = searchParams.get("season") || undefined;

    const snap = season
      ? await adminDb.collection("clinicSubmissions").where("season", "==", season).get()
      : await adminDb.collection("clinicSubmissions").get();

    const submissions = snap.docs.map((d) => d.data() as Submission);

    // --- Aggregate ---
    const rowsMap = new Map<
      string,
      {
        location: string;
        label: string;
        dateKey: string;
        swimmers: {
          key: string;
          swimmerName: string;
          parentEmail: string;
          parentPhone: string; // ✅ 返回电话
          level: SwimmerLevel | string;
        }[];
      }
    >();
    const byLevel: Record<string, number> = {};
    const seen = new Set<string>();

    for (const s of submissions) {
      const lvl = s.level || "Unknown";
      byLevel[lvl] = (byLevel[lvl] || 0) + 1;

      for (const pref of s.preferences || []) {
        for (const label of pref.selections || []) {
          const key = `${pref.location}__${label}`;
          const dateKey = extractDateKey(label);
          const ukey = `${(s.season || "").toLowerCase()}__${s.parentEmail.toLowerCase()}__${s.swimmerName.toLowerCase()}`;
          if (!rowsMap.has(key)) {
            rowsMap.set(key, { location: pref.location, label, dateKey, swimmers: [] });
          }
          const row = rowsMap.get(key)!;
          if (!row.swimmers.find((x) => x.key === ukey)) {
            row.swimmers.push({
              key: ukey,
              swimmerName: s.swimmerName,
              parentEmail: s.parentEmail,
              parentPhone: (s.parentPhone || "").toString(), // ✅
              level: s.level,
            });
          }
          seen.add(ukey);
        }
      }
    }

    const rows = Array.from(rowsMap.values()).sort(
      (a, b) => a.location.localeCompare(b.location) || a.label.localeCompare(b.label)
    );

    return NextResponse.json({
      rows,
      byLevel,
      uniqueSwimmers: seen.size,
      season: season || null,
    });
  } catch (e) {
    console.error("aggregate error:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
