"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../../hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, CheckCircle2, XCircle, Clock, User, Phone, Mail, Calendar } from "lucide-react";

interface StrokeTime {
  stroke: string;
  distance: string;
  time: string;
}

interface ClinicRegistration {
  id: string;
  // Basic Information
  childFirstName: string;
  childLastName: string;
  dateOfBirth: string;
  gender: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;

  // Swimming Background
  currentTeam: string;
  yearsOfSwimming: number;
  currentLevel: string;
  hasReferral: boolean;
  referralSource: string;

  // Stroke Times
  strokeTimes: StrokeTime[];

  // Additional Information
  hasCompetitionExperience: boolean;
  competitionDetails: string;
  goals: string;
  specialNeeds: string;

  // Metadata
  submittedAt: { seconds: number; nanoseconds: number } | string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  adminNotes?: string;
}

export default function ClinicRegistrationsPage() {
  const isAdmin = useIsAdminFromDB();
  const [registrations, setRegistrations] = useState<ClinicRegistration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<ClinicRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<ClinicRegistration | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isAdmin === true) {
      fetchRegistrations();
    }
  }, [isAdmin]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch("/api/clinic/registrations", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to load registrations");
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setFilteredRegistrations(data.registrations || []);
    } catch (err) {
      console.error("Load registrations error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = registrations;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.childFirstName.toLowerCase().includes(term) ||
          r.childLastName.toLowerCase().includes(term) ||
          r.parentEmail.toLowerCase().includes(term) ||
          r.currentTeam.toLowerCase().includes(term) ||
          r.currentLevel.toLowerCase().includes(term)
      );
    }

    setFilteredRegistrations(filtered);
  }, [searchTerm, statusFilter, registrations]);

  const formatDate = (date: { seconds: number; nanoseconds: number } | string | null) => {
    if (!date) return "N/A";
    try {
      if (typeof date === "string") {
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      if (date && typeof date === "object" && "seconds" in date) {
        return new Date(date.seconds * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      return "N/A";
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      reviewed: "secondary",
      accepted: "default",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleViewDetails = (registration: ClinicRegistration) => {
    setSelectedRegistration(registration);
    setNewStatus(registration.status);
    setAdminNotes(registration.adminNotes || "");
    setDetailDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRegistration || !newStatus) return;

    try {
      setUpdating(true);
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/clinic/registrations/${selectedRegistration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
          adminNotes: adminNotes.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      await fetchRegistrations();
      setStatusUpdateDialogOpen(false);
      setDetailDialogOpen(false);
      setSelectedRegistration(null);
    } catch (err) {
      console.error("Update status error:", err);
      alert("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <p className="text-center text-slate-500">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-20">
          <p className="text-center text-red-500">Access denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Clinic Registrations</h1>
          <p className="text-muted-foreground">View and manage clinic registration applications</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Registrations</CardTitle>
              <div className="flex items-center gap-4">
                <div className="w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, team..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {registrations.length === 0 ? "No registrations yet" : "No registrations match your filters"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Child Name</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Current Team</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Years</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>{formatDate(reg.submittedAt)}</TableCell>
                      <TableCell className="font-medium">
                        {reg.childFirstName} {reg.childLastName}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{reg.parentFirstName} {reg.parentLastName}</div>
                          <div className="text-muted-foreground">{reg.parentEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{reg.currentTeam}</TableCell>
                      <TableCell>{reg.currentLevel}</TableCell>
                      <TableCell>{reg.yearsOfSwimming}</TableCell>
                      <TableCell>{getStatusBadge(reg.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(reg)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registration Details</DialogTitle>
              <DialogDescription>
                {selectedRegistration && (
                  <>
                    {selectedRegistration.childFirstName} {selectedRegistration.childLastName}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedRegistration && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Basic Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Child Name</Label>
                      <p className="font-medium">
                        {selectedRegistration.childFirstName} {selectedRegistration.childLastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Date of Birth</Label>
                      <p>{selectedRegistration.dateOfBirth}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Gender</Label>
                      <p>{selectedRegistration.gender}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Parent Name</Label>
                      <p className="font-medium">
                        {selectedRegistration.parentFirstName} {selectedRegistration.parentLastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Email
                      </Label>
                      <p>{selectedRegistration.parentEmail}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Phone
                      </Label>
                      <p>{selectedRegistration.parentPhone}</p>
                    </div>
                  </div>
                </div>

                {/* Swimming Background */}
                <div>
                  <h3 className="font-semibold mb-3">Swimming Background</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Current Team</Label>
                      <p>{selectedRegistration.currentTeam}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Years of Swimming</Label>
                      <p>{selectedRegistration.yearsOfSwimming} years</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Current Level</Label>
                      <p className="font-medium">{selectedRegistration.currentLevel}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Has Referral</Label>
                      <p>{selectedRegistration.hasReferral ? "Yes" : "No"}</p>
                      {selectedRegistration.hasReferral && (
                        <p className="text-muted-foreground mt-1">
                          Source: {selectedRegistration.referralSource}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stroke Times */}
                {selectedRegistration.strokeTimes && selectedRegistration.strokeTimes.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Stroke Times</h3>
                    <div className="space-y-2">
                      {selectedRegistration.strokeTimes.map((st, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-sm">
                          <span className="font-medium w-32">{st.stroke} {st.distance}</span>
                          <span className="text-muted-foreground">{st.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div>
                  <h3 className="font-semibold mb-3">Additional Information</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Competition Experience</Label>
                      <p>{selectedRegistration.hasCompetitionExperience ? "Yes" : "No"}</p>
                      {selectedRegistration.hasCompetitionExperience && selectedRegistration.competitionDetails && (
                        <p className="text-muted-foreground mt-1">{selectedRegistration.competitionDetails}</p>
                      )}
                    </div>
                    {selectedRegistration.goals && (
                      <div>
                        <Label className="text-muted-foreground">Goals</Label>
                        <p className="text-muted-foreground">{selectedRegistration.goals}</p>
                      </div>
                    )}
                    {selectedRegistration.specialNeeds && (
                      <div>
                        <Label className="text-muted-foreground">Special Needs</Label>
                        <p className="text-muted-foreground">{selectedRegistration.specialNeeds}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Admin</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Status</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Admin Notes</Label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about this registration..."
                        rows={3}
                      />
                    </div>
                    <Button onClick={() => setStatusUpdateDialogOpen(true)} disabled={updating}>
                      Update Status
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Status Update Confirmation Dialog */}
        <Dialog open={statusUpdateDialogOpen} onOpenChange={setStatusUpdateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Status Update</DialogTitle>
              <DialogDescription>
                Are you sure you want to update the status to "{newStatus}"?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusUpdateDialogOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStatus} disabled={updating}>
                {updating ? "Updating..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

