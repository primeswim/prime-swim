"use client"

import type React from "react"
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Mail, MapPin, Phone, Calendar, User, Clock } from 'lucide-react'
import Header from "@/components/header";

interface TimeSlot {
  time: string
  type: string
}

interface PoolOptions {
  [key: string]: TimeSlot[]
}

interface FormState {
  parentEmail: string
  swimmerName: string
  groupLevel: string
  preferences: {
    location: string
    timeSlots: string[]
  }[]
  timesPerWeek: number
}

const poolOptions: PoolOptions = {
  "Mary Wayte": [
    { time: "Mon 8–9pm", type: "lesson" },
    { time: "Tue 8–9pm", type: "lesson" },
    { time: "Wed 2:30–3:30pm", type: "lap" },
    { time: "Wed 8–9pm", type: "lesson" },
    { time: "Thu 8–9pm", type: "lesson" },
  ],
  Redmond: [
    { time: "Sat 4–5pm", type: "lesson" },
    { time: "Sat 5–6pm", type: "lesson" },
    { time: "Sat 6–7pm", type: "lesson" },
    { time: "Sun 4–5pm", type: "lesson" },
    { time: "Sun 5–6pm", type: "lesson" },
    { time: "Sun 6–7pm", type: "lesson" },
  ],
  "Julius Boehm": [],
}

export default function TrainingSurvey() {
  const [form, setForm] = useState<FormState>({
    parentEmail: "",
    swimmerName: "",
    groupLevel: "",
    preferences: [],
    timesPerWeek: 1,
  })

  const handleChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updatePreference = (location: string, time: string) => {
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
      // Uncomment and configure Firebase if you want to use it
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
        timesPerWeek: 1,
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
            Fall 2025 Training Survey
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Help us plan the best training schedule for your swimmer
          </p>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Your feedback is crucial for optimizing our Fall 2025 training programs. Please fill out this survey to
            indicate your preferences for locations and times.
          </p>
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
                  Training Preferences
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Please provide your details and preferences for the upcoming training season.
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
                      <Select value={form.groupLevel} onValueChange={(value) => handleChange("groupLevel", value)}>
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">Bronze</SelectItem>
                          <SelectItem value="silver-beginner">Silver Beginner</SelectItem>
                          <SelectItem value="silver-performance">Silver Performance</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                        </SelectContent>
                      </Select>
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

                    {Object.entries(poolOptions).map(([location, slots]) => (
                      <div key={location} className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                        <h4 className="text-lg font-semibold text-slate-800">{location}</h4>
                        {slots.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">
                            Times not available yet for this location. Please select preferred days.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {slots
                              .filter((slot) => {
                                if (!form.groupLevel) return true
                                if (["bronze", "silver-beginner", "silver-performance"].includes(form.groupLevel))
                                  return slot.type === "lesson"
                                if (form.groupLevel === "gold") return slot.type === "lap"
                                return true
                              })
                              .map(({ time }) => (
                                <div key={time} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${location}-${time}`}
                                    checked={!!form.preferences.find(
                                      (p) => p.location === location && p.timeSlots.includes(time),
                                    )}
                                    onCheckedChange={() => updatePreference(location, time)}
                                    className="border-slate-300 data-[state=checked]:bg-slate-800 data-[state=checked]:text-white"
                                  />
                                  <Label htmlFor={`${location}-${time}`} className="text-slate-700">
                                    {time}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="space-y-2">
                      <Label htmlFor="timesPerWeek" className="text-slate-700 font-medium">
                        Preferred Times Per Week *
                      </Label>
                      <Select
                        value={String(form.timesPerWeek)}
                        onValueChange={(val) => handleChange("timesPerWeek", parseInt(val))}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-slate-500 max-w-xs">
                          <SelectValue placeholder="1" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((num) => (
                            <SelectItem key={num} value={String(num)}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    Submit Survey
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <Image
                  src="/placeholder.svg?height=50&width=50"
                  alt="Prime Swim Academy Logo"
                  width={50}
                  height={50}
                  className="rounded-full"
                />
                <span className="text-xl font-bold">Prime Swim Academy</span>
              </div>
              <p className="text-slate-300 mb-6 max-w-md">
                Excellence in swimming instruction. Building confidence, technique, and champions one stroke at a time.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
              <div className="space-y-3 text-slate-300">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-3" />
                  <span className="text-sm">(401) 402-0052</span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-3" />
                  <span className="text-sm">prime.swim.us@gmail.com</span>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 mr-3 mt-1" />
                  <span className="text-sm">Bellevue, Washington</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2 text-slate-300">
                <Link href="/tryout" className="block text-sm hover:text-white transition-colors">
                  Schedule Tryout
                </Link>
                <Link href="/news" className="block text-sm hover:text-white transition-colors">
                  Latest News
                </Link>
                <Link href="/#programs" className="block text-sm hover:text-white transition-colors">
                  Programs
                </Link>
                <Link href="/#coaches" className="block text-sm hover:text-white transition-colors">
                  Our Coaches
                </Link>
                <Link href="/#schedule" className="block text-sm hover:text-white transition-colors">
                  Schedules
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 mt-12 pt-8 text-center">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Prime Swim Academy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
