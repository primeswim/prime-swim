// API for deleting a slot
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

// DELETE: Delete a slot
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
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "Missing slotId parameter" }, { status: 400 });
    }

    const slotRef = adminDb.collection("availableSlots").doc(slotId);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    const slotData = slotDoc.data();

    // If slot is booked, cancel the booking first
    if (slotData?.status === "taken" && slotData?.bookingId) {
      const bookingRef = adminDb.collection("privateLessonBookings").doc(slotData.bookingId);
      const bookingDoc = await bookingRef.get();
      
      if (bookingDoc.exists) {
        // Update booking status to cancelled
        await bookingRef.update({
          status: "cancelled",
          updatedAt: Timestamp.now(),
        });
      }
    }

    // Delete the slot
    await slotRef.delete();

    return NextResponse.json({ 
      success: true, 
      slotId,
      cancelledBooking: slotData?.status === "taken" && slotData?.bookingId ? true : false,
    });
  } catch (e) {
    console.error("Delete slot error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

