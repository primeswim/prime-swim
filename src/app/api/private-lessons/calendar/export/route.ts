// API for exporting private lesson bookings to iCal format
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import type { Query } from "firebase-admin/firestore";

// GET: Export bookings to iCal format
export async function GET(req: Request) {
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
    const range = searchParams.get("range") || "all"; // "all", "30days", "90days", or "custom"
    const startDate = searchParams.get("startDate"); // For custom range
    const endDate = searchParams.get("endDate"); // For custom range
    const includeCancelled = searchParams.get("includeCancelled") === "true";
    const swimmerName = searchParams.get("swimmerName"); // For swimmer-specific export

    // Build query
    let query: Query = adminDb.collection("privateLessonBookings");
    
    // Filter by swimmer name if specified
    if (swimmerName) {
      query = query.where("swimmerName", "==", swimmerName);
    }
    
    // Filter by status
    if (!includeCancelled) {
      query = query.where("status", "==", "confirmed");
    }
    
    // Note: When swimmerName is specified, we'll fetch all and filter by date in memory
    // to avoid Firestore composite query limitations

    // Filter by date range
    const now = new Date();
    const dateFilter: { start?: Date; end?: Date } = {};

    if (range === "30days") {
      dateFilter.start = now;
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      dateFilter.end = end;
    } else if (range === "90days") {
      dateFilter.start = now;
      const end = new Date(now);
      end.setDate(end.getDate() + 90);
      dateFilter.end = end;
    } else if (range === "custom" && startDate && endDate) {
      // Parse dates - input is in YYYY-MM-DD format from HTML date input
      // Parse manually to avoid timezone issues
      const parseDateString = (dateStr: string): { year: number; month: number; day: number } => {
        // Handle YYYY-MM-DD format
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10) - 1, // Month is 0-indexed
            day: parseInt(parts[2], 10),
          };
        }
        // Fallback to Date parsing
        const d = new Date(dateStr);
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth(),
          day: d.getUTCDate(),
        };
      };
      
      const startParts = parseDateString(startDate);
      const endParts = parseDateString(endDate);
      
      // Create date range: start of day (00:00:00 UTC) to end of day (23:59:59 UTC)
      dateFilter.start = new Date(Date.UTC(startParts.year, startParts.month, startParts.day, 0, 0, 0, 0));
      dateFilter.end = new Date(Date.UTC(endParts.year, endParts.month, endParts.day, 23, 59, 59, 999));
      
      console.log("Custom date range:", {
        inputStart: startDate,
        inputEnd: endDate,
        parsedStart: dateFilter.start.toISOString(),
        parsedEnd: dateFilter.end.toISOString(),
        startParts,
        endParts,
      });
    }

    // Get bookings - if date filter is specified, try to use Firestore query
    // Otherwise, get all and filter in memory (more reliable for date comparisons)
    let snapshot;
    
    // When swimmerName is specified or custom range, fetch filtered data and filter in memory
    // to avoid timezone issues and composite query limitations
    if (swimmerName || range === "custom") {
      // Use the query that already has swimmerName and status filters applied
      try {
        snapshot = await query.get();
        console.log("Fetched bookings with filters:", {
          swimmerName,
          statusFilter: !includeCancelled ? "confirmed" : "all",
          totalFetched: snapshot.docs.length,
        });
      } catch (e) {
        console.error("Failed to fetch bookings:", e);
        return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
      }
    } else {
      // For predefined ranges without swimmer filter, try Firestore query first
      try {
        if (dateFilter.start) {
          query = query.where("startTime", ">=", Timestamp.fromDate(dateFilter.start));
        }
        if (dateFilter.end) {
          query = query.where("startTime", "<=", Timestamp.fromDate(dateFilter.end));
        }
        snapshot = await query.orderBy("startTime", "asc").get();
      } catch (e) {
        // If orderBy fails or composite query fails, get all and filter in memory
        console.warn("Query failed, fetching all and filtering:", e);
        snapshot = await query.get();
      }
    }

    const bookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
        endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
      };
    });

    // Filter by date range in memory if needed
    let filteredBookings = bookings;
    
    // Filter by swimmer name in memory if specified (as a safety check)
    if (swimmerName) {
      filteredBookings = filteredBookings.filter((booking) => {
        const bookingSwimmerName = (booking as { swimmerName?: string }).swimmerName;
        const matches = bookingSwimmerName === swimmerName;
        if (!matches) {
          console.log("Filtered out booking:", {
            bookingSwimmerName,
            expectedSwimmerName: swimmerName,
          });
        }
        return matches;
      });
      console.log("After swimmer name filter:", {
        swimmerName,
        totalBookings: filteredBookings.length,
      });
    }
    
    // Always filter by status first if needed (if not already filtered by query)
    if (!includeCancelled) {
      filteredBookings = filteredBookings.filter((booking) => {
        const status = (booking as { status?: string }).status;
        return status === "confirmed";
      });
    }
    
    // Then filter by date range if specified
    if (dateFilter.start || dateFilter.end) {
      console.log("Filtering bookings by date range:", {
        filterStart: dateFilter.start?.toISOString(),
        filterEnd: dateFilter.end?.toISOString(),
        totalBookings: filteredBookings.length,
      });
      
      filteredBookings = filteredBookings.filter((booking) => {
        const startTime = (booking as { startTime?: Date | string }).startTime;
        if (!startTime) return false;
        
        // Parse booking start time
        let start: Date;
        if (startTime instanceof Date) {
          start = startTime;
        } else if (typeof startTime === "string") {
          start = new Date(startTime);
        } else {
          return false;
        }
        
        // Compare dates (not times) - use UTC date components for consistent comparison
        // This ensures we're comparing the actual calendar dates regardless of timezone
        const startYear = start.getUTCFullYear();
        const startMonth = start.getUTCMonth();
        const startDay = start.getUTCDate();
        
        let matches = true;
        
        if (dateFilter.start) {
          const filterYear = dateFilter.start.getUTCFullYear();
          const filterMonth = dateFilter.start.getUTCMonth();
          const filterDay = dateFilter.start.getUTCDate();
          
          // Compare year, month, day
          if (startYear < filterYear) matches = false;
          else if (startYear === filterYear && startMonth < filterMonth) matches = false;
          else if (startYear === filterYear && startMonth === filterMonth && startDay < filterDay) matches = false;
        }
        
        if (matches && dateFilter.end) {
          const filterYear = dateFilter.end.getUTCFullYear();
          const filterMonth = dateFilter.end.getUTCMonth();
          const filterDay = dateFilter.end.getUTCDate();
          
          // Compare year, month, day
          if (startYear > filterYear) matches = false;
          else if (startYear === filterYear && startMonth > filterMonth) matches = false;
          else if (startYear === filterYear && startMonth === filterMonth && startDay > filterDay) matches = false;
        }
        
        if (matches) {
          console.log("Booking matches filter:", {
            bookingStart: start.toISOString(),
            bookingDate: `${startYear}-${String(startMonth + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
            swimmerName: (booking as { swimmerName?: string }).swimmerName,
          });
        }
        
        return matches;
      });
      
      console.log("Filtered bookings count:", filteredBookings.length);
    }

    // Generate iCal content
    const icalContent = generateICal(filteredBookings);

    // Generate filename with date range if custom, or swimmer name if specified
    let filename = `prime-swim-private-lessons-${range}`;
    if (swimmerName) {
      // Use swimmer name in filename
      const safeName = swimmerName.replace(/[^a-zA-Z0-9]/g, "-");
      filename = `prime-swim-pl-${safeName}`;
    } else if (range === "custom" && startDate && endDate) {
      // Use the selected dates in the filename (not current date)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      filename = `prime-swim-private-lessons-${startStr}-to-${endStr}`;
    } else {
      // For other ranges, use current date
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      filename = `prime-swim-private-lessons-${range}-${dateStr}`;
    }

    // Return as .ics file
    return new NextResponse(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.ics"`,
      },
    });
  } catch (e) {
    console.error("Export calendar error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function getLocationName(locationId: number): string {
  const locations: Record<number, string> = {
    1: "Bellevue Aquatic Center",
    2: "Redmond Pool",
    3: "Mary Wayte Swimming Pool",
  };
  return locations[locationId] || "Location";
}

function formatDateForICal(date: Date): string {
  // iCal format: YYYYMMDDTHHMMSSZ
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICalText(text: string): string {
  // iCal requires specific escaping
  // \n should remain as \n for line breaks in DESCRIPTION
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\n") // Normalize line breaks
    .replace(/\r/g, "\n");
}

interface BookingForExport {
  id: string;
  startTime?: Date | string;
  endTime?: Date | string;
  locationId?: number;
  swimmerName?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  notes?: string;
  status?: string;
}

function generateICal(bookings: BookingForExport[]): string {
  const now = new Date();
  const lines: string[] = [];

  // iCal header
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Prime Swim Academy//Private Lessons//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  // Add each booking as an event
  bookings.forEach((booking) => {
    if (!booking.startTime || !booking.endTime) return;

    const start = booking.startTime instanceof Date ? booking.startTime : new Date(booking.startTime);
    const end = booking.endTime instanceof Date ? booking.endTime : new Date(booking.endTime);
    const locationName = getLocationName(booking.locationId || 0);
    const swimmerName = booking.swimmerName || "Unknown";
    const parentEmail = booking.parentEmail || "";
    const parentPhone = booking.parentPhone || "";
    const notes = booking.notes || "";

    // Build description with proper line breaks
    const description = [
      `Swimmer: ${swimmerName}`,
      parentEmail ? `Email: ${parentEmail}` : "",
      parentPhone ? `Phone: ${parentPhone}` : "",
      notes ? `Notes: ${notes}` : "",
      "",
      "Cancellation Policy: Please notify us at least 7 days (14 days for Mary Wayte) before the lesson for reschedule or credit.",
    ]
      .filter(Boolean)
      .join("\n");

    // Event
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${booking.id}@primeswimacademy.com`);
    lines.push(`DTSTAMP:${formatDateForICal(now)}`);
    lines.push(`DTSTART:${formatDateForICal(start)}`);
    lines.push(`DTEND:${formatDateForICal(end)}`);
    lines.push(`SUMMARY:Prime Swim - ${escapeICalText(swimmerName)}`);
    
    // DESCRIPTION needs special handling for line breaks
    // In iCal format, line breaks in DESCRIPTION should use \n (escaped)
    // Escape special characters but preserve \n for line breaks
    const escapedDescription = description
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n"); // Convert actual newlines to \n string
    
    // Format DESCRIPTION with proper iCal line folding (max 75 chars per line)
    const foldLine = (text: string, prefix: string, maxLen: number): string[] => {
      const result: string[] = [];
      let remaining = text;
      while (remaining.length > 0) {
        const chunk = remaining.substring(0, maxLen);
        result.push(prefix + chunk);
        remaining = remaining.substring(maxLen);
        prefix = " "; // Continuation lines start with space
        maxLen = 74; // 75 - 1 for leading space
      }
      return result;
    };
    
    const descriptionLines = foldLine(escapedDescription, "DESCRIPTION:", 63); // 75 - 12 for "DESCRIPTION:"
    descriptionLines.forEach((line) => {
      lines.push(line);
    });
    
    lines.push(`LOCATION:${escapeICalText(locationName)}`);
    lines.push(`STATUS:${booking.status === "confirmed" ? "CONFIRMED" : "CANCELLED"}`);
    
    // Add reminder (1 hour before)
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT1H");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:Reminder: Prime Swim - ${escapeICalText(swimmerName)}`);
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  });

  // iCal footer
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

