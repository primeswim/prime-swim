"use client"

import type React from "react"
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Mail, MapPin, Phone, Calendar, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Header from "@/components/header";
import Footer from "@/components/footer";

interface TimeSlot {
  time: string
  type: "lesson" | "lap"
}

interface PoolOptions {
  [key: string]: TimeSlot[]
}

interface FormState {
  parentEmail: string
  swimmerName: string
  groupLevel: "bronze" | "silver-beginner" | "silver-performance" | ""
  preferences: {
    location: string
    timeSlots: string[]
  }[]
}

const poolOptions: PoolOptions = {
  "Mary Wayte Pool (Mercer Island)": [
    { time: "Mon 8–9pm", type: "lesson" },
    { time: "Tue 8–9pm", type: "lesson" },
    { time: "Wed 2:30–3:30pm", type: "lap" },
    { time: "Wed 8–9pm", type: "lesson" },
    { time: "Thu 8–9pm", type: "lesson" },
    { time: "Fri 8–9pm", type: "lesson" },
    { time: "Sat 8–9am", type: "lesson" }, // NEW
  ],
  "Redmond Pool (Redmond)": [
    { time: "Sat 4–5pm", type: "lesson" },
    { time: "Sat 5–6pm", type: "lesson" },
    { time: "Sat 6–7pm", type: "lesson" },
    { time: "Sun 4–5pm", type: "lesson" },
    { time: "Sun 5–6pm", type: "lesson" },
    { time: "Sun 6–7pm", type: "lesson" },
  ],
  "Bellevue Aquatic Center (Bellevue)": [
    { time: "Wed 1:30–2:30pm", type: "lap" },
    { time: "Wed 2:30–3:30pm", type: "lap" },
  ],
}

// weekly minimums by group
const REQUIRED_BY_GROUP: Record<Exclude<FormState["groupLevel"], "">, number> = {
  bronze: 2,
  "silver-beginner": 2,
  "silver-performance": 4,
}

function getRequired(level: FormState["groupLevel"]) {
  if (!level || !(level in REQUIRED_BY_GROUP)) return null
  return REQUIRED_BY_GROUP[level as keyof typeof REQUIRED_BY_GROUP]
}

