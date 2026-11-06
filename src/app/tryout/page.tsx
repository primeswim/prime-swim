"use client";

import type React from "react";
import Image from "next/image";
import HeroWater from "@/components/hero-water";
import styles from "./tryout.module.css";
import { useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Waves, AlertCircle } from "lucide-react";

import { emptyTryoutForm, swimmingDurations, validateTryout, type TryoutFormData } from "@/lib/tryout-form";

export default function TryoutPage() {
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<TryoutFormData>({ ...emptyTryoutForm });

  // Type-safe updater: value type depends on the field
  const handleInputChange = <K extends keyof TryoutFormData>(
    field: K,
    value: TryoutFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTryout(formData);
    if (err) {
      alert(err);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/tryout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg =
          payload?.message ||
          payload?.error ||
          "There was an error. Please try again later.";
        alert(`❌ ${msg}`);
        return;
      }

      const result = await res.json();
      alert(result.confirmationEmailSent
        ? "✅ Your tryout request was received! A confirmation email has been sent. Our team will contact you to arrange your tryout."
        : "✅ Your tryout request was received! We could not send the confirmation email, but your request is saved. Our team will contact you to arrange your tryout.");
      setFormData({ ...emptyTryoutForm });
    } catch (error) {
      console.error(error);
      alert("❌ There was an error submitting the form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4" aria-labelledby="tryout-title">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 id="tryout-title">Schedule Your Tryout</h1>
            <p>Our coaches will get to know your swimmer and help find the right training level for their next step.</p>
            <a className={styles.heroLink} href="#tryout-registration">Schedule a Tryout <span aria-hidden="true">→</span></a>
          </div>
          <div className={styles.heroPhoto}>
            <Image src="/images/tryout-coaching.jpg" alt="A coach guiding a young swimmer with kickboards in the pool" width={1168} height={874} priority sizes="(max-width: 767px) 100vw, 55vw" />
            <HeroWater src="/images/tryout-coaching.jpg" className={styles.water} />
          </div>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">What to Expect</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Skill Assessment</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Our coaches will evaluate your current swimming abilities, stroke technique, and endurance level to
                determine the best program fit.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 30-minute evaluation</p>
                <p>• Technique analysis</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Meet the Coaches</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Get to know our expert coaching staff and learn about our training philosophy and approach to swimmer
                development.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• Coach introduction</p>
                <p>• Training methodology</p>
                <p>• Q&A session</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Program Placement</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Based on your assessment, we&apos;ll recommend the ideal program level and provide a personalized training
                plan.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• Personalized recommendation</p>
                <p>• Training plan overview</p>
                <p>• Goal setting session</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tryout Form Section */}
      <section id="tryout-registration" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Schedule Your Tryout</h2>
              <p className="text-lg text-slate-600">
                Fill out the form below and we&apos;ll contact you to confirm your tryout appointment
              </p>
            </div>

            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800 text-center">
                  Tryout Registration Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-700 font-medium">
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-slate-700 font-medium">
                        Last Name *
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700 font-medium">
                        Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700 font-medium">
                        Phone Number *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-slate-700 font-medium">
                        Age *
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        min="4"
                        max="20"
                        value={formData.age}
                        onChange={(e) => handleInputChange("age", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="program" className="text-slate-700 font-medium">
                        Interested Program *
                      </Label>
                      <Select
                        required
                        value={formData.program}
                        onValueChange={(value) => handleInputChange("program", value)}
                      >
                        <SelectTrigger id="program" className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">Bronze (Beginner)</SelectItem>
                          <SelectItem value="silver">Silver (Intermediate)</SelectItem>
                          <SelectItem value="gold">Gold (Advanced)</SelectItem>
                          <SelectItem value="platinum">Platinum (Pre-Elite)</SelectItem>
                          <SelectItem value="olympic">Olympic (Elite)</SelectItem>
                          <SelectItem value="unsure">Not Sure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="experience">How long have you been learning to swim? *</Label>
                    <Select required value={formData.experience} onValueChange={(experience) => setFormData(prev => ({ ...prev, experience, teamExperience: "", teamName: "", lessonNotes: "" }))}>
                      <SelectTrigger id="experience"><SelectValue placeholder="Select swimming experience" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(swimmingDurations).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.experience && formData.experience !== "none" && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="teamExperience">Have you trained with a swim team? *</Label>
                        <Select required value={formData.teamExperience} onValueChange={(teamExperience) => setFormData(prev => ({ ...prev, teamExperience, teamName: "", lessonNotes: "" }))}>
                          <SelectTrigger id="teamExperience"><SelectValue placeholder="Select an answer" /></SelectTrigger>
                          <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {formData.teamExperience === "yes" && (
                        <div className="space-y-2">
                          <Label htmlFor="teamName">Which swim team were you on? *</Label>
                          <Input id="teamName" required value={formData.teamName} onChange={e => handleInputChange("teamName", e.target.value)} placeholder="Swim team name" />
                        </div>
                      )}
                      {formData.teamExperience === "no" && (
                        <div className="space-y-2">
                          <Label htmlFor="lessonNotes">Tell us about your previous swimming lessons *</Label>
                          <Textarea id="lessonNotes" required value={formData.lessonNotes} onChange={e => handleInputChange("lessonNotes", e.target.value)} placeholder="For example: private lessons, group classes, or learning with family. Where and for how long?" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="healthIssues" className="text-slate-700 font-medium">
                      Any Health Issues or Special Considerations
                    </Label>
                    <Textarea
                      id="healthIssues"
                      value={formData.healthIssues}
                      onChange={(e) => handleInputChange("healthIssues", e.target.value)}
                      placeholder="Please share any medical conditions, allergies, or special needs we should be aware of..."
                      className="border-slate-300 focus:border-slate-500 min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-slate-700 font-medium">
                      Additional Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      placeholder="Tell us about your swimming goals, any medical conditions, or special requirements..."
                      className="border-slate-300 focus:border-slate-500 min-h-[100px]"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-bold text-amber-800 mb-3">ASSUMPTION OF RISK AND RELEASE OF LIABILITY</h4>
                    <div className="text-amber-800 text-sm max-h-40 overflow-y-auto space-y-2 mb-4">
                      <p>
                        <strong>1.</strong> I understand that swimming tryouts involve physical activity and the
                        inherent risk of injury. I voluntarily accept full responsibility for any risk or harm that may
                        arise during participation.
                      </p>
                      <p>
                        <strong>2.</strong> I release Prime Swim Academy and its staff from any and all liability for
                        injury, illness, or damages that may occur as a result of my or my child’s participation in
                        tryouts.
                      </p>
                      <p>
                        <strong>3.</strong> I certify that I or my child is physically fit to participate in the
                        swimming tryout and that I have disclosed any relevant health conditions.
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id="liabilityAccepted"
                        checked={formData.liabilityAccepted}
                        onChange={(e) => handleInputChange("liabilityAccepted", e.target.checked)}
                        className="mt-1"
                        required
                      />
                      <label htmlFor="liabilityAccepted" className="text-sm text-amber-800 font-medium">
                        I have read and agree to the above waiver of liability.
                      </label>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500">Complete all required fields (*) and accept the waiver to submit. Our team will contact you to arrange your tryout.</p>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || validateTryout(formData) !== null}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    {submitting ? "Submitting..." : "Schedule My Tryout"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
