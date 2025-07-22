"use client"

import type { SwimmerFormData, FirebaseUser } from "@/types"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  DollarSign,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
} from "lucide-react"

export default function ZellePaymentStep({
//   formData,
  swimmerId,
  user,
}: {
  formData: SwimmerFormData
  swimmerId: string
  user: FirebaseUser
}) {
  const router = useRouter()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [paymentData, setPaymentData] = useState({
    paymentName: "",
    paymentMemo: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setPaymentData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError("")
  }

  const handleConfirm = async () => {
    if (!paymentData.paymentName.trim()) {
      setError("Please fill in all required fields")
      return
    }

    if (!swimmerId) {
      setError("Invalid swimmer ID.")
      return
    }

    console.log("1. start confirm ...")
    setIsSubmitting(true)
    setError("")

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log("Submitting payment for swimmer ID:", swimmerId)
      console.log("user.uid:", user?.uid)
    console.log("swimmerId:", swimmerId)

    const ref = doc(db, "swimmers", swimmerId)
    const snapshot = await getDoc(ref)
    console.log("ref data:", snapshot.data())
      await updateDoc(doc(db, "swimmers", swimmerId), {
        paymentStatus: "pending",
        paymentName: paymentData.paymentName.trim(),
        paymentMemo: paymentData.paymentMemo.trim(),
      })
      setSuccess("Payment confirmation submitted successfully! Redirecting to dashboard...")

      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    } catch (err) {
      console.error("Payment update failed:", err)
      setError("Failed to submit payment confirmation. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!swimmerId) {
    return <p className="text-center text-red-600 mt-10">Missing swimmer ID. Please retry registration.</p>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={60}
              height={60}
              className="rounded-full"
            />
            <span className="text-xl font-bold text-slate-800">Prime Swim Academy</span>
          </Link>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-800 transition-colors">
              Dashboard
            </Link>
            <Link href="/#programs" className="text-slate-600 hover:text-slate-800 transition-colors">
              Programs
            </Link>
            <Link href="/coaches" className="text-slate-600 hover:text-slate-800 transition-colors">
              Coaches
            </Link>
            <Link href="/news" className="text-slate-600 hover:text-slate-800 transition-colors">
              News
            </Link>
            <Link href="/#contact" className="text-slate-600 hover:text-slate-800 transition-colors">
              Contact
            </Link>
          </div>
        </nav>
      </header>

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center space-x-2 text-sm text-slate-600">
          <Link href="/" className="hover:text-slate-800 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/dashboard" className="hover:text-slate-800 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-slate-800">Zelle Payment</span>
        </nav>
      </div>

      {/* Back Button */}
      <div className="container mx-auto px-4 mb-6">
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="border-0 shadow-lg bg-white hover:bg-slate-50 text-slate-800 rounded-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <DollarSign className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 tracking-tight">
            Complete Your Registration
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">Secure Payment via Zelle</p>
        </div>
      </section>

      {/* Payment Content */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-xl bg-white mb-8">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Registration Fee Payment</CardTitle>
              <CardDescription className="text-slate-600">
                Complete your swimmer registration with a secure Zelle payment
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Payment Amount */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg text-center">
                <h3 className="text-3xl font-bold text-slate-800 mb-2">$75.00</h3>
                <p className="text-slate-600">Annual Registration Fee</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <span>Team swim cap</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <span>Team T-shirt</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <span>Administrative setup</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Instructions */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-800 mb-4">Payment Instructions</h4>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <h5 className="font-medium text-slate-800 mb-2">Step 1: Scan QR Code</h5>
                  <p className="text-sm text-slate-600 mb-4">
                    Use your banking app to scan the QR code below, or manually send to our Zelle email.
                  </p>

                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-4 rounded-lg shadow-lg">
                      <Image
                        src="/images/zelle_qr.jpeg"
                        alt="Zelle QR Code for Prime Swim Academy"
                        width={200}
                        height={200}
                        className="rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-slate-600 mb-1">Or send directly to:</p>
                    <p className="font-semibold text-slate-800 text-lg">prime.swim.us@gmail.com</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h5 className="font-medium text-slate-800 mb-2">Step 2: Include Required Information</h5>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-blue-600" />
                      <span>
                        Amount: <strong>$75.00</strong>
                      </span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      <span>Memo: Include your child&apos;s full name</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Confirmation Form */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-800 mb-4">Payment Confirmation</h4>

                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentName">Name Used on Zelle Payment *</Label>
                    <Input
                      id="paymentName"
                      value={paymentData.paymentName}
                      onChange={(e) => handleInputChange("paymentName", e.target.value)}
                      placeholder="Enter the name used for the Zelle payment"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMemo">Memo/Note (Optional)</Label>
                    <Input
                      id="paymentMemo"
                      value={paymentData.paymentMemo}
                      onChange={(e) => handleInputChange("paymentMemo", e.target.value)}
                      placeholder="Any memo or note included in the transfer"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 mr-3 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium mb-1">Important:</p>
                      <p>
                        Please ensure you have completed the Zelle payment before clicking the confirmation button. Your
                        registration will be processed once we receive and verify the payment.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting || !paymentData.paymentName.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-full text-lg"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Confirmation...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      I&apos;ve Completed the Payment
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card className="border-0 shadow-lg bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800">Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm mb-4">
                If you encounter any issues with the payment process or have questions about registration, please don&apos;t
                hesitate to contact us.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-slate-600">
                  <Phone className="w-4 h-4 mr-3" />
                  <span>(401) 402-0052</span>
                </div>
                <div className="flex items-center text-slate-600">
                  <Mail className="w-4 h-4 mr-3" />
                  <span>prime.swim.us@gmail.com</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-16">
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
                <Link href="/dashboard" className="block text-sm hover:text-white transition-colors">
                  Parent Dashboard
                </Link>
                <Link href="/register" className="block text-sm hover:text-white transition-colors">
                  Register Swimmer
                </Link>
                <Link href="/#programs" className="block text-sm hover:text-white transition-colors">
                  Programs
                </Link>
                <Link href="/coaches" className="block text-sm hover:text-white transition-colors">
                  Our Coaches
                </Link>
                <Link href="/news" className="block text-sm hover:text-white transition-colors">
                  News & Updates
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
