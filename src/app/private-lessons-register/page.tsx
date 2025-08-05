"use client"
import Footer from "@/components/footer";
import Header from "@/components/header";
import type React from "react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Mail, MapPin, Phone, AlertTriangle, Shield, FileText, Heart } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, Timestamp } from "firebase/firestore"

export default function PrivateLessonsPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    isPregnant: "",
    pregnancyWeeks: "",
    hasComplications: "",
    complications: "",
    medications: "",
    allergies: "",
    medicalConditions: "",
    physicianName: "",
    physicianPhone: "",
    swimmingLevel: "",
    previousInjuries: "",
    goals: "",
    agreesToTerms: false,
    agreesToLiability: false,
    agreesToMedical: false,
    parentSignature: "",
    participantSignature: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showPregnancyWarning, setShowPregnancyWarning] = useState(false)
  const [showComplicationWarning, setShowComplicationWarning] = useState(false)
  
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    let valid = true
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "swimmingLevel",
      "isPregnant",
      "hasComplications",
      "agreesToTerms",
      "agreesToLiability",
      "agreesToMedical",
    ]
  
    for (const field of requiredFields) {
      const value = formData[field as keyof typeof formData]
      if (
        value === undefined ||
        value === "" ||
        value === null
      ) {
        valid = false
      }
    }
  
    // Special case: if isPregnant is "yes", pregnancyWeeks must be filled
    // 红字警告：怀孕却没填周数
    if (formData.isPregnant === "yes" && !formData.pregnancyWeeks) {
      setShowPregnancyWarning(true)
      valid = false
    } else {
      setShowPregnancyWarning(false)
    }
  
    // Special case: if hasComplications is "yes", complications must be filled
    // 红字警告：有medical condition但没填写说明
    if (formData.hasComplications === "yes" && !formData.complications) {
      setShowComplicationWarning(true)
      valid = false
    } else {
      setShowComplicationWarning(false)
    }
  
    return valid
  }  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      alert("❌ Please complete all required fields before submitting.")
      return
    }

    setIsSubmitting(true)
  
    try {
      await addDoc(collection(db, "privatelessonstudents"), {
        ...formData,
        submittedAt: Timestamp.now(),
      });
      await fetch("/api/registration-confirmation-pl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
  
      setIsSubmitted(true) // ✅ 显示成功提示
  
      router.push("/private-lessons")
    } catch (error) {
      console.error("❌ Error submitting form:", error)
      alert("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
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
            Private Lesson Registration
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">Personalized Swimming Instruction</p>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Complete this registration form and liability waiver to begin your private swimming lessons with our
            certified instructors.
          </p>
        </div>
      </section>

      {/* Registration Form */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-slate-800 text-center flex items-center justify-center">
                  <FileText className="w-6 h-6 mr-2" />
                  Private Lesson Registration & Liability Waiver
                </CardTitle>
                <CardDescription className="text-center text-slate-600">
                  Please complete all sections carefully and accurately
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isSubmitted && (
                  <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-900 px-6 py-3 rounded-lg shadow-lg z-50 text-lg font-semibold animate-bounce">
                    ✅ Registration successful! Redirecting...
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Personal Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        1
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Personal Information</h3>
                    </div>

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

                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="text-slate-700 font-medium">
                        Date of Birth *
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                        className="border-slate-300 focus:border-slate-500 max-w-xs"
                        required
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="emergencyContactName" className="text-slate-700 font-medium">
                          Emergency Contact Name *
                        </Label>
                        <Input
                          id="emergencyContactName"
                          value={formData.emergencyContactName}
                          onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergencyContactPhone" className="text-slate-700 font-medium">
                          Emergency Contact Phone *
                        </Label>
                        <Input
                          id="emergencyContactPhone"
                          type="tel"
                          value={formData.emergencyContactPhone}
                          onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergencyContactRelation" className="text-slate-700 font-medium">
                          Relationship *
                        </Label>
                        <Select onValueChange={(value) => handleInputChange("emergencyContactRelation", value)}>
                          <SelectTrigger className="border-slate-300 focus:border-slate-500">
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="friend">Friend</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Medical Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        2
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <Heart className="w-5 h-5 mr-2 text-red-600" />
                        Medical Information
                      </h3>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-red-800 font-medium">Important Medical Disclosure</p>
                          <p className="text-red-700 text-sm">
                            Please provide accurate medical information. This helps ensure your safety during swimming
                            lessons.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pregnancy Section */}
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium block">Is the swimmer currently pregnant? *</Label>
                      <div className="flex gap-3">
                        {["yes", "no", "na"].map((value) => (
                          <label
                            key={value}
                            className={`flex items-center gap-2 px-2 py-0.5 text-sm border rounded-md cursor-pointer transition 
                              ${formData.isPregnant === value
                                ? "border-red-600 bg-red-50 text-red-700 font-semibold"
                                : "border-slate-300 text-slate-700"
                              }`}
                          >
                            <input
                              type="radio"
                              name="pregnant"
                              value={value}
                              checked={formData.isPregnant === value}
                              onChange={() => handleInputChange("isPregnant", value)}
                              className="hidden"
                            />
                            {value === "yes" && "Yes"}
                            {value === "no" && "No"}
                            {value === "na" && "Not Applicable"}
                          </label>
                        ))}
                      </div>

                      {formData.isPregnant === "yes" && (
                        <div className="space-y-2 ml-4 mt-3">
                          <Label htmlFor="pregnancyWeeks" className="text-slate-700 font-medium">
                            How many weeks pregnant?
                          </Label>
                          <Input
                            id="pregnancyWeeks"
                            type="number"
                            min="1"
                            max="42"
                            value={formData.pregnancyWeeks}
                            onChange={(e) => handleInputChange("pregnancyWeeks", e.target.value)}
                            className="border-slate-300 focus:border-slate-500 max-w-xs"
                            placeholder="Enter weeks"
                          />
                          {showPregnancyWarning && !formData.pregnancyWeeks && (
                            <p className="text-sm text-red-600 font-medium">Please enter how many weeks pregnant.</p>
                          )}
                        </div>
                      )}
                    </div>


                    {/* Medical Complications Section */}
                    <div className="space-y-2">
                      <Label className="text-slate-700 font-medium block">
                        Does the swimmer have any medical conditions or complications that may affect swimming? *
                      </Label>
                      <div className="flex gap-3">
                        {["yes", "no"].map((value) => (
                          <label
                            key={value}
                            className={`flex items-center gap-2 px-2 py-0.5 text-sm border rounded-md cursor-pointer transition 
                              ${formData.hasComplications === value
                                ? "border-red-600 bg-red-50 text-red-700 font-semibold"
                                : "border-slate-300 text-slate-700"
                              }`}
                          >
                            <input
                              type="radio"
                              name="hasComplications"
                              value={value}
                              checked={formData.hasComplications === value}
                              onChange={() => handleInputChange("hasComplications", value)}
                              className="hidden"
                            />
                            {value === "yes" ? "Yes" : "No"}
                          </label>
                        ))}
                      </div>

                      {formData.hasComplications === "yes" && (
                        <div className="space-y-2 ml-4 mt-3">
                          <Label htmlFor="complications" className="text-slate-700 font-medium">
                            Please describe your medical complications/conditions:
                          </Label>
                          <Textarea
                            id="complications"
                            value={formData.complications}
                            onChange={(e) => handleInputChange("complications", e.target.value)}
                            placeholder="Please provide details about your medical conditions..."
                            className="border-slate-300 focus:border-slate-500 min-h-[100px]"
                          />
                          {showComplicationWarning && !formData.complications && (
                            <p className="text-sm text-red-600 font-medium">Please describe your medical condition.</p>
                          )}
                        </div>
                      )}
                    </div>


                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="medications" className="text-slate-700 font-medium">
                          Current Medications
                        </Label>
                        <Textarea
                          id="medications"
                          value={formData.medications}
                          onChange={(e) => handleInputChange("medications", e.target.value)}
                          placeholder="List any medications you are currently taking..."
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="allergies" className="text-slate-700 font-medium">
                          Allergies
                        </Label>
                        <Textarea
                          id="allergies"
                          value={formData.allergies}
                          onChange={(e) => handleInputChange("allergies", e.target.value)}
                          placeholder="List any known allergies..."
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="physicianName" className="text-slate-700 font-medium">
                          Primary Physician Name
                        </Label>
                        <Input
                          id="physicianName"
                          value={formData.physicianName}
                          onChange={(e) => handleInputChange("physicianName", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="physicianPhone" className="text-slate-700 font-medium">
                          Physician Phone Number
                        </Label>
                        <Input
                          id="physicianPhone"
                          type="tel"
                          value={formData.physicianPhone}
                          onChange={(e) => handleInputChange("physicianPhone", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Swimming Experience */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        3
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Swimming Experience & Goals</h3>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="swimmingLevel" className="text-slate-700 font-medium">
                        Current Swimming Level *
                      </Label>
                      <Select onValueChange={(value) => handleInputChange("swimmingLevel", value)}>
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select your swimming level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner (Cannot swim)</SelectItem>
                          <SelectItem value="novice">Novice (Basic floating/doggy paddle)</SelectItem>
                          <SelectItem value="intermediate">Intermediate (Can swim basic strokes)</SelectItem>
                          <SelectItem value="advanced">Advanced (Proficient in multiple strokes)</SelectItem>
                          <SelectItem value="competitive">Competitive Swimmer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="previousInjuries" className="text-slate-700 font-medium">
                        Previous Swimming-Related Injuries
                      </Label>
                      <Textarea
                        id="previousInjuries"
                        value={formData.previousInjuries}
                        onChange={(e) => handleInputChange("previousInjuries", e.target.value)}
                        placeholder="Describe any previous swimming-related injuries..."
                        className="border-slate-300 focus:border-slate-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="goals" className="text-slate-700 font-medium">
                        Swimming Goals & Objectives
                      </Label>
                      <Textarea
                        id="goals"
                        value={formData.goals}
                        onChange={(e) => handleInputChange("goals", e.target.value)}
                        placeholder="What would you like to achieve through private lessons?"
                        className="border-slate-300 focus:border-slate-500 min-h-[100px]"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Liability Waiver Section */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        4
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 flex items-center">
                        <Shield className="w-5 h-5 mr-2 text-amber-600" />
                        Liability Waiver & Agreement
                      </h3>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                      <h4 className="font-bold text-amber-800 mb-4">ASSUMPTION OF RISK AND RELEASE OF LIABILITY</h4>
                      <div className="text-amber-800 text-sm space-y-3 max-h-64 overflow-y-auto">
                        <p>
                          <strong>1. ASSUMPTION OF RISK:</strong> I understand that swimming and aquatic activities
                          involve inherent risks including, but not limited to, drowning, serious injury, or death. I
                          voluntarily assume all risks associated with participation in private swimming lessons.
                        </p>
                        <p>
                          <strong>2. RELEASE OF LIABILITY:</strong> I hereby release, waive, discharge, and covenant not
                          to sue Prime Swim Academy, its instructors, employees, agents, and representatives from any
                          and all liability, claims, demands, actions, and causes of action whatsoever arising out of or
                          related to any loss, damage, or injury that may be sustained while participating in private
                          swimming lessons.
                        </p>
                        <p>
                          <strong>3. MEDICAL CONDITION:</strong> I certify that I am physically fit and have no medical
                          conditions that would prevent safe participation in swimming activities. I agree to inform the
                          instructor immediately of any changes in my medical condition.
                        </p>
                        <p>
                          <strong>4. INSTRUCTOR LIMITATIONS:</strong> I understand that swimming instructors are not
                          lifeguards and are not responsible for my safety in the water. I acknowledge that I am
                          responsible for my own safety and well-being during lessons.
                        </p>
                        <p>
                          <strong>5. EMERGENCY MEDICAL TREATMENT:</strong> I authorize Prime Swim Academy to secure
                          emergency medical treatment if necessary, and I agree to be financially responsible for any
                          costs incurred.
                        </p>
                        <p>
                          <strong>6. CANCELLATION POLICY:</strong> I understand that all cancellations must be made at least <strong>one week (7 days)</strong> in advance of the scheduled lesson to be eligible for a reschedule or credit. For lessons held at <strong>Mary Wayte Swimming Pool</strong>, a minimum of <strong>two weeks (14 days)</strong> advance notice is required due to the facility’s scheduling constraints. 

                          Cancellations made after the respective deadline will result in forfeiture of the session without refund or makeup, <strong>except in cases of medical emergencies with valid documentation</strong>. In such cases, I understand that I will still be responsible for <strong>covering the lane rental fee</strong> incurred by Prime Swim Academy for the scheduled session.
                        </p>
                        <p>
                          <strong>7. PHOTOGRAPHY/VIDEO:</strong> I understand that photos or videos may occasionally be taken during lessons for training or promotional use by Prime Swim Academy. I acknowledge that I have the option to <strong>opt out</strong> by informing the school in writing if I do not wish for my or my child’s image to be used.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agreesToTerms"
                          checked={formData.agreesToTerms}
                          onCheckedChange={(checked) => handleInputChange("agreesToTerms", checked as boolean)}
                        />
                        <Label htmlFor="agreesToTerms" className="text-slate-700 leading-relaxed">
                          I have read and understand the terms and conditions above, and I agree to be bound by them. *
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agreesToLiability"
                          checked={formData.agreesToLiability}
                          onCheckedChange={(checked) => handleInputChange("agreesToLiability", checked as boolean)}
                        />
                        <Label htmlFor="agreesToLiability" className="text-slate-700 leading-relaxed">
                          I acknowledge that I am voluntarily participating in private swimming lessons and assume all
                          risks associated with such participation. *
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="agreesToMedical"
                          checked={formData.agreesToMedical}
                          onCheckedChange={(checked) => handleInputChange("agreesToMedical", checked as boolean)}
                        />
                        <Label htmlFor="agreesToMedical" className="text-slate-700 leading-relaxed">
                          I certify that all medical information provided is accurate and complete. *
                        </Label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="participantSignature" className="text-slate-700 font-medium">
                          Participant Signature (Type Full Name) *
                        </Label>
                        <Input
                          id="participantSignature"
                          value={formData.participantSignature}
                          onChange={(e) => handleInputChange("participantSignature", e.target.value)}
                          placeholder="Type your full legal name"
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date" className="text-slate-700 font-medium">
                          Date *
                        </Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => handleInputChange("date", e.target.value)}
                          className="border-slate-300 focus:border-slate-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                    disabled={
                      isSubmitting || 
                      !formData.agreesToTerms || 
                      !formData.agreesToLiability || 
                      !formData.agreesToMedical
                    }
                  >
                    {isSubmitting ? "Submitting..." : "Submit Registration & Waiver"}
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
