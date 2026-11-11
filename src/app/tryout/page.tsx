"use client";

import type React from "react";
import Image from "next/image";
import Link from "next/link";
import HeroWater from "@/components/hero-water";
import styles from "./tryout.module.css";
import { useEffect, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Waves, AlertCircle } from "lucide-react";

import { emptyTryoutForm, swimmingDurations, tryoutWaiverVersion, validateTryout, type TryoutFormData } from "@/lib/tryout-form";

import { checkSwimmerBirthDate, maxSwimmerAge } from "@/lib/swimmer-age";
import { formatUSPhone } from "@/lib/us-phone";

export default function TryoutPage() {
  const [submitting, setSubmitting] = useState(false);
  const [formReady, setFormReady] = useState(false);

  useEffect(() => setFormReady(true), []);

  const [formData, setFormData] = useState<TryoutFormData>({ ...emptyTryoutForm });

  // Type-safe updater: value type depends on the field
  const handleInputChange = <K extends keyof TryoutFormData>(
    field: K,
    value: TryoutFormData[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "birthDate") {
        next.signerName = "";
        next.signerRole = "";
      }
      if (["birthDate", "firstName", "lastName", "signerName", "signerRole", "healthIssues"].includes(field)) {
        next.liabilityAccepted = false;
      }
      return next;
    });
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
        body: JSON.stringify({ ...formData, waiverVersion: tryoutWaiverVersion }),
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

  const { age, error: birthDateError } = checkSwimmerBirthDate(formData.birthDate);
  const validAge = age !== null;
  const isMinor = validAge && age < 18;
  const [birthYear = "", birthMonth = "", birthDay = ""] = formData.birthDate.split("-");
  const ageError = birthYear && birthMonth && birthDay ? birthDateError : null;
  const currentYear = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric",
  }).format());
  const birthDateFields = [
    { label: "Month", value: birthMonth, options: Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")) },
    { label: "Day", value: birthDay, options: Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")) },
    { label: "Year", value: birthYear, options: Array.from({ length: maxSwimmerAge + 2 }, (_, i) => String(currentYear - i)) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4" aria-labelledby="tryout-title">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 id="tryout-title">Schedule Your Tryout</h1>
            <p>Our coaches will get to know each swimmer and help find the right training level for their next step.</p>
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
                  <p className="text-sm text-slate-600">
                    A parent or legal guardian must complete and sign this form for swimmers under 18.
                    Swimmers 18 or older may register and sign for themselves.
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-700 font-medium">
                        Swimmer First Name *
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
                        Swimmer Last Name *
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

                  <fieldset disabled={!formReady} className="space-y-2" aria-describedby={ageError ? "tryout-birth-date-error" : undefined}>
                    <legend className="text-slate-700 font-medium">Swimmer Date of Birth *</legend>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {birthDateFields.map(({ label, value, options }, index) => (
                        <select
                          key={label}
                          aria-label={`Birth ${label.toLowerCase()}`}
                          aria-invalid={Boolean(ageError)}
                          value={value}
                          onChange={(event) => {
                            const parts = [birthMonth, birthDay, birthYear];
                            parts[index] = event.target.value;
                            const [month, day, year] = parts;
                            handleInputChange("birthDate", `${year}-${month}-${day}`);
                          }}
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                          required
                        >
                          <option value="">{label}</option>
                          {options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ))}
                    </div>
                    {ageError && <p id="tryout-birth-date-error" className="text-sm text-red-600">{ageError}</p>}
                  </fieldset>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700 font-medium">
                        {validAge ? (isMinor ? "Parent or Guardian Email" : "Swimmer Email") : "Contact Email"} *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-slate-700 font-medium">
                        {validAge ? (isMinor ? "Parent or Guardian Phone" : "Swimmer Phone") : "Contact Phone"} *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="206-555-0123"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", formatUSPhone(e.target.value))}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
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
                    <Label htmlFor="experience">How long has the swimmer been taking swimming lessons? *</Label>
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
                        <Label htmlFor="teamExperience">Has the swimmer trained with a swim team? *</Label>
                        <Select required value={formData.teamExperience} onValueChange={(teamExperience) => setFormData(prev => ({ ...prev, teamExperience, teamName: "", lessonNotes: "" }))}>
                          <SelectTrigger id="teamExperience"><SelectValue placeholder="Select an answer" /></SelectTrigger>
                          <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {formData.teamExperience === "yes" && (
                        <div className="space-y-2">
                          <Label htmlFor="teamName">Which swim team was the swimmer on? *</Label>
                          <Input id="teamName" required value={formData.teamName} onChange={e => handleInputChange("teamName", e.target.value)} placeholder="Swim team name" />
                        </div>
                      )}
                      {formData.teamExperience === "no" && (
                        <div className="space-y-2">
                          <Label htmlFor="lessonNotes">Tell us about the swimmer’s previous swimming lessons *</Label>
                          <Textarea id="lessonNotes" required value={formData.lessonNotes} onChange={e => handleInputChange("lessonNotes", e.target.value)} placeholder="For example: private lessons, group classes, or learning with family. Where and for how long?" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="healthIssues" className="text-slate-700 font-medium">
                      Swimmer Health and Safety (optional)
                    </Label>
                    <p id="healthIssues-help" className="text-sm text-slate-600">
                      Share any health conditions, allergies, or accommodations relevant to the swimmer’s safety during the tryout.
                    </p>
                    <Textarea
                      id="healthIssues"
                      aria-describedby="healthIssues-help"
                      value={formData.healthIssues}
                      onChange={(e) => handleInputChange("healthIssues", e.target.value)}
                      className="border-slate-300 focus:border-slate-500 min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-slate-700 font-medium">
                      Additional Notes About the Swimmer (optional)
                    </Label>
                    <p id="notes-help" className="text-sm text-slate-600">
                      Tell us about the swimmer’s goals or anything else the coaches should know before the tryout.
                    </p>
                    <Textarea
                      id="notes"
                      aria-describedby="notes-help"
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      className="border-slate-300 focus:border-slate-500 min-h-[100px]"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-bold text-amber-800 mb-3">TRYOUT RISKS, PARTICIPATION CONSENT, AND RELEASE OF LIABILITY</h4>
                    <div className="text-amber-800 text-sm space-y-3 mb-4">
                      <p>
                        <strong>1. Acknowledgment of Risks and Consent to Participate.</strong> I understand that the
                        tryout includes warm-up, an in-water swimming assessment, and related pool-deck activities.
                        Risks include fatigue from physical exertion, slips on wet surfaces, collisions with swimmers or equipment,
                        and water-related injuries, including drowning. I acknowledge these risks. If I am signing
                        as the minor swimmer’s parent or legal guardian, I give permission for the swimmer to
                        participate. If I am the swimmer and am 18 or older, I voluntarily agree to participate.
                      </p>
                      <p>
                        <strong>2. Release of Liability for Ordinary Negligence.</strong> To the extent permitted by
                        Washington law, I release Prime Swim Academy and its coaches and staff from my own claims
                        arising out of the swimmer’s participation in this tryout that I have the legal right to
                        waive. This includes, without limitation, claims for injury, illness, or other loss arising
                        from warm-up, in-water assessment, or related pool-deck activities, including claims based
                        on the ordinary negligence of Prime Swim Academy or its coaches or staff in conducting
                        those activities.
                      </p>
                      <p>
                        <strong>Right to report misconduct.</strong> This release does not apply to sexual harassment, sexual assault,
                        sexual abuse, or any other form of abuse. Nothing in these terms limits anyone’s right to
                        report suspected misconduct or abuse to law enforcement, the U.S. Center for SafeSport,
                        or another appropriate authority, or to cooperate with an investigation. See our
                        {" "}<Link href="/safesport#report" target="_blank" rel="noopener noreferrer" className="font-medium underline">Safe Sport reporting resources</Link>.
                      </p>
                      <p>
                        <strong>3. Health and Safety Disclosure.</strong> To the best of my knowledge, I have shared
                        with Prime Swim Academy any health conditions,
                        allergies, or accommodations relevant to the swimmer’s safe participation in the tryout.
                      </p>
                      <div>
                        <p className="mb-1"><strong>4. Swimmer Conduct and Pool Safety.</strong></p>
                        <ul className="list-disc space-y-1 pl-5">
                          <li>Treat coaches, instructors, staff, and other swimmers with respect.</li>
                          <li>Bullying, harassment, pushing, and rough play are prohibited in the water and on the pool deck.</li>
                          <li>Follow coaches’ and lifeguards’ safety instructions. Enter the water only when directed.</li>
                        </ul>
                        <p className="mt-2">If I am signing for a minor swimmer, I agree to review these rules with them before the tryout.</p>
                      </div>
                    </div>
                    <div className="space-y-4 text-sm text-amber-900">
                      <h5 className="font-bold">Electronic Signature</h5>
                      <p>
                        {!validAge
                          ? "Complete the swimmer’s date of birth above to choose who is signing."
                          : isMinor
                            ? "A parent or legal guardian must sign for the swimmer."
                            : "The swimmer must sign. A parent may help fill out the registration details."}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="signerName">Signer Full Name *</Label>
                          <Input id="signerName" value={formData.signerName} onChange={(e) => handleInputChange("signerName", e.target.value)} className="bg-white" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signerRole">Signing As *</Label>
                          <select id="signerRole" value={formData.signerRole} disabled={!validAge} onChange={(e) => handleInputChange("signerRole", e.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3" required>
                            <option value="">Select signing role</option>
                            {validAge && (isMinor ? (
                              <>
                                <option value="parent">Parent</option>
                                <option value="legal-guardian">Legal guardian</option>
                              </>
                            ) : (
                              <option value="swimmer">Swimmer (18 or older)</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={formData.liabilityAccepted}
                          onChange={(e) => handleInputChange("liabilityAccepted", e.target.checked)}
                          className="mt-1"
                          required
                        />
                        <span>I have read and understand these terms and electronically sign them using the name and role entered above.</span>
                      </label>
                      <p>Terms version: {tryoutWaiverVersion}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500">Complete all required fields (*) and signatures to submit. Our team will contact you to arrange your tryout.</p>
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