export default function TrainingSurvey() {
  const [form, setForm] = useState<FormState>({
    parentEmail: "",
    swimmerName: "",
    groupLevel: "",
    preferences: [],
  })

  // how many spots selected (all pools combined)
  const selectedCount = useMemo(
    () => form.preferences.reduce((sum, p) => sum + p.timeSlots.length, 0),
    [form.preferences]
  )
  const required = getRequired(form.groupLevel)
  const meetsMinimum = required != null ? selectedCount >= required : false

  // ✅ typed generic to remove "any"
  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // 后备拦截：Silver Beginner / Silver Performance 都不允许选择 Redmond（UI 已隐藏，这里再双保险）
  const updatePreference = (location: string, time: string) => {
    if (
      (form.groupLevel === "silver-beginner" || form.groupLevel === "silver-performance") &&
      location === "Redmond Pool (Redmond)"
    ) {
      return;
    }
    setForm((prev) => {
      const existing = prev.preferences.find((p) => p.location === location)
      const newPreferences = existing
        ? prev.preferences.map((p) =>
            p.location === location
              ? {
                  ...p,
                  timeSlots: p.timeSlots.includes(time) ? p.timeSlots.filter((t) => t !== time) : [...p.timeSlots, time],
                }
              : p,
          )
        : [...prev.preferences, { location, timeSlots: [time] }]
      return { ...prev, preferences: newPreferences }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addDoc(collection(db, "trainingSurveys"), {
        ...form,
        submittedAt: new Date(),
      });
      alert("Survey submitted. Thank you!");
      setForm({
        parentEmail: "",
        swimmerName: "",
        groupLevel: "",
        preferences: [],
      })
    } catch (err) {
      console.error(err)
      alert("Failed to submit survey.")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={100}
              height={100}
              className="mx-auto mb-6 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">
            Fall 2025 Bronze & Silver Training Schedule
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-2 font-light">
            Help us plan the best training schedule for Bronze & Silver swimmers
          </p>
          {/* Removed the static blue banner. Dynamic notice appears after group selection below. */}
        </div>
      </section>

      {/* Survey Form */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800 text-center flex items-center justify-center">
                  <Calendar className="w-6 h-6 mr-2" />
                  Training Preferences (Bronze / Silver)
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Please provide your details and choose preferred locations and times.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Section 1: Swimmer & Parent Info */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        1
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Swimmer & Parent Information</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="parentEmail" className="text-slate-700 font-medium">
                          Parent Email *
                        </Label>
                        <Input
                          id="parentEmail"
                          type="email"
                          value={form.parentEmail}
                          onChange={(e) => handleChange("parentEmail", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="swimmerName" className="text-slate-700 font-medium">
                          Swimmer Name *
                        </Label>
                        <Input
                          id="swimmerName"
                          value={form.swimmerName}
                          onChange={(e) => handleChange("swimmerName", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="groupLevel" className="text-slate-700 font-medium">
                        Current Group Level *
                      </Label>
                      <Select
                        value={form.groupLevel}
                        onValueChange={(value) => handleChange("groupLevel", value as FormState["groupLevel"])}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">Bronze</SelectItem>
                          <SelectItem value="silver-beginner">Silver Beginner</SelectItem>
                          <SelectItem value="silver-performance">Silver Performance</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Dynamic minimum notice */}
                      {form.groupLevel && required !== null && (
                        <div
                          className={[
                            "mt-3 rounded-xl border px-4 py-3 text-sm md:text-base flex items-start gap-3",
                            meetsMinimum
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-red-50 border-red-200 text-red-800"
                          ].join(" ")}
                        >
                          {meetsMinimum ? (
                            <CheckCircle2 className="w-5 h-5 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 mt-0.5" />
                          )}
                          <div>
                            <strong>
                              {form.groupLevel === "bronze" && "Bronze"}
                              {form.groupLevel === "silver-beginner" && "Silver Beginner"}
                              {form.groupLevel === "silver-performance" && "Silver Performance"}
                            </strong>{" "}
                            requires <strong>{required}x/week</strong>. Please select at least{" "}
                            <strong>{required}</strong> preferred time slots.
                            <div className="mt-1">
                              Selected:{" "}
                              <span className={meetsMinimum ? "font-semibold" : "font-extrabold underline"}>
                                {selectedCount}
                              </span>{" "}
                              / {required}     Selecting more than <strong>{required}</strong> slots is encouraged to help us schedule.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Section 2: Availability Preferences */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        2
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-600" />
                        Availability Preferences
                      </h3>
                    </div>

                    {Object.entries(poolOptions).map(([location, slots]) => {
                      // ❌ Silver Beginner & Silver Performance 不显示 Redmond
                      if (
                        (form.groupLevel === "silver-beginner" || form.groupLevel === "silver-performance") &&
                        location === "Redmond Pool (Redmond)"
                      ) {
                        return null;
                      }

                      // ✅ Bellevue 只在 Silver Performance 时显示
                      if (location === "Bellevue Aquatic Center (Bellevue)" && form.groupLevel !== "silver-performance") {
                        return null;
                      }

                      // 组别可见时段过滤
                      const visibleSlots = slots.filter((slot) => {
                        if (!form.groupLevel) return false; // 未选组别先不显示
                        if (["bronze", "silver-beginner"].includes(form.groupLevel)) return slot.type === "lesson";
                        if (form.groupLevel === "silver-performance") return slot.type === "lesson" || slot.type === "lap";
                        return false;
                      });

                      if (visibleSlots.length === 0) return null;

                      return (
                        <div key={location} className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                          <h4 className="text-lg font-semibold text-slate-800">{location}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {visibleSlots.map(({ time, type }) => (
                              <div key={`${location}-${time}-${type}`} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${location}-${time}-${type}`}
                                  checked={!!form.preferences.find(
                                    (p) => p.location === location && p.timeSlots.includes(time)
                                  )}
                                  onCheckedChange={() => updatePreference(location, time)}
                                  className="border-slate-300 data-[state=checked]:bg-slate-800 data-[state=checked]:text-white"
                                />
                                <Label htmlFor={`${location}-${time}-${type}`} className="text-slate-700">
                                  {time}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    Submit Preferences
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
  )
}
