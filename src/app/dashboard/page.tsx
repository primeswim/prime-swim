// app/dashboard/page.tsx
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  DocumentData,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Swimmer } from "@/types"
import Footer from "@/components/footer"
import { User, Users, Plus, LogOut, Settings, Waves, MoreHorizontal, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

type SwimmerWithMakeup = Swimmer & {
  nextMakeupText?: string
  nextMakeupId?: string
}

type RSVPStatus = "yes" | "no" | "none"

export default function DashboardPage() {
  const [parentEmail, setParentEmail] = useState<string>("")
  const [swimmers, setSwimmers] = useState<SwimmerWithMakeup[]>([])
  const [loading, setLoading] = useState(true)

  // RSVP 状态（key = `${swimmerId}_${makeupId}`）
  const [rsvpMap, setRsvpMap] = useState<Record<string, RSVPStatus>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      window.location.href = "/login"
    }
  }

  const handleDeleteSwimmer = async (swimmerId: string) => {
    if (!confirm("Are you sure you want to delete this swimmer?")) return
    try {
      await deleteDoc(doc(db, "swimmers", swimmerId))
      setSwimmers((prev) => prev.filter((s) => s.id !== swimmerId))
    } catch (error) {
      console.error("Failed to delete swimmer:", error)
      alert("Failed to delete swimmer. Please try again.")
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login"
        return
      }
      setParentEmail(user.email || "")

      // 获取 swimmer 数据 + nextMakeup 字段
      const swimmerQuery = query(collection(db, "swimmers"), where("parentUID", "==", user.uid))
      const swimmerSnapshot = await getDocs(swimmerQuery)
      const swimmerData: SwimmerWithMakeup[] = swimmerSnapshot.docs.map((d) => {
        const data = d.data() as DocumentData
        return {
          id: d.id,
          childFirstName: data.childFirstName,
          childLastName: data.childLastName,
          childDateOfBirth: data.childDateOfBirth,
          createdAt: data.createdAt,
          paymentStatus: data.paymentStatus,
          nextMakeupText: data.nextMakeupText,
          nextMakeupId: data.nextMakeupId,
        }
      })
      setSwimmers(swimmerData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // 加载 RSVP
  useEffect(() => {
    ;(async () => {
      const entries = swimmers
        .filter((s) => s.nextMakeupId && s.id)
        .map((s) => ({ key: `${s.id}_${s.nextMakeupId}`, swimmerId: s.id!, makeupId: s.nextMakeupId! }))

      if (!entries.length) return

      const nextMap: Record<string, RSVPStatus> = {}
      for (const { key, swimmerId, makeupId } of entries) {
        const rsvpDocRef = doc(db, "makeup_responses", `${swimmerId}_${makeupId}`)
        const snap = await getDoc(rsvpDocRef)
        if (snap.exists()) {
          const status = (snap.data().status as RSVPStatus) || "none"
          nextMap[key] = status
        } else {
          nextMap[key] = "none"
        }
      }
      setRsvpMap((prev) => ({ ...prev, ...nextMap }))
    })()
  }, [swimmers])

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const handleRSVP = async (swimmer: SwimmerWithMakeup, status: RSVPStatus) => {
    if (!swimmer.nextMakeupId) return;
    const key = `${swimmer.id}_${swimmer.nextMakeupId}`;
    try {
      setBusy((b) => ({ ...b, [key]: true }));
  
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);
  
      const res = await fetch("/api/makeup/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          swimmerId: swimmer.id,
          makeupId: swimmer.nextMakeupId,
          status,
        }),
      });
  
      const ctype = res.headers.get("content-type") || "";
      const payload = ctype.includes("application/json") ? await res.json() : { ok: false, error: await res.text() };
  
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `RSVP failed (${res.status})`);
      }
  
      setRsvpMap((m) => ({ ...m, [key]: status }));
    } catch (e) {
      console.error("RSVP update failed:", e);
      alert(e instanceof Error ? e.message : "Failed to update RSVP.");
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };  

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600 text-lg">
        Loading your dashboard...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/images/psa-logo.png"
                alt="Prime Swim Academy Logo"
                width={50}
                height={50}
                className="rounded-full"
              />
              <div>
                <span className="text-lg font-bold text-slate-800">Prime Swim Academy</span>
                <p className="text-sm text-slate-600">Parent Dashboard</p>
              </div>
            </Link>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{parentEmail}</p>
                </div>
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 bg-transparent"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome back!</h1>
          <p className="text-slate-600">Manage your swimmers and stay updated with their progress.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Register New Swimmer</CardTitle>
              <CardDescription className="text-slate-600">Add another child to your account</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/register">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                  Start Registration
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">My Swimmers</CardTitle>
              <CardDescription className="text-slate-600">
                {swimmers.length} active swimmer{swimmers.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button
                onClick={() => document.getElementById("swimmers-section")?.scrollIntoView({ behavior: "smooth" })}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50 rounded-full px-6"
              >
                View Details
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Account Settings</CardTitle>
              <CardDescription className="text-slate-600">Update your profile and preferences</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/account">
                <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50 rounded-full px-6 bg-transparent">
                  Manage Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Swimmers Section */}
        <div id="swimmers-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">My Swimmers</h2>
            <Link href="/register">
              <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Swimmer
              </Button>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {swimmers.map((swimmer) => {
              const nextText = swimmer.nextMakeupText || ""
              const nextId = swimmer.nextMakeupId || ""
              const rsvpKey = nextId ? `${swimmer.id}_${nextId}` : ""
              const rsvp = rsvpKey ? rsvpMap[rsvpKey] || "none" : "none"
              const isBusy = rsvpKey ? !!busy[rsvpKey] : false

              return (
                <Card key={swimmer.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                          <Waves className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-slate-800">
                            {swimmer.childFirstName} {swimmer.childLastName}
                          </CardTitle>
                          <CardDescription className="text-slate-600">
                            Age {calculateAge(swimmer.childDateOfBirth)}
                          </CardDescription>
                          <p className="text-sm text-slate-500 mt-1">
                            Registered on: {new Date(swimmer.createdAt?.seconds * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                            <MoreHorizontal className="w-5 h-5 text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600 focus:bg-red-50"
                            onClick={() => handleDeleteSwimmer(swimmer.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Payment */}
                    <div className="flex justify-end">
                      <div className="text-sm font-medium">
                        {swimmer.paymentStatus === "paid" ? (
                          <span className="text-green-600">✅ Paid</span>
                        ) : (
                          <span className="text-yellow-600">⏳ Pending</span>
                        )}
                      </div>
                    </div>

                    {/* Next make-up class + RSVP */}
                    <div className="mt-4 p-3 rounded-lg border bg-slate-50">
                      <div className="text-sm text-slate-600 mb-2">Next make-up class</div>
                      {nextText ? (
                        <>
                          <div className="font-medium text-slate-800">{nextText}</div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              disabled={!nextId || isBusy || rsvp === "yes"}
                              onClick={() => handleRSVP(swimmer, "yes")}
                              className="rounded-full px-4"
                            >
                              {isBusy && rsvp !== "yes" ? "Saving..." : rsvp === "yes" ? "✅ Going" : "I'm going"}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={!nextId || isBusy || rsvp === "no"}
                              onClick={() => handleRSVP(swimmer, "no")}
                              className="rounded-full px-4"
                            >
                              {isBusy && rsvp !== "no" ? "Saving..." : rsvp === "no" ? "❌ Not going" : "Not going"}
                            </Button>
                          </div>
                          {rsvp !== "none" && (
                            <div className="text-xs text-slate-500 mt-2">
                              Your selection has been recorded. You can change it anytime.
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-slate-500 text-sm">No make-up class announced yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Empty State */}
          {swimmers.length === 0 && (
            <Card className="border-0 shadow-lg bg-white text-center py-12">
              <CardContent>
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No Swimmers Yet</h3>
                <p className="text-slate-600 mb-6">Get started by registering your first swimmer.</p>
                <Link href="/register">
                  <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-full px-8">
                    <Plus className="w-4 h-4 mr-2" />
                    Register First Swimmer
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
