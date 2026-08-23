export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

const SETTINGS_DOC = "settings/privateLessons";

async function requireAdmin(req: Request): Promise<{ email: string }> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
  return { email };
}

export async function GET() {
  try {
    const snap = await adminDb.doc(SETTINGS_DOC).get();
    const data = snap.data() || {};
    return NextResponse.json({
      ok: true,
      slotsHidden: data.slotsHidden === true,
    });
  } catch (e) {
    console.error("GET private-lessons settings error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { email } = await requireAdmin(req);
    const body = (await req.json()) as { slotsHidden?: boolean };
    if (typeof body.slotsHidden !== "boolean") {
      return NextResponse.json({ ok: false, error: "slotsHidden must be a boolean" }, { status: 400 });
    }

    await adminDb.doc(SETTINGS_DOC).set(
      {
        slotsHidden: body.slotsHidden,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: email,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, slotsHidden: body.slotsHidden });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
