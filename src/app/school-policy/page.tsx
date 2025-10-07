"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Heart,
  Camera,
  Cloud,
  AlertTriangle,
  Phone,
  Mail,
  ChevronRight,
  ArrowUp,
} from "lucide-react"

const policies = [
  {
    id: "registration-insurance",
    title: "Registration & Insurance Requirement",
    icon: Shield,
    content: [
      "Before any group lesson practice begins, each family must: (1) create a parent account, (2) add the child as a swimmer, and (3) finish registration (including required forms/waivers, emergency contacts, etc).",
      "Completion of registration activates insurance coverage for practices and program activities. For safety and liability reasons, swimmers who have not finished registration may not participate in group practices.",
      "Returning families must keep all information up to date (medical/emergency contacts, waivers, and payment details) and complete renewals as required by the club/LSC.",
      "Coaches and staff may verify a swimmer’s registration status at check-in; proof of registration may be requested.",
    ],
  },
  // NEW: Attendance & Spot Reservation policy per request
  {
    id: "attendance-hold",
    title: "Attendance & Spot Reservation (Group Lessons)",
    icon: Shield,
    content: [
      "If a swimmer does not attend any classes for 14 consecutive calendar days and the family has not coordinated with us 14 days ahead, we will stop reserving the spot and offer it to the next swimmer on the waitlist.",
      "To keep a group spot reserved, full regular monthly tuition must be paid on time. Tuition holds or partial payments do not reserve a spot.",
      "Missed classes may use the once‑per‑month make‑up clinic described below (subject to eligibility and capacity).",
    ],
  },
  {
    id: "makeup-cancellation",
    title: "Make-up & Cancellation Policy (Group Lessons)",
    icon: Calendar,
    content: [
      "This section applies to group lessons. Private lessons follow the separate Private Lesson Cancellation Policy below.",
      "Prime Swim Academy offers one make-up class each month for swimmers who missed a regularly scheduled group lesson. The make-up class time will be published monthly on our website/calendar and shared via email/WeChat.",
      "Eligibility: one make-up per swimmer per calendar month; capacity is limited and advance sign-up is required (first-come, first-served).",
      "Please note: Make-up classes are scheduled **once per month for all swimmers**, and we cannot provide additional make-up sessions or individual rescheduling requests. This ensures fairness and consistency for all families.",
      "Missed classes in a given month cannot be carried over into the next month. Allowing carryovers would make it difficult to keep the program fair for all families, maintain consistent scheduling, and accurately track each swimmer’s progress.",
      "Make-up credits do not roll over, are not transferable, and cannot be converted to refunds or tuition credits.",
    ],
  },
  {
    id: "private-cancellation",
    title: "Private Lesson Cancellation Policy",
    icon: Calendar,
    content: [
      "Cancellations must be made at least one week (7 days) before the scheduled private lesson to be eligible for a reschedule or credit.",
      "For lessons held at Mary Wayte Swimming Pool, a minimum of two weeks (14 days) advance notice is required due to the facility’s scheduling constraints.",
      "Cancellations made after the respective deadline will be considered a forfeiture of the session without refund or makeup. In cases of documented medical emergencies, exceptions may be granted at the academy’s discretion.",
      "In approved medical-emergency cases, the family remains responsible for covering the lane rental fee incurred by Prime Swim Academy for the scheduled session.",
      "Reschedules or credits are subject to coach and lane availability.",
    ],
  },
  {
    id: "refund",
    title: "Refund Policy (Group Lessons)",
    icon: DollarSign,
    content: [
      "Full refunds will be provided if a swimmer withdraws from the program at least two weeks before the scheduled start of the session.",
      "Please note: This refund policy applies only to withdrawing from the program before the session starts. No refunds will be given for missed classes after the session has begun, except in cases of documented medical emergencies. In such approved cases, families remain responsible for covering the lane rental fee already incurred by Prime Swim Academy.",
      "In the case of facility closures or session cancellations initiated by Prime Swim Academy, pro-rated refunds or credits for future classes will be issued.",
    ],
  },
  {
    id: "code-of-conduct",
    title: "Code of Conduct",
    icon: Shield,
    content: [
      "Respectful behavior is mandatory for all swimmers, parents, and guardians towards coaches, staff, and other participants.",
      "Bullying, harassment, aggressive behavior, or use of offensive language will result in disciplinary action, which may include suspension or expulsion without refund.",
      "Participants must follow safety instructions provided by coaches and staff at all times.",
    ],
  },
  {
    id: "safety-health",
    title: "Safety & Health Policy",
    icon: Heart,
    content: [
      "Swimmers must not attend classes if experiencing symptoms of illness, including but not limited to fever, contagious skin conditions, or respiratory issues.",
      "Participants must inform the coach about any existing medical conditions or health concerns.",
      "Prime Swim Academy reserves the right to request medical clearance from a physician before allowing participation.",
    ],
  },
  {
    id: "photo-video",
    title: "Photo & Video Consent Policy",
    icon: Camera,
    content: [
      "Parents/guardians may voluntarily consent to the use of images and videos of their child for promotional materials, including brochures, social media, and the academy's website.",
      "Consent is optional and must be explicitly provided during the registration process.",
    ],
  },
  {
    id: "weather-closure",
    title: "Weather & Facility Closure Policy",
    icon: Cloud,
    content: [
      "In case of adverse weather conditions, Prime Swim Academy will follow local safety advisories. Notifications of cancellations or closures will be communicated via email, WeChat, or other established communication channels.",
      "Makeup classes for weather-related closures will be scheduled subject to availability; refunds are not provided for weather closures.",
    ],
  },
  {
    id: "liability",
    title: "Liability Waiver",
    icon: AlertTriangle,
    content: [
      "Participation in swimming activities involves inherent risks. Parents/guardians acknowledge these risks and waive any liability claims against Prime Swim Academy, its employees, or affiliates for any injuries incurred during ordinary program participation.",
      "This waiver does not protect Prime Swim Academy from liability due to intentional misconduct.",
    ],
  },
  {
    id: "medical-treatment",
    title: "Medical Treatment Authorization",
    icon: Heart,
    content: [
      "In an emergency, Prime Swim Academy staff will attempt to contact parents/guardians or emergency contacts provided during registration.",
      "Parents/guardians authorize the academy staff to administer first aid and seek professional medical assistance when necessary if immediate contact cannot be established.",
    ],
  },
]

