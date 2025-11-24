// app/renew/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { onAuthStateChanged } from "firebase/auth"
import type { User as FirebaseUser } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  User,
  Heart,
  Phone,
  AlertTriangle,
  FileText,
  Shield,
  Camera,
  BookOpen,
  ShieldCheck,
} from "lucide-react"

type Step = 1 | 2 | 3 | 4 | 5

interface RenewForm {
  // 家长信息
  parentFirstName: string
  parentLastName: string
  parentEmail: string
  parentPhone: string
  parentAddress: string
  parentCity: string
  parentState: string
  parentZip: string

  // 医生 / 健康
  physicianName: string
  physicianPhone: string
  insuranceProvider: string
  insurancePolicyNumber: string

  // 紧急联系人
  emergencyContactName: string
  emergencyContactRelation: string
  emergencyContactPhone: string
  emergencyContactEmail: string

  // 健康历史
  allergies: string
  healthHistory: string
  medications: string
  specialNeeds: string

  // 协议勾选
  liabilityWaiver: boolean
  medicalAuthorization: boolean
  photoRelease: boolean
  codeOfConduct: boolean
  parentCodeOfConduct: boolean
  maappAck: boolean
  safeSportPoliciesAck: boolean
}

export default function RenewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [swimmerName, setSwimmerName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<Step>(1)
  const totalSteps = 5
  const [emailError, setEmailError] = useState<string | null>(null)

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const [form, setForm] = useState<RenewForm>({
    parentFirstName: "",
    parentLastName: "",
    parentEmail: "",
    parentPhone: "",
    parentAddress: "",
    parentCity: "",
    parentState: "",
    parentZip: "",
    physicianName: "",
    physicianPhone: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",
    allergies: "",
    healthHistory: "",
    medications: "",
    specialNeeds: "",
    liabilityWaiver: false,
    medicalAuthorization: false,
    photoRelease: false,
    codeOfConduct: false,
    parentCodeOfConduct: false,
    maappAck: false,
    safeSportPoliciesAck: false,
  })

  // 载入 swimmer 并预填
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login")
        return
      }
      try {
        if (!id) throw new Error("Missing swimmer id")
        const snap = await getDoc(doc(db, "swimmers", String(id)))
        if (!snap.exists()) throw new Error("Swimmer not found")
        const data = snap.data() || {}

        if (data.parentUID && data.parentUID !== u.uid) {
          throw new Error("You do not have access to this swimmer.")
        }

        setUser(u)
        setSwimmerName(
          `${data.childFirstName ?? ""} ${data.childLastName ?? ""}`.trim()
        )

        setForm((prev) => ({
          ...prev,
          parentFirstName: data.parentFirstName ?? "",
          parentLastName: data.parentLastName ?? "",
          parentEmail: data.parentEmail ?? "",
          parentPhone: data.parentPhone ?? "",
          parentAddress: data.parentAddress ?? "",
          parentCity: data.parentCity ?? "",
          parentState: data.parentState ?? "",
          parentZip: data.parentZip ?? "",
          physicianName:
            data.physicianName ?? data.familyDoctorName ?? "",
          physicianPhone:
            data.physicianPhone ?? data.familyDoctorPhone ?? "",
          insuranceProvider: data.insuranceProvider ?? "",
          insurancePolicyNumber: data.insurancePolicyNumber ?? "",
          emergencyContactName:
            data.emergencyContactName ?? data.emergencyName ?? "",
          emergencyContactRelation:
            data.emergencyContactRelation ?? "",
          emergencyContactPhone:
            data.emergencyContactPhone ?? data.emergencyPhone ?? "",
          emergencyContactEmail: data.emergencyContactEmail ?? "",
          allergies: data.allergies ?? "",
          healthHistory: data.healthHistory ?? "",
          medications: data.medications ?? "",
          specialNeeds: data.specialNeeds ?? "",
          liabilityWaiver: !!data.liabilityWaiver,
          medicalAuthorization: !!data.medicalAuthorization,
          photoRelease: !!data.photoRelease,
          codeOfConduct: !!data.codeOfConduct,
          parentCodeOfConduct: !!data.parentCodeOfConduct,
          maappAck: !!data.maappAck,
          safeSportPoliciesAck: !!data.safeSportPoliciesAck,
        }))
      } catch (e: any) {
        setError(e?.message || "Load failed")
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [id, router])

  const goBackDashboard = () => router.push("/dashboard")

  const updateField = (field: keyof RenewForm, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canNext = () => {
    if (step === 1) {
      return (
        !!form.parentFirstName &&
        !!form.parentLastName &&
        !!form.parentEmail &&
        isValidEmail(form.parentEmail) &&
        !!form.parentPhone &&
        !!form.parentAddress &&
        !!form.parentCity &&
        !!form.parentState &&
        !!form.parentZip
      )
    }
    if (step === 2) {
      return (
        !!form.physicianName &&
        !!form.physicianPhone &&
        !!form.insuranceProvider &&
        !!form.insurancePolicyNumber
      )
    }
    if (step === 3) {
      return (
        !!form.emergencyContactName &&
        !!form.emergencyContactRelation &&
        !!form.emergencyContactPhone
      )
    }
    if (step === 4) {
      // 健康历史可以全是空，直接下一步
      return true
    }
    if (step === 5) {
      return (
        form.liabilityWaiver &&
        form.medicalAuthorization &&
        form.codeOfConduct &&
        form.parentCodeOfConduct &&
        form.maappAck
      )
    }
    return false
  }

  const handleNext = () => {
    if (step < totalSteps && canNext()) {
      setStep((s) => (s + 1) as Step)
    }
  }

  const handlePrev = () => {
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  // 最后一步：保存数据 + 跳 Zelle 页面
  const handleAgreeAndGoZelle = async () => {
    if (!user || !id) return
    if (!canNext()) return

    try {
      const ref = doc(db, "swimmers", String(id))
      await updateDoc(ref, {
        // 家长信息
        parentFirstName: form.parentFirstName || null,
        parentLastName: form.parentLastName || null,
        parentEmail: form.parentEmail || null,
        parentPhone: form.parentPhone || null,
        parentAddress: form.parentAddress || null,
        parentCity: form.parentCity || null,
        parentState: form.parentState || null,
        parentZip: form.parentZip || null,
        // 医生 + 保险
        physicianName: form.physicianName || null,
        physicianPhone: form.physicianPhone || null,
        insuranceProvider: form.insuranceProvider || null,
        insurancePolicyNumber: form.insurancePolicyNumber || null,
        // 紧急联系人
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactRelation: form.emergencyContactRelation || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        emergencyContactEmail: form.emergencyContactEmail || null,
        // 健康信息
        allergies: form.allergies || null,
        healthHistory: form.healthHistory || null,
        medications: form.medications || null,
        specialNeeds: form.specialNeeds || null,
        // 协议勾选
        liabilityWaiver: form.liabilityWaiver,
        medicalAuthorization: form.medicalAuthorization,
        photoRelease: form.photoRelease,
        codeOfConduct: form.codeOfConduct,
        parentCodeOfConduct: form.parentCodeOfConduct,
        maappAck: form.maappAck,
        safeSportPoliciesAck: form.safeSportPoliciesAck,
      })

      // ✅ 注意：这里只是跳转到 Zelle 页面，不创建 payment
      router.push(`/zelle-payment?swimmerId=${encodeURIComponent(String(id))}&mode=renew`)
    } catch (e) {
      console.error(e)
      alert("Failed to save information, please try again.")
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  if (error)
    return (
      <div className="max-w-xl mx-auto p-6">
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={goBackDashboard}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <nav className="flex items-center space-x-2 text-sm text-slate-600 mb-4">
          <Link href="/" className="hover:text-slate-800">
            Home
          </Link>
          <span>/</span>
          <Link href="/dashboard" className="hover:text-slate-800">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-900">Renew Membership</span>
        </nav>

        <div className="max-w-3xl mx-auto">
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader>
              <CardTitle className="text-2xl">
                Renew Membership for {swimmerName || "Swimmer"}
              </CardTitle>
              <CardDescription>
                Step {step} of {totalSteps} – review & update information before payment.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Step 1: 家长信息 */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center pb-4">
                    <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Parent Information</h2>
                    <p className="text-slate-600 mt-2">Primary parent/guardian contact information</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentFirstName">First Name *</Label>
                      <Input
                        id="parentFirstName"
                        value={form.parentFirstName}
                        onChange={(e) =>
                          updateField("parentFirstName", e.target.value)
                        }
                        placeholder="Enter first name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentLastName">Last Name *</Label>
                      <Input
                        id="parentLastName"
                        value={form.parentLastName}
                        onChange={(e) =>
                          updateField("parentLastName", e.target.value)
                        }
                        placeholder="Enter last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentEmail">Email Address *</Label>
                      <Input
                        id="parentEmail"
                        type="email"
                        value={form.parentEmail}
                        onChange={(e) =>
                          updateField("parentEmail", e.target.value)
                        }
                        onBlur={(e) => {
                          const value = e.target.value
                          if (value && !isValidEmail(value)) {
                            setEmailError("Please enter a valid email address.")
                          } else {
                            setEmailError(null)
                          }
                        }}
                        placeholder="Enter email address"
                        required
                        className={emailError ? "border-red-500 focus:ring-red-500" : ""}
                      />
                      {emailError && <p className="text-sm text-red-600">{emailError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentPhone">Phone Number *</Label>
                      <Input
                        id="parentPhone"
                        type="tel"
                        value={form.parentPhone}
                        onChange={(e) =>
                          updateField("parentPhone", e.target.value)
                        }
                        placeholder="(555) 123-4567"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentAddress">Address *</Label>
                    <Input
                      id="parentAddress"
                      value={form.parentAddress}
                      onChange={(e) =>
                        updateField("parentAddress", e.target.value)
                      }
                      placeholder="Enter street address"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentCity">City *</Label>
                      <Input
                        id="parentCity"
                        value={form.parentCity}
                        onChange={(e) =>
                          updateField("parentCity", e.target.value)
                        }
                        placeholder="Enter city"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentState">State *</Label>
                      <Select
                        value={form.parentState}
                        onValueChange={(value) =>
                          updateField("parentState", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WA">Washington</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="OR">Oregon</SelectItem>
                          <SelectItem value="ID">Idaho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentZip">ZIP Code *</Label>
                      <Input
                        id="parentZip"
                        value={form.parentZip}
                        onChange={(e) =>
                          updateField("parentZip", e.target.value)
                        }
                        placeholder="12345"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: 医生 / 保险 */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center pb-4">
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Health Information</h2>
                    <p className="text-slate-600 mt-2">Medical and insurance information</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="physicianName">Physician Name *</Label>
                      <Input
                        id="physicianName"
                        value={form.physicianName}
                        onChange={(e) =>
                          updateField("physicianName", e.target.value)
                        }
                        placeholder="Dr. Smith"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="physicianPhone">Physician Phone *</Label>
                      <Input
                        id="physicianPhone"
                        type="tel"
                        value={form.physicianPhone}
                        onChange={(e) =>
                          updateField("physicianPhone", e.target.value)
                        }
                        placeholder="(555) 123-4567"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="insuranceProvider">Insurance Provider *</Label>
                      <Input
                        id="insuranceProvider"
                        value={form.insuranceProvider}
                        onChange={(e) =>
                          updateField("insuranceProvider", e.target.value)
                        }
                        placeholder="Enter insurance provider"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurancePolicyNumber">Policy Number *</Label>
                      <Input
                        id="insurancePolicyNumber"
                        value={form.insurancePolicyNumber}
                        onChange={(e) =>
                          updateField("insurancePolicyNumber", e.target.value)
                        }
                        placeholder="Enter policy number"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: 紧急联系人 */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center pb-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Phone className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Emergency Contact</h2>
                    <p className="text-slate-600 mt-2">Please provide emergency contact information</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactName">Full Name *</Label>
                      <Input
                        id="emergencyContactName"
                        value={form.emergencyContactName}
                        onChange={(e) =>
                          updateField("emergencyContactName", e.target.value)
                        }
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactRelation">Relationship *</Label>
                      <Input
                        id="emergencyContactRelation"
                        value={form.emergencyContactRelation}
                        onChange={(e) =>
                          updateField(
                            "emergencyContactRelation",
                            e.target.value
                          )
                        }
                        placeholder="Grandparent, Uncle, etc."
                        required
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone">Phone Number *</Label>
                      <Input
                        id="emergencyContactPhone"
                        type="tel"
                        value={form.emergencyContactPhone}
                        onChange={(e) =>
                          updateField("emergencyContactPhone", e.target.value)
                        }
                        placeholder="(555) 123-4567"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactEmail">Email Address</Label>
                      <Input
                        id="emergencyContactEmail"
                        type="email"
                        value={form.emergencyContactEmail}
                        onChange={(e) =>
                          updateField("emergencyContactEmail", e.target.value)
                        }
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: 健康历史 */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="text-center pb-4">
                    <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Health History & Allergies</h2>
                    <p className="text-slate-600 mt-2">Please provide detailed health information and any special considerations</p>
                  </div>
                  <div>
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      value={form.allergies}
                      onChange={(e) => updateField("allergies", e.target.value)}
                      placeholder="List any food, medication, or environmental allergies. Write 'None' if no allergies."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="healthHistory">Past Health History</Label>
                    <Textarea
                      id="healthHistory"
                      value={form.healthHistory}
                      onChange={(e) =>
                        updateField("healthHistory", e.target.value)
                      }
                      placeholder="Include any past medical conditions, surgeries, asthma, heart conditions, seizures, etc. Write 'None' if no history."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="medications">Current Medications</Label>
                    <Textarea
                      id="medications"
                      value={form.medications}
                      onChange={(e) =>
                        updateField("medications", e.target.value)
                      }
                      placeholder="List all current medications, dosages, and frequency. Write 'None' if no medications."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialNeeds">
                      Special Needs or Accommodations
                    </Label>
                    <Textarea
                      id="specialNeeds"
                      value={form.specialNeeds}
                      onChange={(e) =>
                        updateField("specialNeeds", e.target.value)
                      }
                      placeholder="Any special needs, learning disabilities, physical limitations, or accommodations required. Write 'None' if no special needs."
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Step 5: 协议 */}
              {step === 5 && (
                <div className="space-y-8">
                  <div className="text-center pb-4">
                    <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Liability Forms & Agreements</h2>
                    <p className="text-slate-600 mt-2">Please read and agree to the following terms and conditions</p>
                  </div>

                  {/* Liability Waiver */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-6 h-6 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-slate-800">Liability Waiver</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        I acknowledge that swimming and related activities involve inherent risks. I voluntarily accept these
                        risks on behalf of my child and agree not to hold Prime Swim Academy, its staff, or affiliates liable for
                        any injury arising from ordinary participation in the program. This waiver does not apply in cases of
                        intentional misconduct. I further understand that I am responsible for my child's behavior and compliance with safety rules, and that Prime Swim Academy is not liable for lost or stolen belongings.
                      </p>
                      <p className="mt-2 text-blue-600">
                        <Link href="/school-policy" target="_blank" className="underline hover:text-blue-800">
                          📄 View detailed School Policies here
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="liabilityWaiver"
                        checked={form.liabilityWaiver}
                        onCheckedChange={(checked) => updateField("liabilityWaiver", checked as boolean)}
                      />
                      <Label htmlFor="liabilityWaiver" className="text-sm">
                        I have read and agree to the Liability Waiver and <Link href="/school-policy" target="_blank" className="underline text-blue-600 hover:text-blue-800">School Policies</Link> *
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  {/* Medical Treatment Authorization */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Heart className="w-6 h-6 text-red-600" />
                      <h3 className="text-lg font-semibold text-slate-800">Medical Treatment Authorization</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        I authorize Prime Swim Academy staff to seek emergency medical treatment for my child if I cannot be
                        reached immediately. I understand that every effort will be made to contact me or the emergency contact
                        before seeking treatment. I authorize the administration of first aid and emergency medical care by
                        qualified personnel.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="medicalAuthorization"
                        checked={form.medicalAuthorization}
                        onCheckedChange={(checked) => updateField("medicalAuthorization", checked as boolean)}
                      />
                      <Label htmlFor="medicalAuthorization" className="text-sm">
                        I authorize emergency medical treatment *
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  {/* Photo & Media Release */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Camera className="w-6 h-6 text-green-600" />
                      <h3 className="text-lg font-semibold text-slate-800">Photo & Media Release</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        I grant Prime Swim Academy permission to use photographs, videos, or other media of my child for
                        promotional purposes including but not limited to websites, social media, brochures, and advertisements. I
                        understand that no compensation will be provided for such use.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="photoRelease"
                        checked={form.photoRelease}
                        onCheckedChange={(checked) => updateField("photoRelease", checked as boolean)}
                      />
                      <Label htmlFor="photoRelease" className="text-sm">
                        I grant permission for photo and media use (optional)
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  {/* Athlete Code of Conduct */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <BookOpen className="w-6 h-6 text-purple-600" />
                      <h3 className="text-lg font-semibold text-slate-800">Athlete Code of Conduct</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        I agree that my child will conduct themselves in a respectful manner at all times. This includes
                        showing respect to coaches, staff, other swimmers, and parents. Inappropriate behavior, including but not
                        limited to bullying, harassment, or disruptive conduct, may result in suspension or termination from the
                        program without refund.
                      </p>
                      <p className="mt-2 text-blue-600">
                        <Link href="/docs/safe-sport/code-of-conduct.pdf" target="_blank" className="underline hover:text-blue-800">
                          📄 View Athlete Code of Conduct (PDF)
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="codeOfConduct"
                        checked={form.codeOfConduct}
                        onCheckedChange={(checked) => updateField("codeOfConduct", checked as boolean)}
                      />
                      <Label htmlFor="codeOfConduct" className="text-sm">
                        I agree my athlete will follow the Athlete Code of Conduct *
                      </Label>
                    </div>
                  </div>

                  {/* Parent Code of Conduct */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <User className="w-6 h-6 text-slate-700" />
                      <h3 className="text-lg font-semibold text-slate-800">Parent Code of Conduct</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        As a parent/guardian, I will model respectful behavior, support coaches and officials,
                        follow team policies, use positive communication, and help maintain a safe and inclusive environment.
                        I understand that violations may result in warnings, suspension from team activities, or removal from the program.
                      </p>
                      <p className="mt-2 text-blue-600">
                        <Link
                          href="/docs/safe-sport/prime-swim-academy-parent-code-of-conduct.pdf"
                          target="_blank"
                          className="underline hover:text-blue-800"
                        >
                          📄 View Parent Code of Conduct (PDF)
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="parentCodeOfConduct"
                        checked={form.parentCodeOfConduct}
                        onCheckedChange={(checked) => updateField("parentCodeOfConduct", checked as boolean)}
                      />
                      <Label htmlFor="parentCodeOfConduct" className="text-sm">
                        I agree to follow the Parent Code of Conduct *
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  {/* MAAPP Acknowledgement */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <ShieldCheck className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-semibold text-slate-800">MAAPP (Minor Athlete Abuse Prevention Policy)</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        USA Swimming requires all member clubs to implement MAAPP. Prime Swim Academy adopts and enforces the current MAAPP.
                        Please review the policy before acknowledging.
                      </p>
                      <p className="mt-2 text-blue-600">
                        <Link href="/docs/safe-sport/maapp.pdf" target="_blank" className="underline hover:text-blue-800">
                          📄 View / Download MAAPP (PDF)
                        </Link>
                      </p>
                      <p className="mt-1 text-blue-600">
                        <Link href="/safesport#report" target="_blank" className="underline hover:text-blue-800">
                          🔒 Safe Sport Reporting & Coordinator Info
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="maappAck"
                        checked={form.maappAck}
                        onCheckedChange={(checked) => updateField("maappAck", checked as boolean)}
                      />
                      <Label htmlFor="maappAck" className="text-sm">
                        I have reviewed and acknowledge the MAAPP policy *
                      </Label>
                    </div>
                  </div>

                  {/* Additional Safe Sport Policies (Optional) */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <ShieldCheck className="w-6 h-6 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-800">Additional Safe Sport Policies</h3>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 max-h-32 overflow-y-auto">
                      <p className="mb-2">
                        Additional Safe Sport policies and resources are available for review.
                      </p>
                      <p className="mt-2 text-blue-600">
                        <Link href="/safesport" target="_blank" className="underline hover:text-blue-800">
                          🔒 View Safe Sport Resources
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="safeSportPoliciesAck"
                        checked={form.safeSportPoliciesAck}
                        onCheckedChange={(checked) => updateField("safeSportPoliciesAck", checked as boolean)}
                      />
                      <Label htmlFor="safeSportPoliciesAck" className="text-sm">
                        I have reviewed additional Safe Sport policies (optional)
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* 底部按钮 */}
              <div className="flex justify-between pt-4 border-t mt-4">
                <Button variant="outline" onClick={goBackDashboard}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {step > 1 && (
                    <Button variant="outline" onClick={handlePrev}>
                      Back
                    </Button>
                  )}

                  {step < totalSteps && (
                    <Button
                      onClick={handleNext}
                      disabled={!canNext()}
                      className="bg-slate-800 text-white"
                    >
                      Next
                    </Button>
                  )}

                  {step === totalSteps && (
                    <Button
                      onClick={handleAgreeAndGoZelle}
                      disabled={!canNext()}
                      className="bg-slate-800 text-white"
                    >
                      Agree & Continue to Payment
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  )
}
