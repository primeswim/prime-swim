// API for private lesson bookings
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import type { Query } from "firebase-admin/firestore";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Booking {
  id?: string;
  slotId: string;
  swimmerId: string; // Reference to privatelessonstudents
  swimmerName: string;
  parentEmail: string;
  parentName?: string;
  parentPhone?: string;
  coachId: number;
  locationId: number;
  startTime: Timestamp;
  endTime: Timestamp;
  status: "confirmed" | "cancelled";
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reminderSent?: boolean;
  reminderSentAt?: Timestamp;
}

// GET: Fetch bookings
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get("slotId");
    const swimmerId = searchParams.get("swimmerId");
    const status = searchParams.get("status");

    let query: Query = adminDb.collection("privateLessonBookings");

    if (slotId) {
      query = query.where("slotId", "==", slotId);
    }
    if (swimmerId) {
      query = query.where("swimmerId", "==", swimmerId);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    // Only use orderBy if we have an index, otherwise just get the results
    let snapshot;
    try {
      snapshot = await query.orderBy("startTime", "desc").get();
    } catch (e) {
      // If orderBy fails (no index), just get without ordering
      console.warn("orderBy failed, fetching without order:", e);
      snapshot = await query.get();
    }
    const bookings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ bookings });
  } catch (e) {
    console.error("Get bookings error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create booking
export async function POST(req: Request) {
  try {
    // Auth check
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();
    const { slotId, swimmerId, notes } = body;

    if (!slotId || !swimmerId) {
      return NextResponse.json({ error: "Missing slotId or swimmerId" }, { status: 400 });
    }

    // Fetch slot details
    const slotDoc = await adminDb.collection("availableSlots").doc(slotId).get();
    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    const slotData = slotDoc.data();

    // Fetch swimmer details
    const swimmerDoc = await adminDb.collection("privatelessonstudents").doc(swimmerId).get();
    if (!swimmerDoc.exists) {
      return NextResponse.json({ error: "Swimmer not found" }, { status: 404 });
    }
    const swimmerData = swimmerDoc.data();

    const swimmerName = `${swimmerData?.firstName || ""} ${swimmerData?.lastName || ""}`.trim();
    const parentEmail = swimmerData?.email || "";
    const parentName = swimmerData?.firstName || "";
    const parentPhone = swimmerData?.phone || "";

    if (!parentEmail) {
      return NextResponse.json({ error: "Swimmer has no email" }, { status: 400 });
    }

    // Check if booking already exists for this slot
    const existingBooking = await adminDb
      .collection("privateLessonBookings")
      .where("slotId", "==", slotId)
      .where("status", "==", "confirmed")
      .limit(1)
      .get();

    if (!existingBooking.empty) {
      return NextResponse.json({ error: "Slot already booked" }, { status: 409 });
    }

    // Create booking
    const bookingData: Booking = {
      slotId,
      swimmerId,
      swimmerName,
      parentEmail,
      parentName,
      parentPhone,
      coachId: slotData?.coachId || 0,
      locationId: slotData?.locationId || 0,
      startTime: slotData?.startTime || Timestamp.now(),
      endTime: slotData?.endTime || Timestamp.now(),
      status: "confirmed",
      notes: notes || "",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      reminderSent: false,
    };

    const bookingRef = await adminDb.collection("privateLessonBookings").add(bookingData);

    // Update slot status
    await adminDb.collection("availableSlots").doc(slotId).update({
      status: "taken",
      bookingId: bookingRef.id,
      bookedBySwimmerId: swimmerId,
      bookedBySwimmerName: swimmerName,
    });

    // Send confirmation email
    try {
      const locationName = getLocationName(slotData?.locationId || 0);
      const startDate = slotData?.startTime?.toDate() || new Date();
      const endDate = slotData?.endTime?.toDate() || new Date();

      const emailHtml = buildConfirmationEmail({
        swimmerName,
        parentName: parentName || "Parent",
        locationName,
        startDate,
        endDate,
        notes: notes || "",
      });

      await resend.emails.send({
        from: "Prime Swim Academy <noreply@primeswimacademy.com>",
        to: parentEmail,
        subject: `Private Lesson Confirmed - ${swimmerName}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({ id: bookingRef.id, ...bookingData });
  } catch (e) {
    console.error("Create booking error:", e);
    const errorMessage = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PUT: Update booking (e.g., cancel)
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
    const { id, status, notes, swimmerId } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
    }

    const bookingRef = adminDb.collection("privateLessonBookings").doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (status) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (swimmerId) {
      // Fetch new swimmer details
      const swimmerDoc = await adminDb.collection("privatelessonstudents").doc(swimmerId).get();
      if (swimmerDoc.exists) {
        const swimmerData = swimmerDoc.data();
        const swimmerName = `${swimmerData?.firstName || ""} ${swimmerData?.lastName || ""}`.trim();
        const parentEmail = swimmerData?.email || "";
        const parentName = swimmerData?.firstName || "";
        
        updateData.swimmerId = swimmerId;
        updateData.swimmerName = swimmerName;
        updateData.parentEmail = parentEmail;
        updateData.parentName = parentName;
        updateData.parentPhone = swimmerData?.phone || "";

        // Update slot with new swimmer info
        const bookingData = bookingDoc.data();
        const slotDoc = await adminDb.collection("availableSlots").doc(bookingData?.slotId).get();
        const slotData = slotDoc.data();
        
        await adminDb.collection("availableSlots").doc(bookingData?.slotId).update({
          bookedBySwimmerId: swimmerId,
          bookedBySwimmerName: swimmerName,
        });

        // Send confirmation email to new swimmer's parent if email exists
        if (parentEmail) {
          try {
            const locationName = getLocationName(slotData?.locationId || 0);
            const startDate = slotData?.startTime?.toDate() || new Date();
            const endDate = slotData?.endTime?.toDate() || new Date();

            const emailHtml = buildConfirmationEmail({
              swimmerName,
              parentName: parentName || "Parent",
              locationName,
              startDate,
              endDate,
              notes: notes || "",
            });

            await resend.emails.send({
              from: "Prime Swim Academy <noreply@primeswimacademy.com>",
              to: parentEmail,
              subject: `Private Lesson Confirmed - ${swimmerName}`,
              html: emailHtml,
            });
          } catch (emailError) {
            console.error("Failed to send confirmation email to new swimmer:", emailError);
            // Don't fail the update if email fails
          }
        }
      }
    }

    await bookingRef.update(updateData);

    // If cancelled, make slot available again
    if (status === "cancelled") {
      const bookingData = bookingDoc.data();
      await adminDb.collection("availableSlots").doc(bookingData?.slotId).update({
        status: "available",
        bookingId: null,
      });
    }

    return NextResponse.json({ id, ...updateData });
  } catch (e) {
    console.error("Update booking error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Helper functions
function getLocationName(locationId: number): string {
  const locations: Record<number, string> = {
    1: "Bellevue Aquatic Center",
    2: "Redmond Pool",
    3: "Mary Wayte Swimming Pool",
  };
  return locations[locationId] || "Location";
}

function buildConfirmationEmail(params: {
  swimmerName: string;
  parentName: string;
  locationName: string;
  startDate: Date;
  endDate: Date;
  notes: string;
}): string {
  const { swimmerName, parentName, locationName, startDate, endDate, notes } = params;
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = `${startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Private Lesson Confirmed</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Dear ${parentName},</p>
        <p style="font-size: 16px; margin-bottom: 20px;">
          We're excited to confirm your private lesson booking for <strong>${swimmerName}</strong>!
        </p>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #1e40af; font-size: 20px;">Lesson Details</h2>
          <p style="margin: 10px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 10px 0;"><strong>Time:</strong> ${timeStr}</p>
          <p style="margin: 10px 0;"><strong>Location:</strong> ${locationName}</p>
          ${notes ? `<p style="margin: 10px 0;"><strong>Notes:</strong> ${notes}</p>` : ""}
        </div>
        <p style="font-size: 16px; margin-top: 20px;">
          Please arrive 5-10 minutes early. If you have any questions or need to reschedule, please contact us as soon as possible.
        </p>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #92400e; font-size: 18px; font-weight: 700;">📋 Cancellation Policy</h3>
          <p style="margin: 10px 0; color: #78350f; font-size: 15px; line-height: 1.6;">
            To be eligible for reschedule or credit, please notify us at least <strong style='color: #dc2626;'>${locationName === "Mary Wayte Swimming Pool" ? "14 days" : "7 days"}</strong> before your scheduled lesson. This advance notice helps us manage our schedule and accommodate other families.
          </p>
          ${locationName === "Mary Wayte Swimming Pool" ? 
            "<p style='margin: 10px 0; color: #78350f; font-size: 15px; line-height: 1.6;'>For lessons at <strong>Mary Wayte Swimming Pool</strong>, we require <strong style='color: #dc2626;'>14 days</strong> advance notice due to the facility's scheduling constraints.</p>" : 
            ""
          }
          <p style="margin: 10px 0; color: #78350f; font-size: 15px; line-height: 1.6;">
            Cancellations made after the deadline will be considered a forfeiture of the session without refund or makeup. We understand that unexpected situations arise, and in cases of documented <strong>medical emergencies</strong>, we may make exceptions at our discretion. Please note that even in approved medical-emergency cases, families remain responsible for the lane rental fee incurred for the scheduled session.
          </p>
        </div>
        
        <p style="font-size: 16px; margin-top: 20px;">
          We look forward to seeing you!
        </p>
        <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
          Best regards,<br>
          Prime Swim Academy
        </p>
      </div>
    </body>
    </html>
  `;
}

