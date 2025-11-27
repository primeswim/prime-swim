// app/admin/makeup/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { Calendar, MapPin, Clock, Users, Search, CheckCircle2, AlertCircle, Plus, FilePlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SwimmerPick = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail?: string;
};

type SwimmerFS = {
  childFirstName?: string;
  childLastName?: string;
  swimmerName?: string;
  name?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentName?: string;
  parentEmail?: string;
  parentEmails?: string[];
};

type EventLite = {
  id: string;
  text: string;
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  location?: string | null;
  createdAt: string | null;
};

export default function MakeupAdminPage() {
  const isAdmin = useIsAdminFromDB();
  const [swimmers, setSwimmers] = useState<SwimmerPick[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [makeupText, setMakeupText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingEvents, setExistingEvents] = useState<EventLite[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [mode, setMode] = useState<"new" | "add">("new");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "swimmers"));
      const arr: SwimmerPick[] = [];
      snap.forEach((d) => {
        const x = d.data() as SwimmerFS;

        const sName =
          [x.childFirstName, x.childLastName].filter(Boolean).join(" ").trim() ||
          x.swimmerName ||
          x.name ||
          d.id;

        const pName =
          [x.parentFirstName, x.parentLastName].filter(Boolean).join(" ").trim() ||
          x.parentName ||
          "";

        const pEmail =
          x.parentEmail || (Array.isArray(x.parentEmails) ? x.parentEmails[0] : "") || "";

        if (sName) arr.push({ id: d.id, swimmerName: sName, parentName: pName, parentEmail: pEmail });
      });

      setSwimmers(arr.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName)));
    })();
  }, []);

  // Load existing events for "add to existing" mode
  useEffect(() => {
    if (mode === "add" && isAdmin) {
      (async () => {
        try {
          const u = auth.currentUser;
          if (!u) return;
          const idToken = await u.getIdToken(true);
          const res = await fetch("/api/makeup/events", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            setExistingEvents(data.events || []);
          } else {
            console.error("Failed to load events:", data.error);
            setExistingEvents([]);
          }
        } catch (e) {
          console.error("Load events error:", e);
          setExistingEvents([]);
        }
      })();
    } else {
      setExistingEvents([]);
    }
  }, [mode, isAdmin]);

  // Filter swimmers by search term
  const filteredSwimmers = useMemo(() => {
    if (!searchTerm.trim()) return swimmers;
    const term = searchTerm.toLowerCase();
    return swimmers.filter(
      (s) =>
        s.swimmerName.toLowerCase().includes(term) ||
        s.parentName?.toLowerCase().includes(term) ||
        s.parentEmail?.toLowerCase().includes(term)
    );
  }, [swimmers, searchTerm]);

  // Preview: show selected entries' email list (deduplicated)
  const recipientsPreview = useMemo(() => {
    const emails = selectedIds
      .map((id) => swimmers.find((s) => s.id === id)?.parentEmail?.toLowerCase() || "")
      .filter(Boolean);

    const unique = Array.from(new Set(emails));
    return unique;
  }, [selectedIds, swimmers]);

  // Build makeup text from fields
  const buildMakeupText = () => {
    const parts: string[] = [];
    if (date) {
      // date is in YYYY-MM-DD format, add time to avoid timezone issues
      try {
        const dateObj = new Date(date + "T00:00:00");
        if (!isNaN(dateObj.getTime())) {
          parts.push(dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
      } catch {
        // Fallback to original date string if parsing fails
        parts.push(date);
      }
    }
    if (time) {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      let timeStr = `${hour12}:${minutes} ${ampm}`;
      if (endTime) {
        const [endHours, endMinutes] = endTime.split(":");
        const endHour = parseInt(endHours);
        const endAmpm = endHour >= 12 ? "PM" : "AM";
        const endHour12 = endHour % 12 || 12;
        timeStr += ` - ${endHour12}:${endMinutes} ${endAmpm}`;
      }
      parts.push(timeStr);
    }
    if (location) parts.push(location);
    if (makeupText) parts.push(makeupText);
    return parts.join(" — ");
  };

  const handleToggleSwimmer = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredSwimmers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSwimmers.map((s) => s.id));
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking permission…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Not authorized (admin only).</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const handlePublish = async () => {
    try {
      if (mode === "add") {
        // Add to existing event
        if (!selectedEventId) throw new Error("Please select an existing event.");
        if (!selectedIds.length) throw new Error("Please select at least one swimmer.");

        setStatus("Adding swimmers and sending emails…");
        setSuccess(false);
        const u = auth.currentUser;
        if (!u) throw new Error("Not signed in");
        const idToken = await u.getIdToken(true);

        const res = await fetch("/api/makeup/send-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            makeupId: selectedEventId,
            swimmerIds: selectedIds,
          }),
        });

        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "Failed to add swimmers");

        // Update swimmers' nextMakeupId
        const updateRes = await fetch("/api/makeup/add-to-event", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            makeupId: selectedEventId,
            swimmerIds: selectedIds,
          }),
        });

        const updateData = await updateRes.json();
        if (!updateRes.ok || !updateData.ok) {
          console.error("Failed to update swimmers:", updateData.error);
        }

        setStatus(`✅ Added ${selectedIds.length} swimmer(s) to event and sent ${j.sent || 0} email(s).`);
        setSuccess(true);
        setSelectedIds([]);
        setSearchTerm("");
      } else {
        // Create new event
        const finalText = buildMakeupText();
        if (!finalText.trim()) throw new Error("Please fill in at least one field (date, time, location, or description).");
        if (!selectedIds.length) throw new Error("Please select at least one swimmer.");

        setStatus("Publishing…");
        setSuccess(false);
        const u = auth.currentUser;
        if (!u) throw new Error("Not signed in");
        const idToken = await u.getIdToken(true);

        const res = await fetch("/api/makeup/publish", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            makeupText: finalText.trim(),
            swimmerIds: selectedIds,
            date: date || undefined,
            time: time || undefined,
            endTime: endTime || undefined,
            location: location || undefined,
          }),
        });

        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || "Publish failed");

        setStatus(`✅ Published to ${selectedIds.length} swimmer(s) and sent notification emails.`);
        setSuccess(true);
        
        // Reset form
        setMakeupText("");
        setDate("");
        setTime("");
        setEndTime("");
        setLocation("");
        setSelectedIds([]);
        setSearchTerm("");
      }

      setTimeout(() => {
        setStatus("");
        setSuccess(false);
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("❌ " + msg);
      setSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Publish Make-up Class
          </h1>
          <p className="text-slate-600">Create and publish a make-up class for selected swimmers</p>
        </div>

        {status && (
          <Alert className={`mb-6 ${success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            {success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={success ? "text-green-800" : "text-red-800"}>
              {status}
            </AlertDescription>
          </Alert>
        )}

        {/* Mode Toggle */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => {
              setMode("new");
              setSelectedEventId("");
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Event
          </Button>
          <Button
            variant={mode === "add" ? "default" : "outline"}
            onClick={() => setMode("add")}
            className="flex items-center gap-2"
          >
            <FilePlus className="w-4 h-4" />
            Add to Existing Event
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Event Details */}
          <div className="space-y-6">
            {mode === "add" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FilePlus className="w-5 h-5" />
                    Select Existing Event
                  </CardTitle>
                  <CardDescription>Choose an existing make-up class event</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingEvents.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-slate-500">No events available</div>
                      ) : (
                        existingEvents.map((ev) => {
                          const parts: string[] = [];
                          if (ev.date) {
                            try {
                              const dateObj = new Date(ev.date + "T00:00:00");
                              if (!isNaN(dateObj.getTime())) {
                                parts.push(dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
                              }
                            } catch {}
                          }
                          if (ev.time) {
                            const [hours, minutes] = ev.time.split(":");
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? "PM" : "AM";
                            const hour12 = hour % 12 || 12;
                            let timeStr = `${hour12}:${minutes} ${ampm}`;
                            if (ev.endTime) {
                              const [endHours, endMinutes] = ev.endTime.split(":");
                              const endHour = parseInt(endHours);
                              const endAmpm = endHour >= 12 ? "PM" : "AM";
                              const endHour12 = endHour % 12 || 12;
                              timeStr += ` - ${endHour12}:${endMinutes} ${endAmpm}`;
                            }
                            parts.push(timeStr);
                          }
                          const timeStr = parts.length > 0 ? ` (${parts.join(", ")})` : "";
                          return (
                            <SelectItem key={ev.id} value={ev.id}>
                              {ev.text}{timeStr}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ) : (
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Event Details
                </CardTitle>
                <CardDescription>Enter the make-up class information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Start Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Mary Wayte Pool"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Additional Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={makeupText}
                    onChange={(e) => setMakeupText(e.target.value)}
                    placeholder="Additional details about the make-up class..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Preview */}
                {(date || time || location || makeupText) && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                    <p className="text-sm font-semibold text-blue-800 mb-2">Preview:</p>
                    <p className="text-blue-900">{buildMakeupText() || "—"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Recipients Preview */}
            {recipientsPreview.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recipients ({recipientsPreview.length} unique emails)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 border rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-sm text-slate-700 break-words">{recipientsPreview.join(", ")}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Swimmer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Select Swimmers ({selectedIds.length} selected)
              </CardTitle>
              <CardDescription>Choose which swimmers will receive this make-up class notification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search swimmers, parents, or emails..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Select All */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedIds.length === filteredSwimmers.length ? "Deselect All" : "Select All"}
                </Button>
                <span className="text-sm text-slate-600">
                  {selectedIds.length} of {filteredSwimmers.length} selected
                </span>
              </div>

              {/* Swimmer List */}
              <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                <div className="divide-y">
                  {filteredSwimmers.map((s) => {
                    const isSelected = selectedIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                        }`}
                        onClick={() => handleToggleSwimmer(s.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => handleToggleSwimmer(s.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate">{s.swimmerName}</p>
                            {s.parentName && (
                              <p className="text-sm text-slate-600 truncate">{s.parentName}</p>
                            )}
                            {s.parentEmail && (
                              <p className="text-xs text-slate-500 truncate">{s.parentEmail}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredSwimmers.length === 0 && (
                  <div className="p-6 text-center text-slate-500">No swimmers found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Publish Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handlePublish}
            size="lg"
            className="px-8"
            disabled={!selectedIds.length || status.includes("Publishing")}
          >
            {status.includes("Publishing") ? "Publishing..." : "Publish Make-up Class"}
          </Button>
        </div>
      </div>
    </div>
  );
}
