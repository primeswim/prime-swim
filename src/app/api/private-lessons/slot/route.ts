// API for updating slot details (admin notes, etc.)
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

// PUT: Update slot (e.g., admin notes)
export async function PUT(req: Request) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();
    const { slotId, adminNotes } = body;

    if (!slotId) {
      return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    }

    const slotRef = adminDb.collection("availableSlots").doc(slotId);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes || null;
    }

    await slotRef.update(updateData);

    return NextResponse.json({ success: true, slotId, ...updateData });
  } catch (e) {
    console.error("Update slot error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

