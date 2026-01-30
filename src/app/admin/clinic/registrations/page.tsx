// app/admin/clinic/registrations/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, Users, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClinicRegistration {
  id: string;
  childFirstName: string;
  childLastName: string;
  dateOfBirth?: string;
  gender?: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  currentTeam?: string;
  yearsOfSwimming?: number;
  currentLevel?: string;
  hasReferral?: boolean;
  referralSource?: string;
  hasCompetitionExperience?: boolean;
  competitionDetails?: string;
  goals?: string;
  specialNeeds?: string;
  clinicId?: string | null;
  submittedAt: string | null;
  status?: string;
}

interface ClinicConfig {
  id: string;
  title: string;
  season?: string;
}

export default function ClinicRegistrationsPage() {
  const isAdmin = useIsAdminFromDB();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ClinicRegistration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [clinicConfigs, setClinicConfigs] = useState<ClinicConfig[]>([]);

  useEffect(() => {
    if (isAdmin === true) {
      loadClinicConfigs();
      loadRegistrations();
    }
  }, [isAdmin, selectedClinicId]);

  const loadClinicConfigs = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch("/api/clinic/config", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setClinicConfigs((data.configs || []) as ClinicConfig[]);
      }
    } catch (err) {
      console.error("Load clinic configs error:", err);
    }
  };

  const loadRegistrations = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const url = selectedClinicId === "all" 
        ? "/api/clinic/registrations"
        : `/api/clinic/registrations?clinicId=${encodeURIComponent(selectedClinicId)}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to load registrations");
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (err) {
      console.error("Load registrations error:", err);
      setError(err instanceof Error ? err.message : "Failed to load registrations");
    } finally {
      setLoading(false);
    }
  };

  // Note: SwimCloud requires USA Swimming ID for direct profile links.
  // This search URL will find the swimmer by name and redirect to their profile if found.
  const getSwimCloudUrl = (firstName: string, lastName: string) => {
    const encodedFirstName = encodeURIComponent(firstName.trim());
    const encodedLastName = encodeURIComponent(lastName.trim());
    return `https://www.swimcloud.com/results/swimmer/?first=${encodedFirstName}&last=${encodedLastName}`;
  };

  const getClinicName = (clinicId: string | null | undefined): string => {
    if (!clinicId) return "Unknown Clinic";
    const config = clinicConfigs.find((c) => c.id === clinicId);
    return config ? `${config.title}${config.season ? ` (${config.season})` : ""}` : clinicId;
  };

  const getUniqueClinicIds = () => {
    const ids = new Set<string>();
    registrations.forEach((reg) => {
      if (reg.clinicId) ids.add(reg.clinicId);
    });
    return Array.from(ids).sort();
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

  const uniqueClinicIds = getUniqueClinicIds();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Clinic Registrations
          </h1>
          <p className="text-slate-600">View and manage all clinic registrations</p>
        </div>

        {/* Filter by Clinic */}
        {uniqueClinicIds.length > 0 && (
          <div className="mb-6">
            <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filter by clinic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinics</SelectItem>
                {uniqueClinicIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {getClinicName(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              No registrations found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {registrations.map((reg) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {reg.childFirstName} {reg.childLastName}
                      </CardTitle>
                      <CardDescription>
                        Submitted: {reg.submittedAt ? new Date(reg.submittedAt).toLocaleString() : "Unknown"}
                        {reg.clinicId && (
                          <span className="ml-4 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {getClinicName(reg.clinicId)}
                          </span>
                        )}
                        {reg.status && (
                          <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                            reg.status === "accepted" ? "bg-green-100 text-green-700" :
                            reg.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {reg.status}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={getSwimCloudUrl(reg.childFirstName, reg.childLastName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Search on SwimCloud
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">Swimmer Information</h3>
                      <div className="space-y-1 text-slate-600">
                        <p><strong>Date of Birth:</strong> {reg.dateOfBirth || "N/A"}</p>
                        <p><strong>Gender:</strong> {reg.gender || "N/A"}</p>
                        <p><strong>Current Team:</strong> {reg.currentTeam || "N/A"}</p>
                        <p><strong>Years of Swimming:</strong> {reg.yearsOfSwimming || "N/A"}</p>
                        <p><strong>Current Level:</strong> {reg.currentLevel || "N/A"}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">Parent Information</h3>
                      <div className="space-y-1 text-slate-600">
                        <p><strong>Name:</strong> {reg.parentFirstName} {reg.parentLastName}</p>
                        <p><strong>Email:</strong> {reg.parentEmail}</p>
                        <p><strong>Phone:</strong> {reg.parentPhone}</p>
                        {reg.hasReferral && (
                          <p><strong>Referral:</strong> {reg.referralSource || "N/A"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {(reg.goals || reg.competitionDetails || reg.specialNeeds) && (
                    <div className="mt-4 pt-4 border-t">
                      <h3 className="font-semibold text-slate-800 mb-2">Additional Information</h3>
                      <div className="space-y-2 text-sm text-slate-600">
                        {reg.goals && (
                          <div>
                            <strong>Goals:</strong> <p className="mt-1">{reg.goals}</p>
                          </div>
                        )}
                        {reg.competitionDetails && (
                          <div>
                            <strong>Competition Experience:</strong> <p className="mt-1">{reg.competitionDetails}</p>
                          </div>
                        )}
                        {reg.specialNeeds && (
                          <div>
                            <strong>Special Needs:</strong> <p className="mt-1">{reg.specialNeeds}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

