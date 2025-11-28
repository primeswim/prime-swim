// app/admin/clinic/placement/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { Calendar, MapPin, Users, Plus, Trash2, Save, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { SwimmerLevel } from "@/lib/swimmer-levels";

interface PlacementSwimmer {
  submissionId: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  parentEmail: string;
  parentPhone: string;
  submittedAt?: number;
  placedAt?: number;
}

interface WaitlistSwimmer {
  submissionId: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  parentEmail: string;
  parentPhone: string;
  submittedAt?: number;
  waitlistOrder: number;
}

interface Lane {
  laneNumber: number;
  capacity: number;
  swimmers: PlacementSwimmer[];
}

interface Placement {
  id?: string;
  activityId: string;
  season: string;
  location: string;
  slotLabel: string;
  slotDate?: string; // Add date field to distinguish slots with same label but different dates
  lanes: Lane[];
  waitlist: WaitlistSwimmer[];
  createdAt?: number;
  updatedAt?: number;
}

interface ClinicConfig {
  id: string;
  season: string;
  title: string;
  type?: string;
  locations: Array<{
    name: string;
    slots: Array<{
      date: string;
      label: string;
      time?: string;
    }>;
  }>;
}

function PlacementManagementContent() {
  const isAdmin = useIsAdminFromDB();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId") || "";

  const [configs, setConfigs] = useState<ClinicConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ClinicConfig | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; success: boolean } | null>(null);

  // Load clinic configs
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const res = await fetch("/api/clinic/config", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setConfigs(data.configs || []);
          
          // Auto-select if activityId is provided
          if (activityId) {
            const config = data.configs?.find((c: ClinicConfig) => c.id === activityId);
            if (config) setSelectedConfig(config);
          }
        }
      } catch (err) {
        console.error("Load configs error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      loadConfigs();
    }
  }, [isAdmin, activityId]);

  // Load placements when config is selected
  useEffect(() => {
    const loadPlacements = async () => {
      if (!selectedConfig) {
        setPlacements([]);
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/clinic/placement?season=${encodeURIComponent(selectedConfig.season)}&activityId=${encodeURIComponent(selectedConfig.id)}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setPlacements(data.placements || []);
        }
      } catch (err) {
        console.error("Load placements error:", err);
      }
    };

    if (isAdmin && selectedConfig) {
      loadPlacements();
    }
  }, [isAdmin, selectedConfig]);

  const getOrCreatePlacement = (location: string, slotLabel: string, slotDate?: string): Placement => {
    const existing = placements.find(
      (p) => p.location === location && p.slotLabel === slotLabel && p.slotDate === slotDate
    );

    if (existing) {
      // Ensure it's added to placements if not already there
      if (!placements.includes(existing)) {
        setPlacements((prev) => [...prev, existing]);
      }
      return existing;
    }

    // Create new placement (will be added when updated)
    const newPlacement: Placement = {
      activityId: selectedConfig!.id,
      season: selectedConfig!.season,
      location,
      slotLabel,
      slotDate,
      lanes: [{ laneNumber: 1, capacity: 3, swimmers: [] }],
      waitlist: [],
    };

    return newPlacement;
  };

  const updatePlacement = (placement: Placement) => {
    setPlacements((prev) => {
      const index = prev.findIndex(
        (p) => p.location === placement.location && p.slotLabel === placement.slotLabel && p.slotDate === placement.slotDate
      );

      if (index >= 0) {
        const updated = [...prev];
        updated[index] = placement;
        return updated;
      } else {
        return [...prev, placement];
      }
    });
  };

  const addLane = (placement: Placement) => {
    const maxLaneNumber = Math.max(...placement.lanes.map((l) => l.laneNumber), 0);
    const updated = {
      ...placement,
      lanes: [
        ...placement.lanes,
        { laneNumber: maxLaneNumber + 1, capacity: 3, swimmers: [] },
      ],
    };
    updatePlacement(updated);
  };

  const removeLane = (placement: Placement, laneNumber: number) => {
    if (placement.lanes.length <= 1) {
      setStatus({ message: "At least one lane is required", success: false });
      return;
    }

    const updated = {
      ...placement,
      lanes: placement.lanes.filter((l) => l.laneNumber !== laneNumber),
    };
    updatePlacement(updated);
  };

  const updateLaneCapacity = (placement: Placement, laneNumber: number, capacity: number) => {
    const updated = {
      ...placement,
      lanes: placement.lanes.map((l) =>
        l.laneNumber === laneNumber ? { ...l, capacity: Math.max(1, capacity) } : l
      ),
    };
    updatePlacement(updated);
  };

  const savePlacements = async () => {
    if (!selectedConfig) return;

    setSaving(true);
    setStatus(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();

      // Save all placements
      for (const placement of placements) {
        const res = await fetch("/api/clinic/placement", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(placement),
        });

        if (!res.ok) {
          throw new Error(`Failed to save placement for ${placement.location} - ${placement.slotLabel}`);
        }
      }

      setStatus({ message: "Placements saved successfully!", success: true });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Save placements error:", err);
      setStatus({ message: "Failed to save placements", success: false });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Placement Management
          </h1>
          <p className="text-slate-600">Configure lane capacity and manage swimmer placements</p>
        </div>

        {status && (
          <Alert
            variant={status.success ? "default" : "destructive"}
            className={`mb-6 ${status.success ? "border-green-200 bg-green-50" : ""}`}
          >
            {status.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={status.success ? "text-green-800" : ""}>
              {status.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Config Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="config">Activity</Label>
                <Select
                  value={selectedConfig?.id || ""}
                  onValueChange={(value) => {
                    const config = configs.find((c) => c.id === value);
                    setSelectedConfig(config || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map((config) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.title} ({config.season})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedConfig && (
                <Button onClick={savePlacements} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save All Placements
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading...</p>
          </div>
        ) : !selectedConfig ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600">Please select an activity to manage placements</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {selectedConfig.locations.map((locationData) => {
              return (
                <Card key={locationData.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-600" />
                      {locationData.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {locationData.slots.map((slot, slotIdx) => {
                      // Use unique key combining location, date, and label to avoid duplicates
                      const uniqueKey = `${locationData.name}-${slot.date || slotIdx}-${slot.label}`;
                      const placement = getOrCreatePlacement(locationData.name, slot.label, slot.date);
                      const totalCapacity = placement.lanes.reduce((sum, l) => sum + l.capacity, 0);
                      const totalPlaced = placement.lanes.reduce((sum, l) => sum + l.swimmers.length, 0);
                      const available = totalCapacity - totalPlaced;

                      // Format date for display
                      let displayDate = "";
                      if (slot.date) {
                        try {
                          let dateObj: Date;
                          if (/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
                            const [year, month, day] = slot.date.split('-').map(Number);
                            dateObj = new Date(year, month - 1, day);
                          } else {
                            dateObj = new Date(slot.date);
                          }
                          if (!isNaN(dateObj.getTime())) {
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            const year = dateObj.getFullYear();
                            displayDate = `${month}/${day}/${year}`;
                          }
                        } catch {
                          // If date parsing fails, just use the raw date
                          displayDate = slot.date;
                        }
                      }

                      return (
                        <div key={uniqueKey} className="border rounded-lg p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-slate-800">
                                {displayDate ? `${displayDate} - ${slot.label}` : slot.label}
                              </h4>
                              <p className="text-sm text-slate-600">
                                Capacity: {totalPlaced}/{totalCapacity} ({available} available) | Waitlist: {placement.waitlist.length}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addLane(placement)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Lane
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {placement.lanes.map((lane) => (
                              <div
                                key={lane.laneNumber}
                                className="bg-white border rounded-lg p-4"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-slate-800">
                                      Lane {lane.laneNumber}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Label htmlFor={`lane-${lane.laneNumber}-capacity`} className="text-sm">
                                        Capacity:
                                      </Label>
                                      <Input
                                        id={`lane-${lane.laneNumber}-capacity`}
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={lane.capacity}
                                        onChange={(e) =>
                                          updateLaneCapacity(
                                            placement,
                                            lane.laneNumber,
                                            parseInt(e.target.value) || 1
                                          )
                                        }
                                        className="w-20"
                                      />
                                    </div>
                                  </div>
                                  {placement.lanes.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeLane(placement, lane.laneNumber)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600">
                                  {lane.swimmers.length}/{lane.capacity} swimmers placed
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlacementManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Header />
          <div className="container mx-auto px-4 py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      }
    >
      <PlacementManagementContent />
    </Suspense>
  );
}

