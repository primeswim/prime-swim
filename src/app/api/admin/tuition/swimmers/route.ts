export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

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

/** GET: list swimmers that have a level (group assignment), for editing training weekdays etc. */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const snap = await adminDb.collection("swimmers").get();
    const list: {
      id: string;
      swimmerName: string;
      level: string;
      trainingWeekdays: number[];
      trainingTimeSlot: string | null;
      trainingLocation: string | null;
      ratePerHourOverride: number | null;
    }[] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const level = (data.level && String(data.level).trim()) || "";
      if (!level || data.isFrozen) continue;
      const swimmerName = [data.childFirstName, data.childLastName].filter(Boolean).join(" ").trim() || doc.id;
      const trainingWeekdays = Array.isArray(data.trainingWeekdays)
        ? data.trainingWeekdays.filter((n) => typeof n === "number" && n >= 0 && n <= 6)
        : [];
      list.push({
        id: doc.id,
        swimmerName,
        level,
        trainingWeekdays,
        trainingTimeSlot: data.trainingTimeSlot && String(data.trainingTimeSlot).trim() ? String(data.trainingTimeSlot).trim() : null,
        trainingLocation: data.trainingLocation && String(data.trainingLocation).trim() ? String(data.trainingLocation).trim() : null,
        ratePerHourOverride: typeof data.ratePerHourOverride === "number" ? data.ratePerHourOverride : null,
      });
    }
    list.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
    return NextResponse.json({ swimmers: list });
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 403 });
    }
    console.error("tuition swimmers GET:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
