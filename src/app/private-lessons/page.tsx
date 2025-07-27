"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, momentLocalizer, type View } from "react-big-calendar";
import moment from "moment";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { CalendarIcon, Filter } from "lucide-react";
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
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";

type SlotEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  coachId: number;
  locationId: number;
  status: string;
  priorityOnly: boolean;
};

const localizer = momentLocalizer(moment);

const coaches = [
  { id: 1, name: "Coach Lara" },
  { id: 2, name: "Coach Moe" },
  { id: 3, name: "Coach Emma" },
];

const locations = [
  { id: 1, name: "Bellevue Aquatic Center" },
  { id: 2, name: "Redmond Pool" },
  { id: 3, name: "Mary Wayte Swimming Pool" },
];

export default function PrivateLessonCalendar() {
  const [slots, setSlots] = useState<SlotEvent[]>([]);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [selectedCoach, setSelectedCoach] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<SlotEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    const fetchSlots = async () => {
      const querySnapshot = await getDocs(collection(db, "availableSlots"));
      const data = querySnapshot.docs.map((doc) => {
        const slot = doc.data();
        return {
          id: doc.id,
          title: `Available - ${
            coaches.find((c) => c.id === slot.coachId)?.name ?? "Coach"
          }`,
          start: slot.startTime.toDate(),
          end: slot.endTime.toDate(),
          coachId: slot.coachId,
          locationId: slot.locationId,
          status: slot.status,
          priorityOnly: slot.priorityOnly || false,
        };
      });
      setSlots(data);
    };

    fetchSlots();
  }, []);

  const filteredEvents = useMemo(() => {
    return slots.filter((slot) => {
      if (slot.status !== "available") return false;

      const coachMatch =
        selectedCoach === "all" || slot.coachId.toString() === selectedCoach;
      const locationMatch =
        selectedLocation === "all" ||
        slot.locationId.toString() === selectedLocation;
      const searchMatch =
        searchTerm === "" ||
        coaches
          .find((c) => c.id === slot.coachId)
          ?.name.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        locations
          .find((l) => l.id === slot.locationId)
          ?.name.toLowerCase()
          .includes(searchTerm.toLowerCase());

      return coachMatch && locationMatch && searchMatch;
    });
  }, [slots, selectedCoach, selectedLocation, searchTerm]);

  const eventStyleGetter = (event: SlotEvent) => {
    let backgroundColor = "#FDF6F0";
    return {
      style: {
        backgroundColor,
        color: "#5E4B3C",
        borderRadius: "4px",
        padding: "2px 4px",
        fontSize: "12px",
      },
    };
  };

  const EventComponent = ({ event }: { event: SlotEvent }) => {
    const coach = coaches.find((c) => c.id === event.coachId);
    return (
      <div className="text-xs">
        <div className="font-medium">{coach?.name}</div>
      </div>
    );
  };

  const handleEventClick = (event: SlotEvent) => {
    if (isAdmin) {
      setSelectedSlot(event);
      setIsDialogOpen(true);
    }
  };

  const handleSetTaken = async () => {
    if (!selectedSlot) return;
    try {
      const slotRef = doc(db, "availableSlots", selectedSlot.id);
      await updateDoc(slotRef, { status: "taken" });

      // Update local state
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === selectedSlot.id ? { ...slot, status: "taken" } : slot
        )
      );

      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to update slot status:", error);
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
        <p className="text-xl text-slate-600">
          View available private lesson slots below
        </p>
      </section>

      <div className="max-w-6xl mx-auto mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-bold text-slate-800">
              <Filter className="w-5 h-5 mr-2 text-blue-600" /> Filter Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search coaches or locations..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach">Coach</Label>
                <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Coaches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Coaches</SelectItem>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id.toString()}>
                        {coach.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <CardTitle className="text-2xl font-bold text-slate-800">
              <CalendarIcon className="w-6 h-6 mr-3 text-blue-600 inline" />
              Available Slots
            </CardTitle>
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
                components={{ event: EventComponent }}
                step={60}
                timeslots={1}
                min={new Date(2025, 0, 1, 6, 0)}
                max={new Date(2025, 0, 1, 22, 0)}
                onSelectEvent={handleEventClick}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Slot</DialogTitle>
          </DialogHeader>
          <p>
            Mark this slot by <strong>{selectedSlot?.title}</strong> as{" "}
            <code>taken</code>?
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetTaken}>Mark as Taken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}