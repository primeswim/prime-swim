"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, momentLocalizer, type View } from "react-big-calendar";
import moment from "moment";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { CalendarIcon, Filter, AlertTriangle, Loader2, CheckCircle2, Download } from "lucide-react";
import Header from "@/components/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SlotEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  coachId: number;
  locationId: number;
  status: string;
  priorityOnly: boolean;
  bookingId?: string;
  bookedBySwimmerId?: string;
  bookedBySwimmerName?: string;
  adminNotes?: string;
};

const localizer = momentLocalizer(moment);

const locations = [
  { id: 1, name: "Bellevue Aquatic Center" },
  { id: 2, name: "Redmond Pool" },
  { id: 3, name: "Mary Wayte Swimming Pool" },
];

interface Swimmer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export default function PrivateLessonCalendar() {
  const [slots, setSlots] = useState<SlotEvent[]>([]);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<SlotEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [selectedSwimmerId, setSelectedSwimmerId] = useState<string>("");
  const [bookingNotes, setBookingNotes] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [currentBooking, setCurrentBooking] = useState<{ id: string; swimmerId: string; swimmerName: string; notes?: string } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportRange, setExportRange] = useState<string>("30days");
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [exportBySwimmer, setExportBySwimmer] = useState(false);
  const [selectedSwimmerForExport, setSelectedSwimmerForExport] = useState<string>("");
  const [isDeletingSlot, setIsDeletingSlot] = useState(false);

  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    const fetchSlots = async () => {
      const querySnapshot = await getDocs(collection(db, "availableSlots"));
      const slotsData = querySnapshot.docs.map((doc) => {
        const slot = doc.data();
        return {
          id: doc.id,
          title: slot.status === "taken" ? "Taken" : "Available",
          start: slot.startTime.toDate(),
          end: slot.endTime.toDate(),
          coachId: slot.coachId,
          locationId: slot.locationId,
          status: slot.status,
          priorityOnly: slot.priorityOnly || false,
          bookingId: slot.bookingId || undefined,
          bookedBySwimmerId: slot.bookedBySwimmerId || undefined,
          bookedBySwimmerName: slot.bookedBySwimmerName || undefined,
          adminNotes: slot.adminNotes || undefined,
        };
      });
      setSlots(slotsData);
    };

    fetchSlots();
  }, []);

  // Fetch booking details when slot is selected (for admin update)
  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!selectedSlot || !isAdmin) {
        setCurrentBooking(null);
        return;
      }

      // If slot is taken, fetch booking details
      if (selectedSlot.status === "taken") {
        try {
          const user = auth.currentUser;
          if (!user) {
            setCurrentBooking(null);
            return;
          }

          const idToken = await user.getIdToken();
          const response = await fetch(`/api/private-lessons/booking?slotId=${selectedSlot.id}&status=confirmed`, {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.bookings && data.bookings.length > 0) {
              const booking = data.bookings[0];
              setCurrentBooking({
                id: booking.id,
                swimmerId: booking.swimmerId,
                swimmerName: booking.swimmerName,
                notes: booking.notes || "",
              });
              setSelectedSwimmerId(booking.swimmerId);
              setBookingNotes(booking.notes || "");
            } else {
              // No booking found, but slot is marked as taken - might be a data inconsistency
              console.warn("Slot is marked as taken but no booking found");
              setCurrentBooking(null);
            }
          } else {
            const errorText = await response.text().catch(() => "");
            console.error("Failed to fetch booking details:", response.status, errorText);
            setCurrentBooking(null);
          }
        } catch (error) {
          console.error("Failed to fetch booking details:", error);
          setCurrentBooking(null);
        }
      } else {
        // Slot is available, no booking exists
        setCurrentBooking(null);
        setSelectedSwimmerId("");
        setBookingNotes("");
      }
    };

    fetchBookingDetails();
  }, [selectedSlot, isAdmin]);

  useEffect(() => {
    const fetchSwimmers = async () => {
      if (!isAdmin) return;
      try {
        const querySnapshot = await getDocs(collection(db, "privatelessonstudents"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          firstName: doc.data().firstName || "",
          lastName: doc.data().lastName || "",
          email: doc.data().email || "",
          phone: doc.data().phone || "",
        })) as Swimmer[];
        setSwimmers(data.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`;
          const nameB = `${b.firstName} ${b.lastName}`;
          return nameA.localeCompare(nameB);
        }));
      } catch (error) {
        console.error("Failed to fetch swimmers:", error);
      }
    };

    fetchSwimmers();
  }, [isAdmin]);

  const filteredEvents = useMemo(() => {
    return slots.filter((slot) => {
      // Admin can see all slots, non-admin only see available
      if (!isAdmin && slot.status !== "available") return false;

      const locationMatch =
        selectedLocation === "all" ||
        slot.locationId.toString() === selectedLocation;
      const searchMatch =
        searchTerm === "" ||
        locations
          .find((l) => l.id === slot.locationId)
          ?.name.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return locationMatch && searchMatch;
    });
  }, [slots, selectedLocation, searchTerm, isAdmin]);

  const eventStyleGetter = (event: SlotEvent) => {
    const backgroundColor = event.status === "taken" ? "#fee2e2" : "#FDF6F0";
    const color = event.status === "taken" ? "#991b1b" : "#5E4B3C";
    return {
      style: {
        backgroundColor,
        color,
        borderRadius: "4px",
        padding: "4px 6px",
        fontSize: "12px",
        minHeight: event.status === "taken" ? "50px" : undefined,
        display: "flex",
        flexDirection: "column" as const,
        justifyContent: "flex-start",
      },
    };
  };
  

  const EventComponent = ({ event }: { event: SlotEvent }) => {
    if (event.status === "taken") {
      // Only show swimmer name to admin users
      if (isAdmin && event.bookedBySwimmerName) {
        return (
          <div className="text-xs p-1">
            <div className="font-semibold truncate" title={event.bookedBySwimmerName}>
              {event.bookedBySwimmerName}
            </div>
          </div>
        );
      }
      // Non-admin users just see "Booked"
      return (
        <div className="text-xs p-1">
          <div className="font-semibold">Booked</div>
        </div>
      );
    }
    return (
      <div className="text-xs p-1">
        <div className="font-semibold">Available</div>
      </div>
    );
  };

  const handleEventClick = (event: SlotEvent) => {
    // Only admin can click on slots
    if (!isAdmin) return;
    
    setSelectedSlot(event);
    setSelectedSwimmerId("");
    setBookingNotes("");
    setAdminNotes(event.adminNotes || "");
    setBookingStatus(null);
    setCurrentBooking(null);
    setIsDialogOpen(true);
  };

  const handleSetTaken = async () => {
    if (!selectedSlot || !selectedSwimmerId) {
      setBookingStatus({ type: "error", message: "Please select a swimmer" });
      return;
    }

    setIsBooking(true);
    setBookingStatus(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const idToken = await user.getIdToken();

      // If updating existing booking (slot is taken)
      // Check slot status first, then try to get booking if needed
      if (selectedSlot.status === "taken") {
        // If we don't have currentBooking yet, fetch it first
        if (!currentBooking || !currentBooking.id) {
          try {
            const bookingResponse = await fetch(`/api/private-lessons/booking?slotId=${selectedSlot.id}&status=confirmed`, {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });

            if (!bookingResponse.ok) {
              const errorText = await bookingResponse.text().catch(() => "");
              throw new Error(`Failed to fetch booking: ${bookingResponse.status} ${errorText}`);
            }

            const bookingData = await bookingResponse.json();
            if (bookingData.bookings && bookingData.bookings.length > 0) {
              const booking = bookingData.bookings[0];
              // Update booking
              const updateResponse = await fetch("/api/private-lessons/booking", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  id: booking.id,
                  swimmerId: selectedSwimmerId,
                  notes: bookingNotes,
                }),
              });

              if (!updateResponse.ok) {
                const errorData = await updateResponse.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to update booking");
              }

              // Update slot admin notes
              await fetch("/api/private-lessons/slot", {
                method: "PUT",
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  slotId: selectedSlot.id,
                  adminNotes: adminNotes,
                }),
              });

              setBookingStatus({
                type: "success",
                message: "Booking updated successfully!",
              });
              // Refresh slots and close dialog
              const querySnapshot = await getDocs(collection(db, "availableSlots"));
              const slotsData = querySnapshot.docs.map((doc) => {
                const slot = doc.data();
                return {
                  id: doc.id,
                  title: slot.status === "taken" ? "Taken" : "Available",
                  start: slot.startTime.toDate(),
                  end: slot.endTime.toDate(),
                  coachId: slot.coachId,
                  locationId: slot.locationId,
                  status: slot.status,
                  priorityOnly: slot.priorityOnly || false,
                  bookingId: slot.bookingId || undefined,
                  bookedBySwimmerId: slot.bookedBySwimmerId || undefined,
                  bookedBySwimmerName: slot.bookedBySwimmerName || undefined,
                  adminNotes: slot.adminNotes || undefined,
                };
              });
              setSlots(slotsData);
              setTimeout(() => {
                setIsDialogOpen(false);
                setSelectedSwimmerId("");
                setBookingNotes("");
                setAdminNotes("");
                setBookingStatus(null);
                setCurrentBooking(null);
              }, 2000);
              return;
            } else {
              throw new Error("Booking not found for this slot");
            }
          } catch (fetchError) {
            console.error("Error fetching booking:", fetchError);
            throw new Error(fetchError instanceof Error ? fetchError.message : "Failed to fetch booking details");
          }
        } else {
          // We have currentBooking, update it
          const updateResponse = await fetch("/api/private-lessons/booking", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: currentBooking.id,
              swimmerId: selectedSwimmerId,
              notes: bookingNotes,
            }),
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to update booking");
          }

          // Update slot admin notes
          await fetch("/api/private-lessons/slot", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              slotId: selectedSlot.id,
              adminNotes: adminNotes,
            }),
          });

          setBookingStatus({
            type: "success",
            message: "Booking updated successfully!",
          });
        }
      } else if (selectedSlot.status === "available") {
        // Create new booking (only for available slots)
        const response = await fetch("/api/private-lessons/booking", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slotId: selectedSlot.id,
            swimmerId: selectedSwimmerId,
            notes: bookingNotes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to create booking");
        }

        // Update slot admin notes
        await fetch("/api/private-lessons/slot", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slotId: selectedSlot.id,
            adminNotes: adminNotes,
          }),
        });

        setBookingStatus({
          type: "success",
          message: "Booking confirmed! Confirmation email sent to parent.",
        });
      } else {
        // Slot status is neither "taken" nor "available" - shouldn't happen
        throw new Error("Invalid slot status");
      }

      // Refresh slots
      const querySnapshot = await getDocs(collection(db, "availableSlots"));
      const slotsData = querySnapshot.docs.map((doc) => {
        const slot = doc.data();
        return {
          id: doc.id,
          title: slot.status === "taken" ? "Taken" : "Available",
          start: slot.startTime.toDate(),
          end: slot.endTime.toDate(),
          coachId: slot.coachId,
          locationId: slot.locationId,
          status: slot.status,
          priorityOnly: slot.priorityOnly || false,
          bookingId: slot.bookingId || undefined,
          bookedBySwimmerId: slot.bookedBySwimmerId || undefined,
          bookedBySwimmerName: slot.bookedBySwimmerName || undefined,
          adminNotes: slot.adminNotes || undefined,
        };
      });
      setSlots(slotsData);

      // Close dialog after 2 seconds
      setTimeout(() => {
        setIsDialogOpen(false);
        setSelectedSwimmerId("");
        setBookingNotes("");
        setAdminNotes("");
        setBookingStatus(null);
        setCurrentBooking(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to save booking:", error);
      setBookingStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save booking",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedSlot || selectedSlot.status !== "taken") return;

    let bookingToCancel = currentBooking;
    if (!bookingToCancel?.id) {
      // Fetch booking for this slot if not loaded yet
      const user = auth.currentUser;
      if (!user) {
        setBookingStatus({ type: "error", message: "Not authenticated" });
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/private-lessons/booking?slotId=${selectedSlot.id}&status=confirmed`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (!res.ok || !data.bookings?.length) {
          setBookingStatus({ type: "error", message: "No booking found for this slot" });
          return;
        }
        const b = data.bookings[0];
        bookingToCancel = { id: b.id, swimmerId: b.swimmerId, swimmerName: b.swimmerName, notes: b.notes };
      } catch {
        setBookingStatus({ type: "error", message: "Failed to load booking" });
        return;
      }
    }

    const confirmCancel = window.confirm(
      `Are you sure you want to cancel the booking for ${bookingToCancel!.swimmerName}? The slot will become available again.`
    );
    if (!confirmCancel) return;

    setIsBooking(true);
    setBookingStatus(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const idToken = await user.getIdToken();

      // Cancel the booking
      const response = await fetch("/api/private-lessons/booking", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: bookingToCancel!.id,
          status: "cancelled",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to cancel booking");
      }

      // Refresh slots
      const querySnapshot = await getDocs(collection(db, "availableSlots"));
      const slotsData = querySnapshot.docs.map((doc) => {
        const slot = doc.data();
        return {
          id: doc.id,
          title: slot.status === "taken" ? "Taken" : "Available",
          start: slot.startTime.toDate(),
          end: slot.endTime.toDate(),
          coachId: slot.coachId,
          locationId: slot.locationId,
          status: slot.status,
          priorityOnly: slot.priorityOnly || false,
          bookingId: slot.bookingId || undefined,
          bookedBySwimmerId: slot.bookedBySwimmerId || undefined,
          bookedBySwimmerName: slot.bookedBySwimmerName || undefined,
          adminNotes: slot.adminNotes || undefined,
        };
      });
      setSlots(slotsData);

      setBookingStatus({
        type: "success",
        message: "Booking cancelled successfully. Slot is now available.",
      });

      // Close dialog after 2 seconds
      setTimeout(() => {
        setIsDialogOpen(false);
        setSelectedSwimmerId("");
        setBookingNotes("");
        setAdminNotes("");
        setBookingStatus(null);
        setCurrentBooking(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      setBookingStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to cancel booking",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!selectedSlot) return;
    const message = selectedSlot.status === "taken"
      ? "Delete this slot? Any booking on it will be cancelled. This cannot be undone."
      : "Delete this slot? This cannot be undone.";
    if (!window.confirm(message)) return;

    setIsDeletingSlot(true);
    setBookingStatus(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/private-lessons/slot/delete?slotId=${encodeURIComponent(selectedSlot.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete slot");
      }
      const querySnapshot = await getDocs(collection(db, "availableSlots"));
      const slotsData = querySnapshot.docs.map((doc) => {
        const slot = doc.data();
        return {
          id: doc.id,
          title: slot.status === "taken" ? "Taken" : "Available",
          start: slot.startTime.toDate(),
          end: slot.endTime.toDate(),
          coachId: slot.coachId,
          locationId: slot.locationId,
          status: slot.status,
          priorityOnly: slot.priorityOnly || false,
          bookingId: slot.bookingId || undefined,
          bookedBySwimmerId: slot.bookedBySwimmerId || undefined,
          bookedBySwimmerName: slot.bookedBySwimmerName || undefined,
          adminNotes: slot.adminNotes || undefined,
        };
      });
      setSlots(slotsData);
      setIsDialogOpen(false);
      setSelectedSlot(null);
      setSelectedSwimmerId("");
      setBookingNotes("");
      setAdminNotes("");
      setBookingStatus(null);
      setCurrentBooking(null);
    } catch (err) {
      setBookingStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete slot",
      });
    } finally {
      setIsDeletingSlot(false);
    }
  };

  const handleExportCalendar = async () => {
    setIsExporting(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Not authenticated");
      }

      const idToken = await user.getIdToken();

      // Build query parameters
      const params = new URLSearchParams({
        range: exportRange,
      });

      if (exportBySwimmer && selectedSwimmerForExport) {
        params.append("swimmerName", selectedSwimmerForExport);
        // Also add date range if specified
        if (exportRange === "custom" && exportStartDate && exportEndDate) {
          params.append("startDate", exportStartDate);
          params.append("endDate", exportEndDate);
        } else if (exportRange !== "all") {
          // For 30days or 90days, the range is already in params
        }
      } else if (exportRange === "custom" && exportStartDate && exportEndDate) {
        params.append("startDate", exportStartDate);
        params.append("endDate", exportEndDate);
      }

      if (includeCancelled) {
        params.append("includeCancelled", "true");
      }

      // Fetch the iCal file
      const response = await fetch(`/api/private-lessons/calendar/export?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export calendar");
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Generate filename based on range or swimmer
      let filename = `prime-swim-private-lessons-${exportRange}`;
      if (exportBySwimmer && selectedSwimmerForExport) {
        // Use swimmer name in filename
        const safeName = selectedSwimmerForExport.replace(/[^a-zA-Z0-9]/g, "-");
        filename = `prime-swim-pl-${safeName}`;
      } else if (exportRange === "custom" && exportStartDate && exportEndDate) {
        // Use the selected dates in the filename
        const start = new Date(exportStartDate);
        const end = new Date(exportEndDate);
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
        filename = `prime-swim-private-lessons-${startStr}-to-${endStr}`;
      } else {
        // For other ranges, use current date
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        filename = `prime-swim-private-lessons-${exportRange}-${dateStr}`;
      }
      
      a.download = `${filename}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBookingStatus({
        type: "success",
        message: "Calendar exported successfully!",
      });

      // Close dialog after 1 second
      setTimeout(() => {
        setIsExportDialogOpen(false);
        setExportRange("30days");
        setExportStartDate("");
        setExportEndDate("");
        setIncludeCancelled(false);
        setExportBySwimmer(false);
        setSelectedSwimmerForExport("");
        setBookingStatus(null);
      }, 1000);
    } catch (error) {
      console.error("Failed to export calendar:", error);
      setBookingStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to export calendar",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 pb-16">
      <Header />
      <section className="py-12 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CalendarIcon className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800 mb-6">
          Available Private Lessons
        </h1>
        <div className="max-w-3xl mx-auto mt-4 mb-10 bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-800 font-medium">
              Please note: Lesson slots are first come, first served, and availability may change quickly as families finalize their bookings. Please contact us to lock your spot.
            </p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto mt-4 mb-10 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Please complete the registration form first
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Before booking a private lesson, please fill out our registration form. This helps us understand each swimmer&apos;s background and health status to ensure a safe and effective training experience.
            </p>
          </div>
          <div className="flex-shrink-0">
            <a
              href="/private-lessons-register"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              Fill Out Registration Form
            </a>
          </div>
        </div>
      </div>
      </section>

      <div className="max-w-6xl mx-auto mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-bold text-slate-800">
              <Filter className="w-5 h-5 mr-2 text-blue-600" /> Filter Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search locations..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem
                        key={location.id}
                        value={location.id.toString()}
                      >
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-800">
                <CalendarIcon className="w-6 h-6 mr-3 text-blue-600 inline" />
                Available Slots
              </CardTitle>
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Calendar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: "600px" }}>
              <Calendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                eventPropGetter={eventStyleGetter}
                components={{ 
                  event: EventComponent,
                  agenda: {
                    event: ({ event }: { event: SlotEvent }) => (
                      <div className="p-2 text-sm">
                        {event.status === "taken" ? (
                          isAdmin ? (
                            <>
                              {event.bookedBySwimmerName && (
                                <span className="font-medium">{event.bookedBySwimmerName}</span>
                              )}
                              {event.adminNotes && (
                                <span className="text-slate-500 ml-2 italic">📝 {event.adminNotes}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-500">Booked</span>
                          )
                        ) : (
                          <span className="text-slate-500">Available</span>
                        )}
                      </div>
                    ),
                  },
                }}
                step={60}
                timeslots={1}
                min={new Date(2025, 0, 1, 6, 0)}
                max={new Date(2025, 0, 1, 22, 0)}
                onSelectEvent={isAdmin ? handleEventClick : undefined}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedSlot?.status === "taken" ? "Update Booking" : "Book Private Lesson"}
            </DialogTitle>
            <DialogDescription>
              {selectedSlot?.status === "taken" 
                ? "Update the booking or change the swimmer assigned to this slot."
                : "Select a registered swimmer to book this slot. A confirmation email will be sent automatically."}
            </DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>Time:</strong> {selectedSlot.start.toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })} - {selectedSlot.end.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Location:</strong> {locations.find((l) => l.id === selectedSlot.locationId)?.name || "Unknown"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="swimmer">Select Swimmer *</Label>
                <Select value={selectedSwimmerId} onValueChange={setSelectedSwimmerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a registered swimmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {swimmers.map((swimmer) => (
                      <SelectItem key={swimmer.id} value={swimmer.id}>
                        {swimmer.firstName} {swimmer.lastName}
                        {swimmer.email ? ` (${swimmer.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {swimmers.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No registered swimmers found. Please register a swimmer first.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes for Parent (Optional)</Label>
                <Textarea
                  id="notes"
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Add any special notes or instructions for the parent..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes (Internal Only)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes for admin use only (not visible to parents)..."
                  rows={2}
                />
                <p className="text-xs text-slate-500">These notes are only visible to admins and can be used for audit purposes.</p>
              </div>

              {bookingStatus && (
                <Alert variant={bookingStatus.type === "error" ? "destructive" : "default"}>
                  <AlertDescription className="flex items-center gap-2">
                    {bookingStatus.type === "success" && <CheckCircle2 className="w-4 h-4" />}
                    {bookingStatus.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {selectedSlot?.status === "taken" && (
                <Button
                  variant="destructive"
                  onClick={handleCancelBooking}
                  disabled={isBooking || isDeletingSlot}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Booking"
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDeleteSlot}
                disabled={isBooking || isDeletingSlot}
              >
                {isDeletingSlot ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete slot"
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelectedSwimmerId("");
                  setBookingNotes("");
                  setAdminNotes("");
                  setBookingStatus(null);
                  setCurrentBooking(null);
                }}
                disabled={isBooking || isDeletingSlot}
              >
                Close
              </Button>
              {selectedSlot?.status === "available" && (
                <Button onClick={handleSetTaken} disabled={isBooking || isDeletingSlot || !selectedSwimmerId}>
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              )}
              {selectedSlot?.status === "taken" && (
                <Button onClick={handleSetTaken} disabled={isBooking || isDeletingSlot || !selectedSwimmerId}>
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Booking"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Calendar Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export to Calendar</DialogTitle>
            <DialogDescription>
              Export private lesson bookings to iCal format for Google Calendar or other calendar applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="exportBySwimmer"
                checked={exportBySwimmer}
                onChange={(e) => {
                  setExportBySwimmer(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedSwimmerForExport("");
                  }
                }}
                className="rounded border-gray-300"
              />
              <Label htmlFor="exportBySwimmer" className="cursor-pointer">
                Export by Swimmer Name
              </Label>
            </div>

            {exportBySwimmer ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="swimmerSelect">Select Swimmer</Label>
                  <Select value={selectedSwimmerForExport} onValueChange={setSelectedSwimmerForExport}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a swimmer" />
                    </SelectTrigger>
                    <SelectContent>
                      {swimmers.map((swimmer) => {
                        const fullName = `${swimmer.firstName} ${swimmer.lastName}`;
                        return (
                          <SelectItem key={swimmer.id} value={fullName}>
                            {fullName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="swimmerExportRange">Date Range (Optional)</Label>
                  <Select value={exportRange} onValueChange={setExportRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bookings</SelectItem>
                      <SelectItem value="30days">Next 30 Days</SelectItem>
                      <SelectItem value="90days">Next 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {exportRange === "custom" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="exportStartDate">Start Date</Label>
                      <Input
                        id="exportStartDate"
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exportEndDate">End Date</Label>
                      <Input
                        id="exportEndDate"
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="exportRange">Date Range</Label>
                <Select value={exportRange} onValueChange={setExportRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bookings</SelectItem>
                    <SelectItem value="30days">Next 30 Days</SelectItem>
                    <SelectItem value="90days">Next 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!exportBySwimmer && exportRange === "custom" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exportStartDate">Start Date</Label>
                  <Input
                    id="exportStartDate"
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exportEndDate">End Date</Label>
                  <Input
                    id="exportEndDate"
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeCancelled"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeCancelled" className="cursor-pointer">
                Include cancelled bookings
              </Label>
            </div>

            {bookingStatus && (
              <Alert variant={bookingStatus.type === "error" ? "destructive" : "default"}>
                <AlertDescription className="flex items-center gap-2">
                  {bookingStatus.type === "success" && <CheckCircle2 className="w-4 h-4" />}
                  {bookingStatus.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setIsExportDialogOpen(false);
                setExportRange("30days");
                setExportStartDate("");
                setExportEndDate("");
                setIncludeCancelled(false);
                setExportBySwimmer(false);
                setSelectedSwimmerForExport("");
                setBookingStatus(null);
              }}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportCalendar}
              disabled={isExporting || (exportBySwimmer && !selectedSwimmerForExport) || (exportRange === "custom" && (!exportStartDate || !exportEndDate))}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}