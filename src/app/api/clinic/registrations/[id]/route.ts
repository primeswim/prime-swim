// app/api/clinic/registrations/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

// 检查是否为 admin
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

// PUT: 更新注册状态
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(idToken);
    const isAdmin = await isInAdminsServer(decoded.email ?? null, decoded.uid);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing registration ID" }, { status: 400 });
    }

    const body = await req.json();
    const { status, adminNotes } = body;

    if (!status || !["pending", "reviewed", "accepted", "rejected"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const registrationRef = adminDb.collection("clinicRegistrations").doc(id);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      return NextResponse.json({ ok: false, error: "Registration not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      status,
    };

    if (adminNotes !== undefined) {
      updateData.adminNotes = String(adminNotes).trim().slice(0, 2000);
    }

    await registrationRef.update(updateData);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PUT clinic registration error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

