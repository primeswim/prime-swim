// API for bulk deleting slots before a certain date
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// DELETE: Delete all slots before a certain date
export async function DELETE(req: Request) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const beforeDate = searchParams.get("beforeDate");

    if (!beforeDate) {
      return NextResponse.json({ error: "Missing beforeDate parameter" }, { status: 400 });
    }

    const cutoffDate = new Date(beforeDate);
    cutoffDate.setHours(0, 0, 0, 0); // Start of the day
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    let deletedCount = 0;
    let batchCount = 0;

    // Delete in batches (Firestore batch limit is 500)
    while (true) {
      const snapshot = await adminDb
        .collection("availableSlots")
        .where("startTime", "<", cutoffTimestamp)
        .limit(500)
        .get();

      if (snapshot.empty) break;

      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      deletedCount += snapshot.size;
      batchCount++;

      // If we got less than 500, we're done
      if (snapshot.size < 500) break;
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount,
      batchCount,
      beforeDate: cutoffDate.toISOString().split("T")[0],
    });
  } catch (e) {
    console.error("Bulk delete slots error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