export default function SchoolPoliciesPage() {
  const [activeSection, setActiveSection] = useState<string>("")

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setActiveSection(id)
    }
  }

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = policies.map(policy => policy.id)
      const scrollPosition = window.scrollY + 100 // Offset for better detection

      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i])
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i])
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <FileText className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-6">
            School Policies
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Please review our comprehensive policies to ensure a safe, respectful, and enjoyable swimming experience for
            all participants at Prime Swim Academy.
          </p>
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 px-4 py-2">
            Last Updated: July 01, 2025
          </Badge>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16 -mt-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Table of Contents */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-8">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl font-bold flex items-center">
                <FileText className="w-6 h-6 mr-3" />
                Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                {policies.map((policy, index) => {
                  const IconComponent = policy.icon
                  const isActive = activeSection === policy.id
                  return (
                    <Button
                      key={policy.id}
                      variant={isActive ? "default" : "ghost"}
                      className={`justify-start h-auto p-3 text-left transition-colors ${
                        isActive 
                          ? "bg-blue-600 text-white hover:bg-blue-700" 
                          : "hover:bg-blue-50 hover:text-blue-700"
                      }`}
                      onClick={() => scrollToSection(policy.id)}
                    >
                      <IconComponent className={`w-4 h-4 mr-2 ${isActive ? "text-white" : "text-blue-500"}`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {index + 1}. {policy.title}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ml-2 ${isActive ? "text-white" : ""}`} />
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Policy Sections */}
          <div className="space-y-8">
            {policies.map((policy, index) => {
              const IconComponent = policy.icon
              return (
                <Card
                  key={policy.id}
                  id={policy.id}
                  className="shadow-xl border-0 bg-white/80 backdrop-blur-sm scroll-mt-20"
                >
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    <CardTitle className="text-2xl font-bold flex items-center">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm opacity-80 font-normal">Policy {index + 1}</div>
                        <div>{policy.title}</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      {policy.content.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg border-l-4 border-blue-500"
                        >
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-blue-600 font-bold text-sm">{itemIndex + 1}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Contact Information */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mt-12">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-bold flex items-center">
                <Phone className="w-7 h-7 mr-3" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <p className="text-lg text-slate-600 mb-6">
                  If you have questions or require clarification regarding these policies, please contact us:
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-100">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Email Us</h3>
                      <p className="text-slate-600 text-sm">We&apos;ll respond within 24 hours</p>
                    </div>
                  </div>
                  <a
                    href="mailto:prime.swim.us@gmail.com"
                    className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                  >
                    prime.swim.us@gmail.com
                  </a>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-100">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Call Us</h3>
                      <p className="text-slate-600 text-sm">Mon-Fri 8AM-6PM, Sat 9AM-3PM</p>
                    </div>
                  </div>
                  <a
                    href="tel:+14014020052"
                    className="text-green-600 font-semibold hover:text-green-700 transition-colors"
                  >
                    (401) 402-0052
                  </a>
                </div>
              </div>

              <div className="mt-8 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                <p className="text-center text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">Thank you for your cooperation</strong> and for helping maintain a
                  safe, respectful, and enjoyable environment at{" "}
                  <span className="font-semibold text-blue-600">Prime Swim Academy</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <Button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg z-50"
        size="icon"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  )
}
