"use client"

import ZellePaymentStep from "@/components/ZellePaymentStep"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import type { User as FirebaseUser } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import Header from "@/components/header";
import Footer from "@/components/footer";
import {
  User,
  Users,
  GraduationCap,
  Heart,
  Phone,
  AlertTriangle,
  FileText,
  Shield,
  Camera,
  BookOpen,
  ShieldCheck,
} from "lucide-react"

export default function RegisterPage() {
  const [, setShowZelleStep] = useState(false)
  const [swimmerId, setSwimmerId] = useState<string | null>(null)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [router])

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)

  const [formData, setFormData] = useState({
    // Child Info
    childFirstName: "",
    childLastName: "",
    childDateOfBirth: "",
    childGender: "",

    // Parent Info
    parentFirstName: "",
    parentLastName: "",
    parentEmail: "",
    parentPhone: "",
    parentAddress: "",
    parentCity: "",
    parentState: "",
    parentZip: "",

    // School & Grade
    schoolName: "",
    grade: "",

    // Health Info
    physicianName: "",
    physicianPhone: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    emergencyContactEmail: "",

    // Allergies & Health History
    allergies: "",
    healthHistory: "",
    medications: "",
    specialNeeds: "",

    // Waivers & Agreements
    liabilityWaiver: false,
    medicalAuthorization: false,
    photoRelease: false,
    codeOfConduct: false,          // Athlete Code of Conduct (required)
    parentCodeOfConduct: false,    // NEW: Parent Code of Conduct (required)

    // Safe Sport / MAAPP acknowledgements
    maappAck: false,               // required
    safeSportPoliciesAck: false,   // optional combined ack for reference docs
  })

  const totalSteps = 8

  const createSwimmer = async (opts?: { setMaappAckAt?: boolean }) => {
    if (!user) throw new Error("Not signed in")
    const idToken = await user.getIdToken(true)
    const res = await fetch("/api/register/swimmer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        ...formData,
        // server will set parentUID/createdAt; this flag lets server set maappAckAt timestamp
        maappAckAt: !!opts?.setMaappAckAt,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Registration failed")
    return String(data.id)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (field === "parentEmail" && emailError && isValidEmail(value as string)) {
      setEmailError(null)
    }
  }

  const nextStep = () => {
    if (currentStep === 2 && !isValidEmail(formData.parentEmail)) {
      setEmailError("Please enter a valid email address.")
      return
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      if (!user) {
        console.error("No user found. Cannot submit swimmer.")
        return
      }
      const id = await createSwimmer({ setMaappAckAt: true })
      setSwimmerId(id)
      setShowZelleStep(true)
      alert("Registration submitted. Please complete payment!")
      router.push(`/zelle-payment?id=${id}`)
    } catch (e) {
      console.error("Error adding swimmer: ", e)
      alert("Something went wrong. Please try again.")
    }
  }

  // All required acks must be checked
  const isWaiversChecked =
    formData.liabilityWaiver &&
    formData.medicalAuthorization &&
    formData.codeOfConduct &&
    formData.parentCodeOfConduct &&
    formData.maappAck

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Child Information</CardTitle>
              <CardDescription className="text-slate-600">
                Please provide your child&rsquo;s basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="childFirstName">First Name *</Label>
                  <Input
                    id="childFirstName"
                    value={formData.childFirstName}
                    onChange={(e) => handleInputChange("childFirstName", e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="childLastName">Last Name *</Label>
                  <Input
                    id="childLastName"
                    value={formData.childLastName}
                    onChange={(e) => handleInputChange("childLastName", e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="childDateOfBirth">Date of Birth *</Label>
                  <Input
                    id="childDateOfBirth"
                    type="date"
                    value={formData.childDateOfBirth}
                    onChange={(e) => handleInputChange("childDateOfBirth", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <RadioGroup
                    value={formData.childGender}
                    onValueChange={(value) => handleInputChange("childGender", value)}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="male"
                        id="gender-male"
                        className="h-4 w-4 rounded-full border border-gray-400 text-blue-600 focus:ring-2 focus:ring-blue-500 checked:bg-blue-600"
                      />
                      <Label htmlFor="gender-male" className="text-sm font-medium">Male</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="female"
                        id="gender-female"
                        className="h-4 w-4 rounded-full border border-gray-400 text-pink-600 focus:ring-2 focus:ring-pink-500 checked:bg-pink-600"
                      />
                      <Label htmlFor="gender-female" className="text-sm font-medium">Female</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="other"
                        id="gender-other"
                        className="h-4 w-4 rounded-full border border-gray-400 text-green-600 focus:ring-2 focus:ring-green-500 checked:bg-green-600"
                      />
                      <Label htmlFor="gender-other" className="text-sm font-medium">Other</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Parent Information</CardTitle>
              <CardDescription className="text-slate-600">Primary parent/guardian contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parentFirstName">First Name *</Label>
                  <Input
                    id="parentFirstName"
                    value={formData.parentFirstName}
                    onChange={(e) => handleInputChange("parentFirstName", e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentLastName">Last Name *</Label>
                  <Input
                    id="parentLastName"
                    value={formData.parentLastName}
                    onChange={(e) => handleInputChange("parentLastName", e.target.value)}
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
                    value={formData.parentEmail}
                    onChange={(e) => handleInputChange("parentEmail", e.target.value)}
                    onBlur={(e) => {
                      const value = e.target.value
                      if (!isValidEmail(value)) {
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
                    value={formData.parentPhone}
                    onChange={(e) => handleInputChange("parentPhone", e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentAddress">Address *</Label>
                <Input
                  id="parentAddress"
                  value={formData.parentAddress}
                  onChange={(e) => handleInputChange("parentAddress", e.target.value)}
                  placeholder="Enter street address"
                  required
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parentCity">City *</Label>
                  <Input
                    id="parentCity"
                    value={formData.parentCity}
                    onChange={(e) => handleInputChange("parentCity", e.target.value)}
                    placeholder="Enter city"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentState">State *</Label>
                  <Select
                    value={formData.parentState}
                    onValueChange={(value) => handleInputChange("parentState", value)}
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
                    value={formData.parentZip}
                    onChange={(e) => handleInputChange("parentZip", e.target.value)}
                    placeholder="12345"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">School & Grade</CardTitle>
              <CardDescription className="text-slate-600">Current school and grade information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="schoolName">School Name</Label>
                <Input
                  id="schoolName"
                  value={formData.schoolName}
                  onChange={(e) => handleInputChange("schoolName", e.target.value)}
                  placeholder="Enter school name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Current Grade *</Label>
                <Select value={formData.grade} onValueChange={(value) => handleInputChange("grade", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K">Kindergarten</SelectItem>
                    <SelectItem value="1">1st Grade</SelectItem>
                    <SelectItem value="2">2nd Grade</SelectItem>
                    <SelectItem value="3">3rd Grade</SelectItem>
                    <SelectItem value="4">4th Grade</SelectItem>
                    <SelectItem value="5">5th Grade</SelectItem>
                    <SelectItem value="6">6th Grade</SelectItem>
                    <SelectItem value="7">7th Grade</SelectItem>
                    <SelectItem value="8">8th Grade</SelectItem>
                    <SelectItem value="9">9th Grade</SelectItem>
                    <SelectItem value="10">10th Grade</SelectItem>
                    <SelectItem value="11">11th Grade</SelectItem>
                    <SelectItem value="12">12th Grade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Health Information</CardTitle>
              <CardDescription className="text-slate-600">Medical and insurance information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="physicianName">Physician Name *</Label>
                  <Input
                    id="physicianName"
                    value={formData.physicianName}
                    onChange={(e) => handleInputChange("physicianName", e.target.value)}
                    placeholder="Dr. Smith"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="physicianPhone">Physician Phone *</Label>
                  <Input
                    id="physicianPhone"
                    type="tel"
                    value={formData.physicianPhone}
                    onChange={(e) => handleInputChange("physicianPhone", e.target.value)}
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
                    value={formData.insuranceProvider}
                    onChange={(e) => handleInputChange("insuranceProvider", e.target.value)}
                    placeholder="Blue Cross Blue Shield"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurancePolicyNumber">Policy Number *</Label>
                  <Input
                    id="insurancePolicyNumber"
                    value={formData.insurancePolicyNumber}
                    onChange={(e) => handleInputChange("insurancePolicyNumber", e.target.value)}
                    placeholder="Policy number"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Emergency Contact</CardTitle>
              <CardDescription className="text-slate-600">
                Emergency contact information (other than parent/guardian)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Full Name *</Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelation">Relationship *</Label>
                  <Input
                    id="emergencyContactRelation"
                    value={formData.emergencyContactRelation}
                    onChange={(e) => handleInputChange("emergencyContactRelation", e.target.value)}
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
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactEmail">Email Address</Label>
                  <Input
                    id="emergencyContactEmail"
                    type="email"
                    value={formData.emergencyContactEmail}
                    onChange={(e) => handleInputChange("emergencyContactEmail", e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Health History & Allergies</CardTitle>
              <CardDescription className="text-slate-600">
                Please provide detailed health information and any special considerations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  value={formData.allergies}
                  onChange={(e) => handleInputChange("allergies", e.target.value)}
                  placeholder="List any food, medication, or environmental allergies. Write ’None’ if no allergies."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="healthHistory">Past Health History</Label>
                <Textarea
                  id="healthHistory"
                  value={formData.healthHistory}
                  onChange={(e) => handleInputChange("healthHistory", e.target.value)}
                  placeholder="Include any past medical conditions, surgeries, asthma, heart conditions, seizures, etc. Write ’None’ if no history."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications">Current Medications</Label>
                <Textarea
                  id="medications"
                  value={formData.medications}
                  onChange={(e) => handleInputChange("medications", e.target.value)}
                  placeholder="List all current medications, dosages, and frequency. Write ’None’ if no medications."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialNeeds">Special Needs or Accommodations</Label>
                <Textarea
                  id="specialNeeds"
                  value={formData.specialNeeds}
                  onChange={(e) => handleInputChange("specialNeeds", e.target.value)}
                  placeholder="Any special needs, learning disabilities, physical limitations, or accommodations required. Write ’None’ if no special needs."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )

      case 7:
        return (
          <Card className="border-0 shadow-xl bg-white">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Liability Forms & Agreements</CardTitle>
              <CardDescription className="text-slate-600">
                Please read and agree to the following terms and conditions
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
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
                    intentional misconduct. I further understand that I am responsible for my child’s behavior and compliance with safety rules, and that Prime Swim Academy is not liable for lost or stolen belongings.
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
                    checked={formData.liabilityWaiver}
                    onCheckedChange={(checked) => handleInputChange("liabilityWaiver", checked as boolean)}
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
                    checked={formData.medicalAuthorization}
                    onCheckedChange={(checked) => handleInputChange("medicalAuthorization", checked as boolean)}
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
                    checked={formData.photoRelease}
                    onCheckedChange={(checked) => handleInputChange("photoRelease", checked as boolean)}
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
                    checked={formData.codeOfConduct}
                    onCheckedChange={(checked) => handleInputChange("codeOfConduct", checked as boolean)}
                  />
                  <Label htmlFor="codeOfConduct" className="text-sm">
                    I agree my athlete will follow the Athlete Code of Conduct *
                  </Label>
                </div>
              </div>

              {/* Parent Code of Conduct (NEW, required) */}
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
                    checked={formData.parentCodeOfConduct}
                    onCheckedChange={(checked) => handleInputChange("parentCodeOfConduct", checked as boolean)}
                  />
                  <Label htmlFor="parentCodeOfConduct" className="text-sm">
                    I agree to follow the Parent Code of Conduct *
                  </Label>
                </div>
              </div>

              <Separator />

              {/* MAAPP Acknowledgement (Required) */}
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
                    checked={formData.maappAck}
                    onCheckedChange={(checked) => handleInputChange("maappAck", checked as boolean)}
                  />
                  <Label htmlFor="maappAck" className="text-sm">
                    I have reviewed the MAAPP policy and acknowledge it is required by USA Swimming *
                  </Label>
                </div>
              </div>

              {/* (Optional) Combined acknowledgement for reference PDFs */}
              <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700">
                <p className="font-medium mb-2">Additional Safe Sport Policies (recommended):</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li><Link href="/docs/safe-sport/anti-bullying-policy.pdf" target="_blank" className="underline text-blue-600">Anti-Bullying Policy</Link></li>
                  <li><Link href="/docs/safe-sport/electronic-communication-policy.pdf" target="_blank" className="underline text-blue-600">Electronic Communication Policy</Link></li>
                  <li><Link href="/docs/safe-sport/travel-policy.pdf" target="_blank" className="underline text-blue-600">Travel Policy</Link></li>
                </ul>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="safeSportPoliciesAck"
                  checked={formData.safeSportPoliciesAck}
                  onCheckedChange={(checked) => handleInputChange("safeSportPoliciesAck", checked as boolean)}
                />
                <Label htmlFor="safeSportPoliciesAck" className="text-sm">
                  I have reviewed the policies listed above
                </Label>
              </div>

              <Separator />

              {/* Parent Consent Forms (MAAPP Exceptions) – info only */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-slate-700" />
                  <h3 className="text-lg font-semibold text-slate-800">Parent Consent Forms (as needed under MAAPP)</h3>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700">
                  <p className="mb-2">
                    Certain activities may require a separate parent/guardian consent form under USA Swimming’s MAAPP.
                    These forms are <strong>not signed at initial registration</strong> and will be collected
                    <strong> only when the specific situation occurs</strong> (e.g., room sharing with an unrelated adult athlete,
                    local transportation by an unrelated applicable adult, therapeutic treatment by a licensed professional,
                    or travel to competition with an unrelated applicable adult).
                  </p>
                  <p className="mt-2 text-blue-600">
                    <Link
                      href="/docs/safe-sport/prime-swim-academy-parent-consent-forms.pdf"
                      target="_blank"
                      className="underline hover:text-blue-800"
                    >
                      📄 Download Parent Consent Forms (PDF)
                    </Link>
                  </p>
                </div>

                <p className="text-xs text-slate-500">
                  Prime Swim Academy will provide the applicable consent form(s) prior to any such activity; a signed form must be
                  returned before participation.
                </p>
              </div>

              {/* Final continue */}
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-full text-lg mt-8"
                disabled={!isWaiversChecked}
                onClick={async () => {
                  if (!user || !isWaiversChecked) return
                  try {
                      const id = await createSwimmer({ setMaappAckAt: true })
                      setSwimmerId(id)
                    setCurrentStep(8)
                  } catch (err) {
                    console.error("Error creating swimmer document:", err)
                    alert("There was an error submitting the registration. Please try again.")
                  }
                }}
              >
                Agree & Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 8:
        if (!swimmerId) {
          return <p className="text-center text-red-600">Missing swimmer ID. Please retry registration.</p>
        }
        if (!user) {
          return <p className="text-center text-gray-600">Loading user info...</p>
        }
        return <ZellePaymentStep formData={formData} swimmerId={swimmerId} user={user} />

      default:
        return null
    }
  }

  const isStepComplete = () => {
    switch (currentStep) {
      case 1:
        return Boolean(formData.childFirstName && formData.childLastName && formData.childDateOfBirth && formData.childGender)
      case 2:
        return Boolean(
          formData.parentFirstName &&
          formData.parentLastName &&
          formData.parentEmail &&
          isValidEmail(formData.parentEmail) &&
          formData.parentPhone &&
          formData.parentAddress &&
          formData.parentCity &&
          formData.parentState &&
          formData.parentZip
        )
      case 3:
        return Boolean(formData.grade)
      case 4:
        return Boolean(
          formData.physicianName &&
          formData.physicianPhone &&
          formData.insuranceProvider &&
          formData.insurancePolicyNumber
        )
      case 5:
        return Boolean(formData.emergencyContactName && formData.emergencyContactRelation && formData.emergencyContactPhone)
      case 6:
        return true // Optional fields
      case 7:
        // Require all five: liability, medical, athlete code, parent code, MAAPP
        return Boolean(
          formData.liabilityWaiver &&
          formData.medicalAuthorization &&
          formData.codeOfConduct &&
          formData.parentCodeOfConduct &&
          formData.maappAck
        )
      case 8:
        return true
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center space-x-2 text-sm text-slate-600">
          <Link href="/" className="hover:text-slate-800 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-800">Registration</span>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">Swimmer Registration</h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Join Prime Swim Academy and start your swimming journey
          </p>
        </div>
      </section>

      {/* Progress Bar */}
      <div className="container mx-auto px-4 mb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-sm font-medium text-slate-600">
              {Math.round((currentStep / totalSteps) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-slate-800 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          {renderStepContent()}

          {/* Navigation Buttons - Hide when showing Zelle Payment Step (step 8) */}
          {currentStep !== totalSteps && (
            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="border-0 shadow-lg bg-white hover:bg-slate-50 text-slate-800 rounded-full px-6"
              >
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  onClick={nextStep}
                  disabled={!isStepComplete() || currentStep === 7}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded-full px-6"
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepComplete()}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-full px-6"
                >
                  Submit Registration
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
