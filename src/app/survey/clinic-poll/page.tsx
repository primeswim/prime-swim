// ./src/app/survey/clinic-poll/page.tsx
"use client"

import type React from "react"
import Image from "next/image"
import { useMemo, useState, useEffect } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, MapPin, User, AlertTriangle, CheckCircle2, Phone, Loader2 } from "lucide-react"
import { SWIMMER_LEVELS, type SwimmerLevel, LEVEL_GROUPS } from "@/lib/swimmer-levels"

/** Clinic slot model */
interface ClinicSlot {
  date: string
  label: string
  time?: string
}

interface ClinicLocation {
  name: string
  slots: ClinicSlot[]
}

interface ClinicConfig {
  id?: string
  season: string
  title: string
  description?: string
  locations: ClinicLocation[]
  levels?: string[]
  active: boolean
}

interface Preference {
  location: string
  selections: string[]
}

interface FormState {
  parentEmail: string
  parentPhone: string
  swimmerName: string
  level: SwimmerLevel | ""
  preferences: Preference[]
}

interface SwimmerInfo {
  id: string
  childFirstName: string
  childLastName: string
  parentFirstName?: string
  parentLastName?: string
  parentEmail?: string
  parentPhone?: string
  level?: string
}

type SubmitResponse = { error?: string }

const MIN_SUGGESTED_CHOICES = 2

export default function ClinicSurveyPage() {
  const [config, setConfig] = useState<ClinicConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null)
  const [swimmers, setSwimmers] = useState<SwimmerInfo[]>([])
  const [selectedSwimmerId, setSelectedSwimmerId] = useState<string>("")
  const [form, setForm] = useState<FormState>({
    parentEmail: "",
    parentPhone: "",
    swimmerName: "",
    level: "",
    preferences: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const [autoFilled, setAutoFilled] = useState(false)

  // Load active clinic config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/clinic/config/active")
        if (!res.ok) throw new Error("Failed to load clinic config")
        const data = await res.json()
        if (data.config) {
          setConfig(data.config)
        }
      } catch (err) {
        console.error("Load config error:", err)
      } finally {
        setLoadingConfig(false)
      }
    }
    loadConfig()
  }, [])

  // Load user and swimmers if logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser({ uid: u.uid, email: u.email })
        // Load swimmers
        try {
          const swimmerQuery = query(collection(db, "swimmers"), where("parentUID", "==", u.uid))
          const snapshot = await getDocs(swimmerQuery)
          const swimmerData: SwimmerInfo[] = []
          snapshot.forEach((doc) => {
            const data = doc.data()
            swimmerData.push({
              id: doc.id,
              childFirstName: data.childFirstName || "",
              childLastName: data.childLastName || "",
              parentFirstName: data.parentFirstName || "",
              parentLastName: data.parentLastName || "",
              parentEmail: data.parentEmail || u.email || "",
              parentPhone: data.parentPhone || "",
              level: data.level || "",
            })
          })
          setSwimmers(swimmerData)
          if (swimmerData.length === 1) {
            // Auto-select if only one swimmer
            setSelectedSwimmerId(swimmerData[0].id)
          }
        } catch (err) {
          console.error("Load swimmers error:", err)
        }
      } else {
        setUser(null)
        setSwimmers([])
      }
    })
    return () => unsubscribe()
  }, [])

  // Auto-fill form when swimmer is selected
  useEffect(() => {
    if (selectedSwimmerId && swimmers.length > 0 && !autoFilled) {
      const swimmer = swimmers.find((s) => s.id === selectedSwimmerId)
      if (swimmer) {
        const swimmerName = [swimmer.childFirstName, swimmer.childLastName].filter(Boolean).join(" ").trim()
        
        // Use swimmer level directly if it's a valid SwimmerLevel
        let clinicLevel: SwimmerLevel | "" = ""
        if (swimmer.level && SWIMMER_LEVELS.includes(swimmer.level as SwimmerLevel)) {
          clinicLevel = swimmer.level as SwimmerLevel
        }

        setForm({
          parentEmail: swimmer.parentEmail || user?.email || "",
          parentPhone: swimmer.parentPhone || "",
          swimmerName: swimmerName || "",
          level: clinicLevel,
          preferences: [],
        })
        setAutoFilled(true)
      }
    }
  }, [selectedSwimmerId, swimmers, user, autoFilled])

  const totalSelected = useMemo(
    () => form.preferences.reduce((sum, p) => sum + p.selections.length, 0),
    [form.preferences]
  )
  const meetsSuggested = totalSelected >= MIN_SUGGESTED_CHOICES

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleSelection = (location: string, slotLabel: string) => {
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

  const selectAllForLocation = (location: string) => {
    const locationData = config?.locations.find((l) => l.name === location)
    if (!locationData) return
    const allLabels = locationData.slots.map((s) => s.label)
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

  const clearLocation = (location: string) => {
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
          season: config?.season || "Winter Break 2025–26",
          website: honeypot,
          swimmerId: selectedSwimmerId || undefined,
        }),
      })
      const json = (await res.json()) as SubmitResponse
      if (!res.ok) throw new Error(json?.error || "Submit failed")

      alert("Thanks! Your clinic preferences have been submitted.")
      setForm({ parentEmail: "", parentPhone: "", swimmerName: "", level: "", preferences: [] })
      setHoneypot("")
      setAutoFilled(false)
      setSelectedSwimmerId("")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit. Please try again."
      alert(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading clinic information...</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No active clinic is currently available. Please check back later.
            </AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    )
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
            {config.title}
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-2 font-light">
            Tell us which clinic days/times work during {config.season}
          </p>
          {config.description && (
            <p className="text-lg text-slate-500 mt-4">{config.description}</p>
          )}
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
                  {config.title} — Interest Survey
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Parent email, phone, swimmer info, location & time preferences
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-10">
                  {/* Swimmer Selection (if logged in and has multiple swimmers) */}
                  {user && swimmers.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="swimmerSelect">Select Swimmer *</Label>
                      <Select value={selectedSwimmerId} onValueChange={(v) => {
                        setSelectedSwimmerId(v)
                        setAutoFilled(false)
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a swimmer" />
                        </SelectTrigger>
                        <SelectContent>
                          {swimmers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {[s.childFirstName, s.childLastName].filter(Boolean).join(" ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

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

                    {user && swimmers.length > 0 && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          Your information has been auto-filled from your account. You can edit if needed.
                        </AlertDescription>
                      </Alert>
                    )}

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
                        onValueChange={(v) => handleChange("level", v as SwimmerLevel)}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(LEVEL_GROUPS).map(([group, levels]) => (
                            <div key={group}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                                {group}
                              </div>
                              {levels.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm md:text-base">
                      <strong>Note:</strong> Our clinics are designed for swimmers who already have some independent water skills.  
                      If your child is brand new to swimming, we recommend starting with our{" "}
                      <span className="font-semibold">Beginner Group Lessons</span> or{" "}
                      <span className="font-semibold">Private Lessons</span> to build a solid foundation.
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
                      Select <em>all</em> dates that work (use &quot;Select all&quot; per location for convenience).
                    </p>

                    {config.locations.map((locationData) => {
                      const location = locationData.name
                      const slots = locationData.slots
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
