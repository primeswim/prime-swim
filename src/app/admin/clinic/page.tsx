// app/admin/clinic/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { Calendar, MapPin, Plus, Trash2, Edit, Save, X, CheckCircle2, AlertCircle, Eye, Copy, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActivityType } from "@/app/api/clinic/config/route";

interface ClinicSlot {
  date: string;
  label: string;
  time?: string;
}

interface ClinicLocation {
  name: string;
  slots: ClinicSlot[];
}

interface ClinicConfig {
  id?: string;
  season: string;
  title: string;
  type?: ActivityType;
  description?: string;
  locations: ClinicLocation[];
  levels?: string[];
  active: boolean;
}

export default function ClinicAdminPage() {
  const isAdmin = useIsAdminFromDB();
  const router = useRouter();
  const [configs, setConfigs] = useState<ClinicConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClinicConfig>({
    season: "",
    title: "",
    type: "clinic",
    description: "",
    locations: [],
    levels: [],
    active: true,
  });
  const [status, setStatus] = useState<{ message: string; success: boolean } | null>(null);

  useEffect(() => {
    if (isAdmin === true) {
      loadConfigs();
    }
  }, [isAdmin]);

  const loadConfigs = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch("/api/clinic/config", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to load configs");
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error("Load configs error:", err);
      setStatus({ message: "Failed to load clinic configs", success: false });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();

      // Validate
      if (!formData.season || !formData.title || formData.locations.length === 0) {
        setStatus({ message: "Please fill in all required fields", success: false });
        return;
      }

      // Validate locations
      for (const loc of formData.locations) {
        if (!loc.name || loc.slots.length === 0) {
          setStatus({ message: "Each location must have a name and at least one slot", success: false });
          return;
        }
      }

      const url = editingId ? "/api/clinic/config" : "/api/clinic/config";
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      setStatus({ message: editingId ? "Clinic config updated" : "Clinic config created", success: true });
      setEditingId(null);
      setFormData({
        season: "",
        title: "",
        type: "clinic",
        description: "",
        locations: [],
        levels: [],
        active: true,
      });
      await loadConfigs();
    } catch (err) {
      console.error("Save error:", err);
      setStatus({
        message: err instanceof Error ? err.message : "Failed to save clinic config",
        success: false,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this clinic config?")) return;

    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/clinic/config?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to delete");
      setStatus({ message: "Clinic config deleted", success: true });
      await loadConfigs();
    } catch (err) {
      console.error("Delete error:", err);
      setStatus({ message: "Failed to delete clinic config", success: false });
    }
  };

  const handleEdit = (config: ClinicConfig) => {
    setEditingId(config.id || null);
    setFormData({ ...config });
  };

  const handleCancel = () => {
    setEditingId(null);
      setFormData({
        season: "",
        title: "",
        type: "clinic",
        description: "",
        locations: [],
        levels: [],
        active: true,
      });
  };

  const addLocation = () => {
    setFormData({
      ...formData,
      locations: [...formData.locations, { name: "", slots: [] }],
    });
  };

  const removeLocation = (index: number) => {
    setFormData({
      ...formData,
      locations: formData.locations.filter((_, i) => i !== index),
    });
  };

  const updateLocation = (index: number, field: keyof ClinicLocation, value: string | ClinicSlot[]) => {
    const newLocations = [...formData.locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setFormData({ ...formData, locations: newLocations });
  };

  const addSlot = (locationIndex: number) => {
    const newLocations = [...formData.locations];
    newLocations[locationIndex].slots.push({ date: "", label: "" });
    setFormData({ ...formData, locations: newLocations });
  };

  const removeSlot = (locationIndex: number, slotIndex: number) => {
    const newLocations = [...formData.locations];
    newLocations[locationIndex].slots = newLocations[locationIndex].slots.filter((_, i) => i !== slotIndex);
    setFormData({ ...formData, locations: newLocations });
  };

  const updateSlot = (locationIndex: number, slotIndex: number, field: keyof ClinicSlot, value: string) => {
    const newLocations = [...formData.locations];
    newLocations[locationIndex].slots[slotIndex] = {
      ...newLocations[locationIndex].slots[slotIndex],
      [field]: value,
    };
    setFormData({ ...formData, locations: newLocations });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Activity Management
          </h1>
          <p className="text-slate-600">Create and manage clinics, camps, and pop-up training sessions</p>
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

        {/* Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Activity Config" : "Create New Activity Config"}</CardTitle>
            <CardDescription>
              {editingId ? "Update activity configuration" : "Add a new activity (clinic/camp/pop-up) with time slots and locations"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Activity Type *</Label>
                <Select
                  value={formData.type || "clinic"}
                  onValueChange={(v) => setFormData({ ...formData, type: v as "clinic" | "camp" | "pop-up" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinic">Clinic</SelectItem>
                    <SelectItem value="camp">Camp</SelectItem>
                    <SelectItem value="pop-up">Pop-up Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="season">Season *</Label>
                <Input
                  id="season"
                  value={formData.season}
                  onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                  placeholder="e.g. Winter Break 2025–26"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Winter Break Clinic"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description for the clinic"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked === true })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active (this will be the clinic shown to users)
              </Label>
            </div>

            {/* Locations */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Locations & Time Slots *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLocation}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
              </div>

              {formData.locations.map((location, locIndex) => (
                <Card key={locIndex} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <Input
                          placeholder="Location name (e.g. Bellevue Aquatic Center)"
                          value={location.name}
                          onChange={(e) => updateLocation(locIndex, "name", e.target.value)}
                          className="max-w-md"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLocation(locIndex)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {location.slots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Date (e.g. 2025-12-23)"
                            value={slot.date}
                            onChange={(e) => updateSlot(locIndex, slotIndex, "date", e.target.value)}
                          />
                          <Input
                            placeholder="Label (e.g. Tue Dec 23 — 1:00–3:00pm)"
                            value={slot.label}
                            onChange={(e) => updateSlot(locIndex, slotIndex, "label", e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlot(locIndex, slotIndex)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSlot(locIndex)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Time Slot
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Existing Configs */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-800">Existing Clinic Configs</h2>
          {loading ? (
            <p>Loading...</p>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No clinic configs found. Create one above.
              </CardContent>
            </Card>
          ) : (
            configs.map((config) => (
              <Card key={config.id} className={config.active ? "border-2 border-green-500" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {config.title}
                        {config.type && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                            {config.type}
                          </span>
                        )}
                        {config.active && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            Active
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{config.season}</CardDescription>
                      <div className="mt-3">
                        <div className="text-sm text-slate-600 mb-1 flex items-center gap-1">
                          <LinkIcon className="w-4 h-4" />
                          Poll Link:
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/survey/poll?id=${config.id}`}
                            className="text-xs font-mono bg-slate-50"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/survey/poll?id=${config.id}`;
                              navigator.clipboard.writeText(url);
                              setStatus({ message: "Poll link copied to clipboard!", success: true });
                              setTimeout(() => setStatus(null), 3000);
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/survey/clinic-result?season=${encodeURIComponent(config.season)}`)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Submissions
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => config.id && handleDelete(config.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {config.description && <p className="text-slate-600 mb-4">{config.description}</p>}
                  <div className="space-y-3">
                    {config.locations.map((loc, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                        <p className="font-semibold text-slate-800 mb-2">{loc.name}</p>
                        <div className="text-sm text-slate-600">
                          {loc.slots.length} time slot(s): {loc.slots.map((s) => s.label).join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

