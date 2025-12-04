"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";
import Header from "@/components/header";

export default function TestReminderPage() {
  const [loading, setLoading] = useState(false);
  const [loadingEverly, setLoadingEverly] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: {
      total?: number;
      sent?: number;
      failed?: number;
    };
  } | null>(null);

  const sendReminderForEverly = async () => {
    setLoadingEverly(true);
    setResult(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const idToken = await user.getIdToken();

      // First, find Everly Young's booking - try different name variations
      // Try "Everly Young" first, then "Everly" if not found
      const bookingsResponse = await fetch("/api/private-lessons/booking?status=confirmed", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!bookingsResponse.ok) {
        const errorData = await bookingsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch bookings");
      }

      const bookingsData = await bookingsResponse.json();
      const bookings = bookingsData.bookings || [];

      // Filter by swimmer name (try different variations)
      const everlyBookings = bookings.filter((booking: BookingData) => {
        const swimmerName = (booking as { swimmerName?: string }).swimmerName || "";
        return swimmerName.toLowerCase().includes("everly");
      });

      if (everlyBookings.length === 0) {
        throw new Error("No bookings found for Everly. Please check the swimmer name in the booking.");
      }

      // Helper function to parse date from API (now returns ISO string)
      const parseStartTime = (startTime: unknown): Date | null => {
        if (!startTime) return null;
        
        // If it's already a Date
        if (startTime instanceof Date) {
          return startTime;
        }
        
        // If it's an ISO string (from API)
        if (typeof startTime === "string") {
          const date = new Date(startTime);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
        
        // If it's a Firestore Timestamp object with toDate method
        if (typeof startTime === "object" && startTime !== null) {
          const ts = startTime as Record<string, unknown>;
          
          // Try toDate() method
          if (typeof ts.toDate === "function") {
            try {
              return ts.toDate() as Date;
            } catch {
              // Ignore
            }
          }
          
          // Try seconds property (Firestore Timestamp)
          if (typeof ts.seconds === "number" && ts.seconds > 0) {
            return new Date(ts.seconds * 1000);
          }
          
          // Try _seconds property (some Firestore formats)
          if (typeof (ts as { _seconds?: number })._seconds === "number") {
            const secs = (ts as { _seconds: number })._seconds;
            if (secs > 0) {
              return new Date(secs * 1000);
            }
          }
        }
        
        // Try as number (timestamp in milliseconds)
        if (typeof startTime === "number" && startTime > 0) {
          return new Date(startTime);
        }
        
        return null;
      };

      // Find tomorrow's booking (check if it's scheduled for tomorrow in local time)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

      interface BookingData {
        id: string;
        startTime?: unknown;
        status?: string;
        swimmerName?: string;
      }

      const tomorrowBooking = everlyBookings.find((booking: BookingData) => {
        const startDate = parseStartTime(booking.startTime);
        if (!startDate || isNaN(startDate.getTime())) {
          return false;
        }
        
        // Check if the date is tomorrow (compare dates, not times)
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const tomorrowDateOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        
        return startDateOnly.getTime() === tomorrowDateOnly.getTime();
      });

      if (!tomorrowBooking) {
        // Show all Everly bookings for debugging
        const allDates = everlyBookings.map((b: BookingData) => {
          const startDate = parseStartTime(b.startTime);
          if (!startDate || isNaN(startDate.getTime())) {
            return `Invalid (raw: ${JSON.stringify(b.startTime)})`;
          }
          return startDate.toLocaleString("en-US", { 
            year: "numeric", 
            month: "2-digit", 
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        }).join("; ");
        throw new Error(`No booking found for Everly tomorrow. Found ${everlyBookings.length} Everly booking(s) on: ${allDates}. Tomorrow is: ${tomorrow.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })}`);
      }

      // Send reminder for this specific booking
      const response = await fetch("/api/private-lessons/reminder", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: tomorrowBooking.id,
        }),
      });

      let data;
      try {
        const text = await response.text();
        if (!text) {
          throw new Error(`Empty response from server: ${response.status} ${response.statusText}`);
        }
        data = JSON.parse(text);
      } catch {
        throw new Error(`Failed to parse response: ${response.status} ${response.statusText}. Raw response may not be JSON.`);
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      setResult({
        success: true,
        message: `Reminder sent successfully to Everly Young's parent!`,
        data: {
          total: 1,
          sent: 1,
          failed: 0,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error) || "Failed to send reminder";
      setResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setLoadingEverly(false);
    }
  };

  const triggerReminder = async () => {
    setLoading(true);
    setResult(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const idToken = await user.getIdToken();

      // Call the GET endpoint to trigger auto-send reminders
      const response = await fetch("/api/private-lessons/reminder", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      let data;
      try {
        const text = await response.text();
        if (!text) {
          throw new Error(`Empty response from server: ${response.status} ${response.statusText}`);
        }
        data = JSON.parse(text);
      } catch {
        throw new Error(`Failed to parse response: ${response.status} ${response.statusText}. Raw response may not be JSON.`);
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      setResult({
        success: true,
        message: `Reminder check completed! Found ${data.total || 0} booking(s), sent ${data.sent || 0} reminder(s).`,
        data: data,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error) || "Failed to trigger reminder";
      setResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Test Reminder Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">
              This page allows you to manually trigger the reminder email system.
              It will check for bookings scheduled for tomorrow and send reminder emails
              to parents who haven&apos;t received one yet.
            </p>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The system will automatically send reminders daily at 9:00 AM UTC
                (1:00 AM PST / 2:00 AM PDT). This test page allows you to trigger it manually.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={sendReminderForEverly}
                disabled={loading || loadingEverly}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loadingEverly ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Reminder to Everly Young (Tomorrow&apos;s Booking)
                  </>
                )}
              </Button>

              <Button
                onClick={triggerReminder}
                disabled={loading || loadingEverly}
                variant="outline"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Trigger Reminder Check (All Tomorrow&apos;s Bookings)
                  </>
                )}
              </Button>
            </div>

            {result && (
              <Alert
                variant={result.success ? "default" : "destructive"}
                className="mt-4"
              >
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">{result.message}</p>
                    {result.data && (
                      <div className="mt-2 text-sm">
                        <p>
                          <strong>Total bookings found:</strong> {result.data.total || 0}
                        </p>
                        <p>
                          <strong>Reminders sent:</strong> {result.data.sent || 0}
                        </p>
                        <p>
                          <strong>Failed:</strong> {result.data.failed || 0}
                        </p>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-6 p-4 bg-slate-100 rounded-lg">
              <h3 className="font-semibold mb-2">How it works:</h3>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>Finds all confirmed bookings scheduled for tomorrow</li>
                <li>Only sends reminders to bookings that haven&apos;t received one yet (reminderSent = false)</li>
                <li>Sends email to the parent&apos;s email address</li>
                <li>Marks the booking as reminderSent = true after sending</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

