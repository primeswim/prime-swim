"use client"

import type React from "react"
import Image from "next/image"
import { useMemo, useState } from "react"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Calendar, MapPin, User, AlertTriangle, CheckCircle2, Phone } from "lucide-react"

/** Clinic slot model */
interface ClinicSlot {
  date: string
  label: string
}

type LocationName =
  | "Mary Wayte Pool (Mercer Island)"
  | "Bellevue Aquatic Center (Bellevue)"
  | "Julius Boehm Pool (Issaquah)"

const CLINIC_OPTIONS: Partial<Record<LocationName, ClinicSlot[]>> = {
  "Bellevue Aquatic Center (Bellevue)": [
    { date: "2025-12-23", label: "Tue Dec 23 — 1:00–3:00pm" },
    { date: "2025-12-26", label: "Fri Dec 26 — 1:00–3:00pm" },
    { date: "2025-12-30", label: "Tue Dec 30 — 1:00–3:00pm" },
    { date: "2026-01-02", label: "Fri Jan 2 — 1:00–3:00pm" },
  ],
}

type Level =
  | "beginner-kicks-bubbles"
  | "novice-25y-freestyle"
  | "intermediate-4-strokes-basic"
  | "advanced-legal-4-strokes"

interface Preference {
  location: LocationName
  selections: string[]
}

interface FormState {
  parentEmail: string
  parentPhone: string            // ✅ 新增
  swimmerName: string
  level: Level | ""
  preferences: Preference[]
}

const MIN_SUGGESTED_CHOICES = 2

