import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, AlertTriangle, BookOpen, ExternalLink, Phone, FileText } from "lucide-react"
import Header from "@/components/header"
import Footer from "@/components/footer"

export const metadata: Metadata = {
  title: "Safe Sport | Prime Swim Academy",
  description:
    "Prime Swim Academy's Safe Sport hub – report a concern, find training, read our Code of Conduct and safety policies, and access USA Swimming resources.",
  openGraph: {
    title: "Safe Sport | Prime Swim Academy",
    description:
      "Report a concern, required trainings, club policies (Code of Conduct, Anti-Bullying, Electronic Communication, Travel), and USA Swimming resources.",
    type: "website",
    url: "https://www.primeswimacademy.com/safesport",
  },
  alternates: { canonical: "/safesport" },
}

export default function SafeSportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">Safe Sport</h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Creating a Safe Environment for All Athletes
          </p>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            The safety and well-being of our swimmers are our highest priorities. Prime Swim Academy follows all USA
            Swimming Safe Sport policies and guidelines to ensure a positive, abuse-free environment for athletes,
            coaches, and families.
          </p>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: "Report a Concern", href: "#report", icon: AlertTriangle },
            { label: "Training", href: "#training", icon: BookOpen },
            { label: "Policies", href: "#policies", icon: FileText },
            { label: "Resources", href: "#resources", icon: ExternalLink },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center p-4 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border-0"
            >
              <item.icon className="w-6 h-6 text-slate-600 mb-2" />
              <span className="text-sm font-medium text-slate-800 text-center">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Report a Concern */}
      <section id="report" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Report a Concern</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            If you ever feel unsafe or observe concerning behavior, please speak up. You can report directly to USA
            Swimming or the U.S. Center for SafeSport, and you can also contact our club Safe Sport Coordinator.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">USA Swimming</CardTitle>
              <CardDescription className="text-slate-600">Report a Concern</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Submit a report to USA Swimming regarding misconduct or policy violations.
              </p>
              <Button asChild className="bg-red-600 hover:bg-red-700 text-white rounded-full">
                <a
                  href="https://www.usaswimming.org/safe-sport/report-a-concern"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Report Now <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">U.S. Center for SafeSport</CardTitle>
              <CardDescription className="text-slate-600">Make a Report</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Report sexual misconduct, bullying, harassment, hazing, or abuse.
              </p>
              <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white rounded-full">
                <a href="https://uscenterforsafesport.org/report-a-concern/" target="_blank" rel="noopener noreferrer">
                  Report Now <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Club Safe Sport Coordinator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <a
                    href="mailto:prime.swim.us@gmail.com"
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    prime.swim.us@gmail.com
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-medium text-slate-800">(401) 402-0052</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  If this is an emergency or someone is in immediate danger, call 911.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="training" className="bg-slate-50 py-20">
  <div className="container mx-auto px-4">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold text-slate-800 mb-4">Safe Sport Training</h2>
      <p className="text-lg text-slate-600 max-w-3xl mx-auto">
        Athletes, parents, coaches, and volunteers each play a role in building a safe team culture. 
        Please complete the applicable USA Swimming Safe Sport training:
      </p>
    </div>

    <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
      {/* Athletes (Ages 5–12) */}
      <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">Athletes (Ages 5–12)</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600 text-sm leading-relaxed mb-4">Safe Sport for Athletes</p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white rounded-full">
            <a
              href="https://university.usaswimming.org/landing?lmsCourseId=42"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Training <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Athletes (Ages 13–17) */}
      <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">Athletes (Ages 13–17)</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600 text-sm leading-relaxed mb-4">Safe Sport for Athletes</p>
          <Button asChild className="bg-green-600 hover:bg-green-700 text-white rounded-full">
            <a
              href="https://university.usaswimming.org/landing?lmsCourseId=51"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Training <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Parents */}
      <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">Parents</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600 text-sm leading-relaxed mb-4">Safe Sport for Parents</p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white rounded-full">
            <a
              href="https://university.usaswimming.org/landing?lmsCourseId=49"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Training <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Coaches & Non-Athlete Members */}
      <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">Coaches & Non-Athlete Members</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-slate-600 text-sm leading-relaxed mb-4">Education & APT Requirements</p>
          <Button asChild className="bg-slate-600 hover:bg-slate-700 text-white rounded-full">
            <a
              href="https://www.usaswimming.org/resource-center/athlete-protection-training"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start Training <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</section>


      {/* Policies Section */}
      <section id="policies" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Policies & Documents</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Prime Swim Academy adopts and enforces the following Safe Sport policies. These are reviewed at least
            annually and provided to families during registration.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[
            { label: "Code of Conduct", href: "/docs/safe-sport/code-of-conduct.pdf" },
            { label: "Electronic Communication Policy", href: "/docs/safe-sport/electronic-communication-policy.pdf" },
            { label: "Anti-Bullying Policy", href: "/docs/safe-sport/anti-bullying-policy.pdf" },
            { label: "Travel Policy", href: "/docs/safe-sport/travel-policy.pdf" },
            { label: "Parent Consent Forms", href: "/docs/safe-sport/prime-swim-academy-parent-consent-forms.pdf" },
          ].map((doc) => (
            <Card key={doc.label} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-slate-600" />
                    <span className="font-medium text-slate-800">{doc.label}</span>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
                    <a href={doc.href} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Resources Section */}
      <section id="resources" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">USA Swimming Resources</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Additional resources and information from USA Swimming
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {[
              {
                label: "USA Swimming – Safe Sport Home",
                href: "https://www.usaswimming.org/safe-sport",
                desc: "Policies, education, reporting, and club recognition program.",
              },
              {
                label: "Parent Resources",
                href: "https://www.usaswimming.org/swimmers-parents",
                desc: "Guides, FAQs, and best practices for supporting your athlete.",
              },
              {
                label: "Athlete Protection Training (APT)",
                href: "https://www.usaswimming.org/resource-center/athlete-protection-training",
                desc: "Required training for applicable USA Swimming members.",
              },
              {
                label: "Report a Concern",
                href: "https://www.usaswimming.org/safe-sport/report-a-concern",
                desc: "How to submit a report to USA Swimming.",
              },
            ].map((resource) => (
              <Card
                key={resource.label}
                className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">{resource.label}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{resource.desc}</p>
                    </div>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-slate-600 hover:text-slate-800 flex-shrink-0"
                    >
                      <a href={resource.href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-slate-100 rounded-lg p-8">
            <p className="text-sm text-slate-600 mb-2">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-slate-700 font-medium">
              Safe Sport is a shared responsibility. Thank you for partnering with Prime Swim Academy to keep our
              community safe.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
