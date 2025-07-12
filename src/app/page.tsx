import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Mail, MapPin, Phone, Trophy, Users, Waves } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={60}
              height={60}
              className="rounded-full"
            />
            <span className="text-xl font-bold text-slate-800">Prime Swim Academy</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#programs" className="text-slate-600 hover:text-slate-800 transition-colors">
              Programs
            </Link>
            <Link href="#coaches" className="text-slate-600 hover:text-slate-800 transition-colors">
              Coaches
            </Link>
            <Link href="#schedule" className="text-slate-600 hover:text-slate-800 transition-colors">
              Schedule
            </Link>
            <Link href="#contact" className="text-slate-600 hover:text-slate-800 transition-colors">
              Contact
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={120}
              height={120}
              className="mx-auto mb-6 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-800 mb-6 tracking-tight">Prime Swim Academy</h1>
          <p className="text-2xl md:text-3xl text-slate-600 mb-12 font-light">Swim with Confidence</p>
          <Button
            asChild
            size="lg"
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <Link href="/tryout">Schedule Tryout</Link>
          </Button>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Swimming Programs</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Tailored training programs designed to elevate your swimming performance at every level
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Bronze</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Perfect for beginners and developing swimmers. Focus on fundamental techniques, water safety, and
                building confidence in the pool.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 2 sessions per week</p>
                <p>• 45-minute sessions</p>
                <p>• Small group instruction</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Waves className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Silver</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Intermediate training for competitive swimmers. Advanced stroke refinement, endurance building, and race
                preparation.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 3 sessions per week</p>
                <p>• 60-minute sessions</p>
                <p>• Competition preparation</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-yellow-50 to-yellow-100 transform lg:scale-105">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Gold</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Elite training for serious competitive swimmers. High-performance coaching, advanced techniques, and
                championship preparation.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 5 sessions per week</p>
                <p>• 90-minute sessions</p>
                <p>• Elite competition focus</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Platinum</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Pre-elite training for national-level competitors. Advanced race strategy, mental conditioning, and
                championship-level preparation.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 6 sessions per week</p>
                <p>• 2-hour sessions</p>
                <p>• National competition prep</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Olympic</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Elite Olympic-level training for world-class athletes. Professional coaching, sports science support,
                and international competition preparation.
              </CardDescription>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 8+ sessions per week</p>
                <p>• 2.5-hour sessions</p>
                <p>• Olympic trials preparation</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Coaches Section */}
      <section id="coaches" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Expert Coaches</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              World-class instructors dedicated to your swimming excellence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-slate-600" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Lara</CardTitle>
                <CardDescription className="text-slate-600">Director & Head Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Passionate about swimming and teaching. Focuses on stroke efficiency and performance optimization.
                </p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>• USA Swimming Certified</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-slate-600" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Moe</CardTitle>
                <CardDescription className="text-slate-600">Head Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Former Olympic swimmer with 12+ years coaching experience. Specializes in competitive stroke technique
                  and mental preparation.
                </p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>• USA Swimming Certified</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-slate-600" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Emma</CardTitle>
                <CardDescription className="text-slate-600">Youth Development Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Specialized in youth swimming development and water safety. Creates engaging programs for young
                  swimmers aged 6-14.
                </p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>• Youth Swimming Specialist</p>
                  <p>• Water Safety Instructor</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Program Schedules</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Find the perfect training schedule that fits your lifestyle
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-amber-500" />
                Bronze Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2" />
                <span className="text-sm">Mon & Wed</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>4:00-4:45 PM (Ages 6-8)</p>
                <p>5:00-5:45 PM (Ages 9-12)</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">Weekend make-up sessions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-slate-600" />
                Silver Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2" />
                <span className="text-sm">Mon, Wed, Fri</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>6:00-7:00 PM (Ages 10-13)</p>
                <p>7:15-8:15 PM (Ages 14-16)</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">Saturday sessions available</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-yellow-500" />
                Gold Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2" />
                <span className="text-sm">Mon-Fri</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>5:30-7:00 AM</p>
                <p>7:30-9:00 PM</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">Weekend competition prep</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                Platinum Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2" />
                <span className="text-sm">Mon-Sat</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>5:00-7:00 AM</p>
                <p>6:00-8:00 PM</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">National meet preparation</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-red-600" />
                Olympic Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Clock className="w-4 h-4 mr-2" />
                <span className="text-sm">Daily</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>4:30-7:00 AM</p>
                <p>5:30-8:00 PM</p>
              </div>
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">Olympic trials focus</p>
              </div>
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
                  <span className="text-sm">Bellevue, Washington
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2 text-slate-300">
                <Link href="/tryout" className="block text-sm hover:text-white transition-colors">
                  Schedule Tryout
                </Link>
                <Link href="#programs" className="block text-sm hover:text-white transition-colors">
                  Programs
                </Link>
                <Link href="#coaches" className="block text-sm hover:text-white transition-colors">
                  Our Coaches
                </Link>
                <Link href="#schedule" className="block text-sm hover:text-white transition-colors">
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