export default function ClinicSurveyPage() {
  const [form, setForm] = useState<FormState>({
    parentEmail: "",
    parentPhone: "",             // ✅ 初始值
    swimmerName: "",
    level: "",
    preferences: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [honeypot, setHoneypot] = useState("")

  const totalSelected = useMemo(
    () => form.preferences.reduce((sum, p) => sum + p.selections.length, 0),
    [form.preferences]
  )
  const meetsSuggested = totalSelected >= MIN_SUGGESTED_CHOICES

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleSelection = (location: LocationName, slotLabel: string) => {
    setForm((prev) => {
      const existing = prev.preferences.find((p) => p.location === location)
      if (!existing) {
        return { ...prev, preferences: [...prev.preferences, { location, selections: [slotLabel] }] }
      }
      const already = existing.selections.includes(slotLabel)
      const nextSelections = already
        ? existing.selections.filter((s) => s !== slotLabel)
        : [...existing.selections, slotLabel]
      return {
        ...prev,
        preferences: prev.preferences.map((p) =>
          p.location === location ? { ...p, selections: nextSelections } : p
        ),
      }
    })
  }

  const selectAllForLocation = (location: LocationName) => {
    const slots = CLINIC_OPTIONS[location] ?? []
    const allLabels = slots.map((s) => s.label)
    setForm((prev) => {
      const exists = prev.preferences.find((p) => p.location === location)
      if (!exists) {
        return { ...prev, preferences: [...prev.preferences, { location, selections: allLabels }] }
      }
      return {
        ...prev,
        preferences: prev.preferences.map((p) =>
          p.location === location ? { ...p, selections: allLabels } : p
        ),
      }
    })
  }

  const clearLocation = (location: LocationName) => {
    setForm((prev) => ({
      ...prev,
      preferences: prev.preferences.map((p) =>
        p.location === location ? { ...p, selections: [] } : p
      ),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // ✅ 前端必填校验 + 简单号码校验（10–15位数字）
    const digits = form.parentPhone.replace(/[^\d]/g, "")
    if (!form.level || !form.parentEmail || !form.swimmerName || !form.parentPhone) {
      alert("Please complete required fields.")
      return
    }
    if (digits.length < 10 || digits.length > 15) {
      alert("Please enter a valid phone number (10–15 digits).")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/clinic/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          season: "Winter Break 2025–26",
          website: honeypot,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Submit failed")

      alert("Thanks! Your clinic preferences have been submitted.")
      setForm({ parentEmail: "", parentPhone: "", swimmerName: "", level: "", preferences: [] }) // ✅ 重置 parentPhone
      setHoneypot("")
    } catch (err: any) {
      alert(err?.message || "Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />

      {/* Hero */}
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
            Winter Break Clinic Preferences
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-2 font-light">
            Tell us which clinic days/times work during Winter Break 2025–26
          </p>
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 text-blue-800 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 5a7 7 0 110 14a7 7 0 010-14z" />
            </svg>
            <div className="text-sm md:text-base">
              <strong>We encourage swimmers to attend every day if scheduling allows.</strong>{" "}
              Please select <em>all</em> dates that work for you — more choices help us open lanes and assign coaches.
            </div>
          </div>
          <p className="text-slate-500 mt-1">
            This form collects interest & availability; it is <span className="font-semibold">not</span> a final registration.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800 text-center flex items-center justify-center">
                  <Calendar className="w-6 h-6 mr-2" />
                  Winter Clinic — Interest Survey
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Parent email, phone, swimmer info, location & time preferences
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-10">
                  {/* 1. Parent & Swimmer */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        1
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        Parent & Swimmer
                      </h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="parentEmail">Parent Email *</Label>
                        <Input
                          id="parentEmail"
                          type="email"
                          required
                          value={form.parentEmail}
                          onChange={(e) => handleChange("parentEmail", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>

                      {/* ✅ 新增「家长电话」 */}
                      <div className="space-y-2">
                        <Label htmlFor="parentPhone">Parent Phone *</Label>
                        <div className="relative">
                          <Input
                            id="parentPhone"
                            type="tel"
                            inputMode="tel"
                            required
                            placeholder="e.g. 206-555-1234"
                            value={form.parentPhone}
                            onChange={(e) => handleChange("parentPhone", e.target.value)}
                            className="border-slate-300 focus:border-slate-500 pr-10"
                          />
                          <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-500">Digits only are fine; we’ll normalize it.</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="swimmerName">Swimmer Name *</Label>
                        <Input
                          id="swimmerName"
                          required
                          value={form.swimmerName}
                          onChange={(e) => handleChange("swimmerName", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="level">Swimmer Level *</Label>
                      <Select
                        value={form.level}
                        onValueChange={(v) => handleChange("level", v as Level)}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner-kicks-bubbles">
                            Beginner (know kicks & bubbles)
                          </SelectItem>
                          <SelectItem value="novice-25y-freestyle">
                            Novice (25y freestyle unassisted)
                          </SelectItem>
                          <SelectItem value="intermediate-4-strokes-basic">
                            Intermediate (basic 4 strokes)
                          </SelectItem>
                          <SelectItem value="advanced-legal-4-strokes">
                            Advanced (legal 4 strokes & turns)
                          </SelectItem>
                        </SelectContent>
                      </Select>

                    </div>
                  </div>

                  <Separator />

                  {/* 2. Location & Time preferences */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        2
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                        Location & Time Preferences
                      </h3>
                    </div>

                    <p className="text-slate-600">
                      <strong>We encourage daily attendance if your schedule allows.</strong>{" "}
                      Select <em>all</em> dates that work (use “Select all” per location for convenience).
                    </p>

                    {(Object.keys(CLINIC_OPTIONS) as LocationName[]).map((location) => {
                      const slots = CLINIC_OPTIONS[location]
                      if (!slots?.length) return null

                      const chosen = form.preferences.find((p) => p.location === location)?.selections ?? []
                      const allSelected = chosen.length === slots.length && slots.length > 0

                      return (
                        <div key={location} className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-lg font-semibold text-slate-800">{location}</h4>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9"
                                onClick={() => selectAllForLocation(location)}
                              >
                                {allSelected ? "All Selected" : "Select All"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9"
                                onClick={() => clearLocation(location)}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {slots.map((s, idx) => {
                              const id = `${location}-${idx}-${s.label}`
                              const checked = chosen.includes(s.label)
                              return (
                                <div key={id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={() => toggleSelection(location, s.label)}
                                    className="border-slate-300 data-[state=checked]:bg-slate-800 data-[state=checked]:text-white"
                                  />
                                  <Label htmlFor={id} className="text-slate-700">{s.label}</Label>
                                </div>
                              )
                            })}
                          </div>

                          <div className="text-sm text-slate-500">Selected here: <strong>{chosen.length}</strong> / {slots.length}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* dynamic hint */}
                  <div
                    className={[
                      "rounded-xl border px-4 py-3 text-sm md:text-base flex items-start gap-3",
                      meetsSuggested
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-amber-50 border-amber-200 text-amber-800",
                    ].join(" ")}
                  >
                    {meetsSuggested ? (
                      <CheckCircle2 className="w-5 h-5 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 mt-0.5" />
                    )}
                    <div>
                      You’ve selected <strong>{totalSelected}</strong> time(s). We <strong>encourage daily attendance</strong>—feel free to
                      select all dates that work.
                      {!meetsSuggested && <> Choosing at least <strong>{MIN_SUGGESTED_CHOICES}</strong> helps us plan lanes & staffing.</>}
                    </div>
                  </div>

                  {/* Honeypot（隐藏字段，正常用户不会填写） */}
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                    className="hidden"
                  />

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    {submitting ? "Submitting..." : "Submit Clinic Preferences"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
