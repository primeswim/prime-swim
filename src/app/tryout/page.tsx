"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, MapPin, Phone, Trophy, Users, Waves, CheckCircle, AlertCircle, Droplets } from "lucide-react"
import Header from "@/components/header";

export default function TryoutPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    age: "",
    program: "",
    experience: "",
    preferredDate: "",
    preferredTime: "",
    location: "",
    healthIssues: "",
    notes: "",
    liabilityAccepted: false,
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/tryout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
  
      if (res.ok) {
        alert("✅ Your tryout request was submitted successfully!")
        // 清空表单
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          age: "",
          program: "",
          experience: "",
          preferredDate: "",
          preferredTime: "",
          location: "",
          healthIssues: "",
          notes: "",
          liabilityAccepted: false
        })
      } else {
        alert("❌  There was an error. Please try again.")
      }
    } catch (err) {
      console.error(err)
      alert("❌  There was an error submitting the form.")
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
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">Schedule Your Tryout</h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Take the first step towards swimming excellence
          </p>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Join Prime Swim Academy and discover your potential. Our tryout process helps us understand your current
            skill level and recommend the perfect program for your swimming journey.
          </p>
        </div>
      </section>

      {/* What to Expect Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">What to Expect</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Our comprehensive tryout process ensures we place you in the right program
          </p>
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
      <section className="bg-slate-50 py-20">
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
                        max="99"
                        value={formData.age}
                        onChange={(e) => handleInputChange("age", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="program" className="text-slate-700 font-medium">
                        Interested Program  *
                      </Label>
                      <Select onValueChange={(value) => handleInputChange("program", value)}>
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
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
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="experience" className="text-slate-700 font-medium">
                        Swimming Experience
                        </Label>
                        <Select onValueChange={(value) => handleInputChange("experience", value)}>
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                            <SelectValue placeholder="Select your experience level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="beginner">Beginner (Learning to swim)</SelectItem>
                            <SelectItem value="recreational">Recreational swimmer</SelectItem>
                            <SelectItem value="competitive">Some competitive experience</SelectItem>
                            <SelectItem value="advanced">Advanced competitive swimmer</SelectItem>
                            <SelectItem value="elite">Elite/National level</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="location" className="text-slate-700 font-medium">
                            Preferred Location *
                        </Label>
                        <Select onValueChange={(value) => handleInputChange("location", value)}>
                            <SelectTrigger className="border-slate-300 focus:border-slate-500">
                            <SelectValue placeholder="Select preferred location" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="Redmond">Redmond</SelectItem>
                            <SelectItem value="Mercer Island">Mercer Island</SelectItem>
                            <SelectItem value="Issaquah">Issaquah</SelectItem>
                            </SelectContent>
                        </Select>
                  </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="preferredDate" className="text-slate-700 font-medium">
                        Preferred Date
                      </Label>
                      <Input
                        id="preferredDate"
                        type="date"
                        value={formData.preferredDate}
                        onChange={(e) => handleInputChange("preferredDate", e.target.value)}
                        className="border-slate-300 focus:border-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredTime" className="text-slate-700 font-medium">
                        Preferred Time
                      </Label>
                      <Select onValueChange={(value) => handleInputChange("preferredTime", value)}>
                        <SelectTrigger className="border-slate-300 focus:border-slate-500">
                          <SelectValue placeholder="Select preferred time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (8:00 AM - 12:00 PM)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12:00 PM - 5:00 PM)</SelectItem>
                          <SelectItem value="evening">Evening (5:00 PM - 8:00 PM)</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

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
                        <p><strong>1.</strong> I understand that swimming tryouts involve physical activity and the inherent risk of injury. I voluntarily accept full responsibility for any risk or harm that may arise during participation.</p>
                        <p><strong>2.</strong> I release Prime Swim Academy and its staff from any and all liability for injury, illness, or damages that may occur as a result of my or my child’s participation in tryouts.</p>
                        <p><strong>3.</strong> I certify that I or my child is physically fit to participate in the swimming tryout and that I have disclosed any relevant health conditions.</p>
                    </div>
                    <div className="flex items-start space-x-2">
                        <input
                        type="checkbox"
                        id="liabilityAccepted"
                        checked={formData.liabilityAccepted}
                        onChange={(e) => setFormData({ ...formData, liabilityAccepted: e.target.checked })}
                        className="mt-1"
                        required
                        />
                        <label htmlFor="liabilityAccepted" className="text-sm text-amber-800 font-medium">
                        I have read and agree to the above waiver of liability.
                        </label>
                    </div>
                  </div>


                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    Schedule My Tryout
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What to Bring Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">What to Bring</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Come prepared for your tryout with these essential items
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Swimwear</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm">
                Appropriate swimsuit and swim cap (if you have one)
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Goggles</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm">
                Well-fitting goggles for clear underwater vision
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Towel</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm">
                Large towel for drying off after the assessment
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Positive Attitude</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm">
                Come ready to learn and have fun in the water!
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-800 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <Image
                  src="/images/psa-logo.png"
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
                <Link href="/" className="block text-sm hover:text-white transition-colors">
                  Home
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
