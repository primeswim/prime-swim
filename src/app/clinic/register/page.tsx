"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Clock, Trophy, MessageSquare, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// Advanced levels for Clinic (not for beginners)
const CLINIC_LEVELS = [
  "Intermediate",
  "Advanced",
  "Competitive",
  "Elite/National Level",
  "College/University",
] as const;

interface StrokeTime {
  stroke: string;
  distance: string;
  time: string; // Format: MM:SS.mm or SS.mm
}

export default function ClinicRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Basic Information
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  // Swimming Background
  const [currentTeam, setCurrentTeam] = useState("");
  const [yearsOfSwimming, setYearsOfSwimming] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [referralSource, setReferralSource] = useState("");

  // Stroke Times
  const [strokeTimes, setStrokeTimes] = useState<StrokeTime[]>([
    { stroke: "Freestyle", distance: "50y", time: "" },
    { stroke: "Backstroke", distance: "50y", time: "" },
    { stroke: "Breaststroke", distance: "50y", time: "" },
    { stroke: "Butterfly", distance: "50y", time: "" },
    { stroke: "Individual Medley", distance: "100 IM", time: "" },
  ]);

  // Additional Information
  const [hasCompetitionExperience, setHasCompetitionExperience] = useState(false);
  const [competitionDetails, setCompetitionDetails] = useState("");
  const [goals, setGoals] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");

  const updateStrokeTime = (index: number, field: "stroke" | "distance" | "time", value: string) => {
    const updated = [...strokeTimes];
    updated[index] = { ...updated[index], [field]: value };
    setStrokeTimes(updated);
  };

  const validateTimeFormat = (time: string): boolean => {
    if (!time.trim()) return true; // Empty is allowed
    // Accept formats: MM:SS.mm, SS.mm, or SS:SS
    const patterns = [
      /^\d{1,2}:\d{2}\.\d{2}$/, // MM:SS.mm
      /^\d{1,2}:\d{2}$/, // MM:SS
      /^\d{1,2}\.\d{2}$/, // SS.mm
      /^\d+\.\d+$/, // Any decimal
    ];
    return patterns.some((pattern) => pattern.test(time));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!childFirstName || !childLastName || !dateOfBirth || !gender) {
      setError("Please fill in all required child information fields.");
      return;
    }

    if (!parentFirstName || !parentLastName || !parentEmail || !parentPhone) {
      setError("Please fill in all required parent information fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!currentTeam || !yearsOfSwimming || !currentLevel) {
      setError("Please fill in all swimming background fields.");
      return;
    }

    if (hasReferral && !referralSource) {
      setError("Please specify the referral source.");
      return;
    }

    // Validate stroke times format
    for (const st of strokeTimes) {
      if (st.time && !validateTimeFormat(st.time)) {
        setError(`Invalid time format for ${st.stroke} ${st.distance}. Please use format MM:SS.mm or SS.mm`);
        return;
      }
    }

    try {
      setLoading(true);

      const payload = {
        // Basic Information
        childFirstName: childFirstName.trim(),
        childLastName: childLastName.trim(),
        dateOfBirth,
        gender,
        parentFirstName: parentFirstName.trim(),
        parentLastName: parentLastName.trim(),
        parentEmail: parentEmail.trim().toLowerCase(),
        parentPhone: parentPhone.replace(/[^\d]/g, ""),

        // Swimming Background
        currentTeam: currentTeam.trim(),
        yearsOfSwimming: parseInt(yearsOfSwimming) || 0,
        currentLevel,
        hasReferral,
        referralSource: hasReferral ? referralSource.trim() : "",

        // Stroke Times (only include non-empty times)
        strokeTimes: strokeTimes.filter((st) => st.time.trim() !== ""),

        // Additional Information
        hasCompetitionExperience,
        competitionDetails: competitionDetails.trim(),
        goals: goals.trim(),
        specialNeeds: specialNeeds.trim(),

        submittedAt: new Date().toISOString(),
      };

      const response = await fetch("/api/clinic/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit registration");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-blue-600" />
            Clinic Registration
          </h1>
          <p className="text-slate-600">
            Register your swimmer for our Clinic program. Please provide detailed information to help us determine the appropriate level.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Registration submitted successfully! Redirecting to homepage...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Child and parent contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="childFirstName">Swimmer First Name *</Label>
                  <Input
                    id="childFirstName"
                    value={childFirstName}
                    onChange={(e) => setChildFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="childLastName">Swimmer Last Name *</Label>
                  <Input
                    id="childLastName"
                    value={childLastName}
                    onChange={(e) => setChildLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={gender} onValueChange={setGender} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Parent/Guardian Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="parentFirstName">Parent First Name *</Label>
                    <Input
                      id="parentFirstName"
                      value={parentFirstName}
                      onChange={(e) => setParentFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="parentLastName">Parent Last Name *</Label>
                    <Input
                      id="parentLastName"
                      value={parentLastName}
                      onChange={(e) => setParentLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="parentEmail">Parent Email *</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="parentPhone">Parent Phone *</Label>
                    <Input
                      id="parentPhone"
                      type="tel"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="(123) 456-7890"
                      required
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Swimming Background */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Swimming Background
              </CardTitle>
              <CardDescription>Help us understand your child's swimming experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currentTeam">Current Team/Club *</Label>
                <Input
                  id="currentTeam"
                  value={currentTeam}
                  onChange={(e) => setCurrentTeam(e.target.value)}
                  placeholder="e.g., Prime Swim Academy, Local Swim Club, etc."
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="yearsOfSwimming">Years of Swimming Experience *</Label>
                  <Select value={yearsOfSwimming} onValueChange={setYearsOfSwimming} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select years" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => i + 1).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year} {year === 1 ? "year" : "years"}
                        </SelectItem>
                      ))}
                      <SelectItem value="15+">15+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currentLevel">Current Level *</Label>
                  <Select value={currentLevel} onValueChange={setCurrentLevel} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINIC_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasReferral"
                    checked={hasReferral}
                    onCheckedChange={(checked) => setHasReferral(checked === true)}
                  />
                  <Label htmlFor="hasReferral" className="cursor-pointer">
                    I have a referral/recommendation
                  </Label>
                </div>
                {hasReferral && (
                  <div>
                    <Label htmlFor="referralSource">Referral Source *</Label>
                    <Input
                      id="referralSource"
                      value={referralSource}
                      onChange={(e) => setReferralSource(e.target.value)}
                      placeholder="Who referred you? (coach name, friend, etc.)"
                      required={hasReferral}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stroke Times */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Stroke Times (Optional but Recommended)
              </CardTitle>
              <CardDescription>
                Please provide your swimmer's best times for each stroke. Format: MM:SS.mm or SS.mm (e.g., 1:23.45 or 23.45)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strokeTimes.map((st, index) => (
                  <div key={`${st.stroke}-${st.distance}`} className="grid md:grid-cols-3 gap-4 items-end">
                    <div>
                      <Label>{st.stroke}</Label>
                      <Input value={st.distance} disabled className="bg-slate-50" />
                    </div>
                    <div>
                      <Label>Time (MM:SS.mm or SS.mm)</Label>
                      <Input
                        value={st.time}
                        onChange={(e) => updateStrokeTime(index, "time", e.target.value)}
                        placeholder="e.g., 1:23.45 or 23.45"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasCompetitionExperience"
                  checked={hasCompetitionExperience}
                  onCheckedChange={(checked) => setHasCompetitionExperience(checked === true)}
                />
                <Label htmlFor="hasCompetitionExperience" className="cursor-pointer">
                  Has competition experience
                </Label>
              </div>

              {hasCompetitionExperience && (
                <div>
                  <Label htmlFor="competitionDetails">Competition Details</Label>
                  <Textarea
                    id="competitionDetails"
                    value={competitionDetails}
                    onChange={(e) => setCompetitionDetails(e.target.value)}
                    placeholder="Please describe competition experience (meets attended, achievements, etc.)"
                    rows={3}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="goals">Goals & Expectations</Label>
                <Textarea
                  id="goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What are your goals for this clinic? What do you hope to achieve?"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="specialNeeds">Special Needs or Additional Information</Label>
                <Textarea
                  id="specialNeeds"
                  value={specialNeeds}
                  onChange={(e) => setSpecialNeeds(e.target.value)}
                  placeholder="Any special needs, medical conditions, or other information we should know?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Registration"
              )}
            </Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}



