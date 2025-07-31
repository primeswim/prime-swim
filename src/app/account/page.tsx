// app/manage-account/page.tsx

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import Header from "@/components/header";
import {
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateEmail,
} from "firebase/auth"
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  Save,
} from "lucide-react"

export default function ManageAccountPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [profileData, setProfileData] = useState({
    parentFirstName: "",
    parentLastName: "",
    parentPhone: "",
    parentEmail: "",
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [userUID, setUserUID] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      setUserUID(user.uid)

      const swimmerQuery = query(collection(db, "swimmers"), where("parentUID", "==", user.uid))
      const snapshot = await getDocs(swimmerQuery)

      if (!snapshot.empty) {
        const first = snapshot.docs[0].data()
        setProfileData({
          parentFirstName: first.parentFirstName || "",
          parentLastName: first.parentLastName || "",
          parentPhone: first.parentPhone || "",
          parentEmail: user.email || "",
        })
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleSaveProfile = async () => {
    if (!userUID) return
    setIsLoading(true)
    setError("")

    try {
      const swimmerQuery = query(collection(db, "swimmers"), where("parentUID", "==", userUID))
      const snapshot = await getDocs(swimmerQuery)

      const updates = snapshot.docs.map((docRef) =>
        updateDoc(doc(db, "swimmers", docRef.id), {
          parentFirstName: profileData.parentFirstName,
          parentLastName: profileData.parentLastName,
          parentPhone: profileData.parentPhone,
          parentEmail: profileData.parentEmail,
        })
      )

      await Promise.all(updates)

      const user = auth.currentUser
      if (user && user.email !== profileData.parentEmail) {
        await updateEmail(user, profileData.parentEmail)
      }

      setSuccess("Profile updated for all swimmers!")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      console.error(err)
      setError("Failed to update profile. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData
    setError("")
    setSuccess("")

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.")
      return
    }

    try {
      const user = auth.currentUser
      if (!user || !user.email) throw new Error("No user found")

      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setSuccess("Password changed successfully!")
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err) {
      console.error(err)
      setError("Failed to change password. Please check your current password.")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-800 mb-6 text-center">Manage Account</h1>

        {error && (
          <Alert className="border-red-200 bg-red-50 mb-6">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-200 bg-green-50 mb-6">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-full bg-slate-100 p-1 shadow">
            <TabsTrigger value="profile" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black">Profile</TabsTrigger>
            <TabsTrigger value="security" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="shadow-lg border border-slate-200 bg-white mt-6">
              <CardHeader>
                <CardTitle>Parent Information</CardTitle>
                <CardDescription>Update your contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={profileData.parentFirstName}
                      onChange={(e) => handleProfileChange("parentFirstName", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={profileData.parentLastName}
                      onChange={(e) => handleProfileChange("parentLastName", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={profileData.parentEmail}
                    onChange={(e) => handleProfileChange("parentEmail", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={profileData.parentPhone}
                    onChange={(e) => handleProfileChange("parentPhone", e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isLoading} className="bg-slate-800 hover:bg-slate-900 text-white">
                    <Save className="w-4 h-4 mr-2" />
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="shadow-lg border border-slate-200 bg-white mt-6">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(passwordData).map(([field, value]) => {
                  const labels: Record<string, string> = {
                    currentPassword: "Current Password",
                    newPassword: "New Password",
                    confirmPassword: "Confirm New Password",
                  }
                  return (
                    <div key={field}>
                      <Label>{labels[field]}</Label>
                      <div className="relative">
                        <Input
                          type={showPassword[field as keyof typeof showPassword] ? "text" : "password"}
                          value={value}
                          onChange={(e) => handlePasswordChange(field, e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-2 text-slate-400"
                          onClick={() =>
                            setShowPassword((prev) => ({
                              ...prev,
                              [field]: !prev[field as keyof typeof prev],
                            }))
                          }
                        >
                          {showPassword[field as keyof typeof showPassword] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div className="flex justify-end">
                  <Button onClick={handleChangePassword} disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white">
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
