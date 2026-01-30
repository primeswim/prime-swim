// app/clinics/page.tsx
"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Search, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

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
  id: string;
  season: string;
  title: string;
  type?: "clinic" | "camp" | "pop-up";
  description?: string;
  locations: ClinicLocation[];
  levels?: string[];
  active: boolean;
}

export default function ClinicsPage() {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<ClinicConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/clinic/config/public");
      if (!res.ok) throw new Error("Failed to load clinics");
      const data = await res.json();
      setClinics((data.configs || []) as ClinicConfig[]);
    } catch (err) {
      console.error("Load clinics error:", err);
      setError(err instanceof Error ? err.message : "Failed to load clinics");
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics.filter((clinic) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      clinic.title.toLowerCase().includes(query) ||
      clinic.season.toLowerCase().includes(query) ||
      clinic.description?.toLowerCase().includes(query) ||
      clinic.locations.some((loc) => loc.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Calendar className="w-10 h-10 text-blue-600" />
            Clinics & Training Programs
          </h1>
          <p className="text-slate-600 text-lg">
            Discover our upcoming clinics, camps, and training sessions. Register to secure your spot!
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by title, season, location, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-6 text-lg"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-8 text-center">
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        ) : filteredClinics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              {searchQuery ? (
                <>
                  <p className="text-lg mb-2">No clinics found matching your search.</p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                </>
              ) : (
                <p className="text-lg">No active clinics available at this time. Please check back later.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredClinics.map((clinic) => (
              <Card key={clinic.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-2xl">{clinic.title}</CardTitle>
                        {clinic.type && (
                          <Badge className="bg-blue-100 text-blue-700 capitalize">
                            {clinic.type}
                          </Badge>
                        )}
                        {clinic.active && (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        )}
                      </div>
                      <CardDescription className="text-lg font-semibold text-slate-700">
                        {clinic.season}
                      </CardDescription>
                      {clinic.description && (
                        <p className="mt-3 text-slate-600 whitespace-pre-line leading-relaxed">{clinic.description}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Locations & Time Slots */}
                  <div className="space-y-4 mb-6">
                    {clinic.locations.map((location, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-slate-800 text-lg">{location.name}</h3>
                        </div>
                        <div className="space-y-2">
                          {location.slots.map((slot, slotIdx) => (
                            <div key={slotIdx} className="flex items-center gap-2 text-slate-700">
                              <Clock className="w-4 h-4 text-slate-500" />
                              <span>{slot.label}</span>
                              {slot.date && (
                                <span className="text-sm text-slate-500">
                                  ({new Date(slot.date).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Registration Button */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-slate-600">
                      2 slots available
                    </div>
                    <Button
                      asChild
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
                    >
                      <Link href={`/clinic/register?id=${clinic.id}`}>
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Register Now
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

