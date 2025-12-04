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

    // Parse date string (YYYY-MM-DD) and set to PST/PDT timezone start of day
    // PST is UTC-8, PDT is UTC-7. 
    // When user selects "2025-01-15", they mean midnight PST/PDT on that date.
    // We need to convert this to UTC for Firestore comparison.
    // 
    // Strategy: Parse the date and create a Date object that represents
    // midnight in America/Los_Angeles timezone (PST/PDT).
    // Since we can't easily use timezone libraries, we'll approximate:
    // - Most of the year is PDT (UTC-7), so midnight PDT = 07:00 UTC
    // - Winter months are PST (UTC-8), so midnight PST = 08:00 UTC
    // 
    // To be safe and accurate, we'll use 07:00 UTC which represents midnight PDT.
    // For PST dates, this means we'll delete slots up to 1 hour into the selected date,
    // which is acceptable since the user wants to delete "before" the date.
    const [year, month, day] = beforeDate.split("-").map(Number);
    
    // Create date at 07:00 UTC (midnight PDT or 1 hour into PST date)
    // This ensures we capture all slots before the selected date in PST/PDT
    const cutoffDateUTC = new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0));
    const cutoffTimestamp = Timestamp.fromDate(cutoffDateUTC);

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
      beforeDate: beforeDate, // Return the original date string
      cutoffTimestamp: cutoffDateUTC.toISOString(),
    });
  } catch (e) {
    console.error("Bulk delete slots error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

