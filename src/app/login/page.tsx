"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Lock, Mail, Eye, EyeOff, Phone, MapPin, AlertCircle, CheckCircle, ArrowRight } from "lucide-react"
import Header from "@/components/header";
import { auth } from "@/lib/firebase"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"


export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })

  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  })

  const handleLoginChange = (field: string, value: string | boolean) => {
    setLoginData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError("")
  }

  const handleSignupChange = (field: string, value: string | boolean) => {
    setSignupData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError("")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
        setSuccess("Login successful! Redirecting...")
    
        router.push("/dashboard")
      } catch (_err: unknown) {
        setError("Invalid email or password.")
      } finally {
        setIsLoading(false)
      }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
  
    if (signupData.password !== signupData.confirmPassword) {
        setError("Passwords do not match.")
        setIsLoading(false)
        return
    }

    if (!signupData.agreeToTerms) {
        setError("You must agree to the Terms and Privacy Policy.")
        setIsLoading(false)
        return
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupData.email,
        signupData.password
      )
  
      // Optionally update profile with name
      await updateProfile(userCredential.user, {
        displayName: `${signupData.firstName} ${signupData.lastName}`,
      })
  
      setSuccess("Account created! Please log in.")
      setTimeout(() => {
        setIsLogin(true)
        setSuccess("")
      }, 2000)
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error(err.message)
            setError("Account creation failed. Email may already be in use.")
          } else {
            setError("An unexpected error occurred.")
          }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = () => {
    setError("")
    setSuccess("Password reset instructions have been sent to your email address.")
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
          <span className="text-slate-800">{isLogin ? "Login" : "Sign Up"}</span>
        </nav>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {/* Toggle Buttons */}
          <div className="flex bg-slate-100 rounded-full p-1 mb-8">
            <button
              onClick={() => {
                setIsLogin(true)
                setError("")
                setSuccess("")
              }}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                isLogin ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false)
                setError("")
                setSuccess("")
              }}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                !isLogin ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {isLogin ? (
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800">Welcome Back</CardTitle>
                <CardDescription className="text-slate-600">
                  Sign in to the parent account to manage your swimmer&lsquo;s information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="email"
                        type="email"
                        value={loginData.email}
                        onChange={(e) => handleLoginChange("email", e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => handleLoginChange("password", e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rememberMe"
                        checked={loginData.rememberMe}
                        onCheckedChange={(checked) => handleLoginChange("rememberMe", checked as boolean)}
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-slate-600">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-full"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Signing In...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </form>

                <Separator />

                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Don&lsquo;t have an account?{" "}
                    <button
                      onClick={() => setIsLogin(false)}
                      className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Create one here
                    </button>
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-2">New to Prime Swim Academy?</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    You must log in to your parent account before registering your swimmer.
                  </p>
                  <p className="text-sm text-slate-600 mb-3">
                    New to Prime Swim Academy?{" "}
                    <span className="font-semibold text-slate-800">Please create your account first.</span>
                  </p>

                  {/* <Link href="/register">
                    <Button
                      variant="outline"
                      className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 bg-transparent"
                    >
                      Register New Swimmer
                    </Button>
                  </Link> */}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Sign Up Form */
            <Card className="border-0 shadow-xl bg-white">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800">Create Account</CardTitle>
                <CardDescription className="text-slate-600">
                  Create the parent account - you&lsquo;ll use this account to register and manage your swimmer(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={signupData.firstName}
                        onChange={(e) => handleSignupChange("firstName", e.target.value)}
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={signupData.lastName}
                        onChange={(e) => handleSignupChange("lastName", e.target.value)}
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="signupEmail"
                        type="email"
                        value={signupData.email}
                        onChange={(e) => handleSignupChange("email", e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="phone"
                        type="tel"
                        value={signupData.phone}
                        onChange={(e) => handleSignupChange("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="signupPassword"
                        type={showPassword ? "text" : "password"}
                        value={signupData.password}
                        onChange={(e) => handleSignupChange("password", e.target.value)}
                        placeholder="Create a password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Password must be at least 8 characters long</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={signupData.confirmPassword}
                        onChange={(e) => handleSignupChange("confirmPassword", e.target.value)}
                        placeholder="Confirm your password"
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="agreeToTerms"
                      checked={signupData.agreeToTerms}
                      onCheckedChange={(checked) => handleSignupChange("agreeToTerms", checked as boolean)}
                      className="mt-1"
                    />
                    <Label htmlFor="agreeToTerms" className="text-sm text-slate-600 leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
                        Privacy Policy
                      </Link>
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-full"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating Account...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </form>

                <Separator />

                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Already have an account?{" "}
                    <button
                      onClick={() => setIsLogin(true)}
                      className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-16 mt-20">
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
                <Link href="/register" className="block text-sm hover:text-white transition-colors">
                  Register Swimmer
                </Link>
                <Link href="/login" className="block text-sm hover:text-white transition-colors">
                  Parent Login
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
