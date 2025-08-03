import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Star, Trophy, Medal, Target, Heart, Waves, Mail, MapPin, Phone, CheckCircle } from "lucide-react"
import Header from "@/components/header";

export default function CoachesPage() {
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
          <span className="text-slate-800">Our Coaches</span>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-slate-800 mb-6 tracking-tight">Our Expert Coaches</h1>
          <p className="text-2xl md:text-3xl text-slate-600 mb-12 font-light">
            World-Class Instructors Dedicated to Your Swimming Excellence
          </p>
        </div>
      </section>

      {/* Head Coaches Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Head Coaches</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Meet our experienced leadership team who guide our academy to excellence
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Coach Lara */}
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-6">
              <div className="w-32 h-32 rounded-full mx-auto mb-6 overflow-hidden border-4 border-white shadow-lg">
                <Image
                  src="/images/coach-lara.jpeg"
                  alt="Coach Lara"
                  width={128}
                  height={128}
                  className="object-cover w-full h-full"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Coach Lara</CardTitle>
              <CardDescription className="text-slate-600 text-lg font-medium">Director & Head Coach</CardDescription>
            </CardHeader>
            <CardContent className="px-8">
              <p className="text-slate-700 text-base leading-relaxed mb-6">
                Passionate and experienced swimming coach with a proven record of developing athletes. Expert in USA
                Swimming standards, age-group progression, and seasonal planning. Strong communicator with swimmers,
                parents, and staff.
              </p>

              <div className="space-y-4 mb-6">
                <h4 className="font-semibold text-slate-800 mb-3">Certifications & Experience</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-blue-600" />
                    <span className="text-sm text-slate-600">USA Swimming Certified Coach</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-blue-600" />
                    <span className="text-sm text-slate-600">Head Coach Certification</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-blue-600" />
                    <span className="text-sm text-slate-600">Extensive experience coaching swimmers across different levels</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-blue-600" />
                    <span className="text-sm text-slate-600">Expert in Youth & Competitive Training</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800">Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Stroke Technique
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Building Training Plans
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Season Development
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Team Leadership
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Competition Prep
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coach Moe */}
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-6">
              <div className="w-32 h-32 rounded-full mx-auto mb-6 overflow-hidden border-4 border-white shadow-lg">
                <Image
                  src="/images/coach-moe.jpg"
                  alt="Coach Moe"
                  width={128}
                  height={128}
                  className="object-cover w-full h-full"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">Coach Moe</CardTitle>
              <CardDescription className="text-slate-600 text-lg font-medium">
                Head Coach & Performance Director
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8">
              <p className="text-slate-700 text-base leading-relaxed mb-6">
                Former Olympic swimmer with 12+ years coaching experience. Specializes in competitive stroke technique,
                mental preparation, and high-performance training.s
              </p>

              <div className="space-y-4 mb-6">
                <h4 className="font-semibold text-slate-800 mb-3">Achievements & Experience</h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center">
                    <Medal className="w-4 h-4 mr-3 text-purple-600" />
                    <span className="text-sm text-slate-600">Former Olympic Swimmer</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-purple-600" />
                    <span className="text-sm text-slate-600">USA Swimming Certified Coach</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-purple-600" />
                    <span className="text-sm text-slate-600">Head Coach Certification</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-purple-600" />
                    <span className="text-sm text-slate-600">Expert in Youth & Competitive Training</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-3 text-purple-600" />
                    <span className="text-sm text-slate-600">12+ Years Elite Coaching</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-slate-800">Specializations</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Elite Training
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Building Training Plans
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Season Development
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Race Strategy
                  </span>
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Mental Coaching
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Assistant Coaches Section */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Assistant Coaches</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Our dedicated team of assistant coaches who provide specialized instruction
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Coach Emma */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 bg-emerald-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-12 h-12 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Emma</CardTitle>
                <CardDescription className="text-slate-600">Youth Development Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  Specialized in youth swimming development and water safety. Creates engaging programs for young
                  swimmers aged 6-14 with focus on fun and skill building.
                </p>
                <div className="space-y-2 text-xs text-slate-500 mb-4">
                  <p>• Youth Swimming Specialist</p>
                  <p>• Water Safety Instructor</p>
                  <p>• 8 Years Experience</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded">Youth Programs</span>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded">Water Safety</span>
                </div>
              </CardContent>
            </Card>

            
          </div>
        </div>
      </section>

      {/* Coaching Philosophy Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Coaching Philosophy</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            The principles that guide our approach to swimming instruction and athlete development
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Individual Focus</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Every swimmer receives personalized attention and training plans tailored to their unique goals and
                abilities.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Positive Environment</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                We create a supportive, encouraging atmosphere where swimmers feel safe to challenge themselves and
                grow.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Excellence Driven</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                We strive for excellence in technique, performance, and character development both in and out of the
                pool.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-800">Lifelong Learning</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                We foster a love of swimming that extends beyond competition, creating lifelong swimmers and water
                enthusiasts.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-slate-800 mb-6">Ready to Train with Our Expert Coaches?</h2>
          <p className="text-xl text-slate-600 mb-12">
            Join Prime Swim Academy and experience world-class coaching that will transform your swimming journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              <Link href="/tryout">Schedule Your Tryout</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-0 shadow-xl bg-white hover:bg-slate-50 text-slate-800 px-8 py-6 text-lg rounded-full transition-all duration-300"
            >
              <Link href="/#programs">View Our Programs</Link>
            </Button>
          </div>
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
                <Link href="/tryout" className="block text-sm hover:text-white transition-colors">
                  Schedule Tryout
                </Link>
                <Link href="/#programs" className="block text-sm hover:text-white transition-colors">
                  Programs
                </Link>
                <Link href="/coaches" className="block text-sm hover:text-white transition-colors">
                  Our Coaches
                </Link>
                <Link href="/#schedule" className="block text-sm hover:text-white transition-colors">
                  Schedules
                </Link>
                <Link href="/news" className="block text-sm hover:text-white transition-colors">
                  News & Updates
                </Link>
                <Link href="/mission" className="block text-sm hover:text-white transition-colors">
                  Mission & Vision
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
