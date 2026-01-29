// API for sending private lesson reminders
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// POST: Send reminder for a specific booking
export async function POST(req: Request) {
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
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const bookingDoc = await adminDb.collection("privateLessonBookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingDoc.data();
    if (booking?.status !== "confirmed") {
      return NextResponse.json({ error: "Booking is not confirmed" }, { status: 400 });
    }

    // Send reminder email
    const coachName = getCoachName(booking.coachId || 0);
    const locationName = getLocationName(booking.locationId || 0);
    const startDate = booking.startTime?.toDate() || new Date();
    const endDate = booking.endTime?.toDate() || new Date();

    const emailHtml = buildReminderEmail({
      swimmerName: booking.swimmerName || "",
      parentName: booking.parentName || "Parent",
      coachName,
      locationName,
      startDate,
      endDate,
    });

    await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: booking.parentEmail || "",
      subject: `Reminder: Private Lesson Tomorrow - ${booking.swimmerName}`,
      html: emailHtml,
    });

    // Update booking to mark reminder as sent
    await adminDb.collection("privateLessonBookings").doc(bookingId).update({
      reminderSent: true,
      reminderSentAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true, message: "Reminder sent" });
  } catch (e) {
    console.error("Send reminder error:", e);
    const errorMessage = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET: Auto-send reminders (called by cron job)
export async function GET(req: Request) {
  try {
    // This endpoint can be called by Vercel cron without auth, or with admin auth
    const authz = req.headers.get("authorization") || "";
    const isCron = req.headers.get("x-vercel-cron") === "1";
    
    if (!isCron && authz) {
      const m = /^Bearer\s+(.+)$/.exec(authz);
      if (m) {
        const decoded = await getAuth().verifyIdToken(m[1]);
        const email = (decoded.email || "").toLowerCase();
        const adminDoc = await adminDb.collection("admin").doc(email).get();
        if (!adminDoc.exists) {
          return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }
      }
    }

    // Find bookings that need reminders (24 hours before lesson)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = Timestamp.fromDate(tomorrow);
    const tomorrowEndTs = Timestamp.fromDate(tomorrowEnd);

    const bookingsSnapshot = await adminDb
      .collection("privateLessonBookings")
      .where("status", "==", "confirmed")
      .where("startTime", ">=", tomorrowStart)
      .where("startTime", "<=", tomorrowEndTs)
      .where("reminderSent", "==", false)
      .get();

    const results = await Promise.allSettled(
      bookingsSnapshot.docs.map(async (doc) => {
        const booking = doc.data();
        const coachName = getCoachName(booking.coachId || 0);
        const locationName = getLocationName(booking.locationId || 0);
        const startDate = booking.startTime?.toDate() || new Date();
        const endDate = booking.endTime?.toDate() || new Date();

        const emailHtml = buildReminderEmail({
          swimmerName: booking.swimmerName || "",
          parentName: booking.parentName || "Parent",
          coachName,
          locationName,
          startDate,
          endDate,
        });

        await resend.emails.send({
          from: "Prime Swim Academy <noreply@primeswimacademy.com>",
          to: booking.parentEmail || "",
          subject: `Reminder: Private Lesson Tomorrow - ${booking.swimmerName}`,
          html: emailHtml,
        });

        await adminDb.collection("privateLessonBookings").doc(doc.id).update({
          reminderSent: true,
          reminderSentAt: Timestamp.now(),
        });

        return { bookingId: doc.id, swimmerName: booking.swimmerName, success: true };
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: bookingsSnapshot.docs.length,
    });
  } catch (e) {
    console.error("Auto-send reminders error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function getCoachName(coachId: number): string {
  const coaches: Record<number, string> = {
    1: "Coach Lara",
    2: "Coach Moe",
    3: "Coach Emma",
  };
  return coaches[coachId] || "Coach";
}

function getLocationName(locationId: number): string {
  const locations: Record<number, string> = {
    1: "Bellevue Aquatic Center",
    2: "Redmond Pool",
    3: "Mary Wayte Swimming Pool",
  };
  return locations[locationId] || "Location";
}

function buildReminderEmail(params: {
  swimmerName: string;
  parentName: string;
  coachName: string;
  locationName: string;
  startDate: Date;
  endDate: Date;
}): string {
  const { swimmerName, parentName, coachName, locationName, startDate, endDate } = params;
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
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Reminder: Private Lesson Tomorrow</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Dear ${parentName},</p>
        <p style="font-size: 16px; margin-bottom: 20px;">
          This is a friendly reminder that <strong>${swimmerName}</strong> has a private lesson scheduled for tomorrow.
        </p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h2 style="margin-top: 0; color: #059669; font-size: 20px;">Lesson Details</h2>
          <p style="margin: 10px 0;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 10px 0;"><strong>Time:</strong> ${timeStr}</p>
          <p style="margin: 10px 0;"><strong>Coach:</strong> ${coachName}</p>
          <p style="margin: 10px 0;"><strong>Location:</strong> ${locationName}</p>
        </div>
        <p style="font-size: 16px; margin-top: 20px;">
          Please arrive 5-10 minutes early. If you need to cancel or reschedule, please contact us as soon as possible.
        </p>
        <p style="font-size: 16px; margin-top: 20px;">
          We look forward to seeing you tomorrow!
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


