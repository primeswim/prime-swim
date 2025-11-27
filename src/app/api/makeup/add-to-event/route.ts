// src/app/api/makeup/add-to-event/route.ts
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

async function isInAdminsServer(email?: string | null, uid?: string | null) {
  const e = (email || "").trim().toLowerCase();
  const u = uid || undefined;
  const colNames = ["admin", "admins"];

  for (const col of colNames) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get();
      if (byEmail.exists) return true;
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get();
      if (byUid.exists) return true;
    }
  }
  for (const col of colNames) {
    if (e) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get();
      if (!snap.empty) return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(idToken);
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const { makeupId, swimmerIds } = body;

    if (!makeupId || !Array.isArray(swimmerIds) || swimmerIds.length === 0) {
      return NextResponse.json({ ok: false, error: "makeupId and swimmerIds are required" }, { status: 400 });
    }

    // Get event to get the text
    const eventDoc = await adminDb.collection("makeup_events").doc(makeupId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
    }

    const eventData = eventDoc.data() || {};
    const makeupText = eventData.text || "";

    // Update swimmers' nextMakeupId
    const batch = adminDb.batch();
    for (const swimmerId of swimmerIds) {
      const sref = adminDb.collection("swimmers").doc(swimmerId);
      batch.set(
        sref,
        {
          nextMakeupText: makeupText,
          nextMakeupId: makeupId,
        },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({ ok: true, updated: swimmerIds.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Add to event error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

