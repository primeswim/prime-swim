import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, Eye, Heart, Users, Trophy, Waves, Star, Award } from "lucide-react"
import Header from "@/components/header";
import Footer from "@/components/footer";

export default function MissionPage() {
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
          <span className="text-slate-800">Mission & Vision</span>
        </nav>
      </div>

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
          <h1 className="text-5xl md:text-7xl font-bold text-slate-800 mb-6 tracking-tight">Mission & Vision</h1>
          <p className="text-2xl md:text-3xl text-slate-600 mb-12 font-light">
            Building Champions, One Stroke at a Time
          </p>
        </div>
      </section>

      {/* Mission & Vision Cards */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Mission Card */}
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-slate-800 mb-4">Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-8">
              <CardDescription className="text-slate-700 text-lg leading-relaxed mb-6">
                To provide exceptional swimming instruction that builds confident, disciplined, and skilled swimmers, while fostering a
                lifelong love of swimming in a safe, supportive, and inspiring environment.
              </CardDescription>
              <div className="space-y-3 text-slate-600">
                <div className="flex items-center justify-center">
                  <Heart className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="text-sm">Passionate instruction with care</span>
                </div>
                <div className="flex items-center justify-center">
                  <Users className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="text-sm">Building strong swimming communities</span>
                </div>
                <div className="flex items-center justify-center">
                  <Trophy className="w-5 h-5 mr-3 text-blue-600" />
                  <span className="text-sm">Developing champions at every level</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vision Card */}
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Eye className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-slate-800 mb-4">Our Vision</CardTitle>
            </CardHeader>
            <CardContent className="text-center px-8">
              <CardDescription className="text-slate-700 text-lg leading-relaxed mb-6">
              To be a leading force in youth swimming, inspiring young athletes to dream big, work hard, and grow into champions in and out of the pool. We strive for excellence, integrity, and a culture that values development over short-term results, welcoming swimmers of all backgrounds and earning recognition for building well-rounded, high-performing athletes.
              </CardDescription>
              <div className="space-y-3 text-slate-600">
                <div className="flex items-center justify-center">
                  <Star className="w-5 h-5 mr-3 text-purple-600" />
                  <span className="text-sm">Excellence in every aspect</span>
                </div>
                <div className="flex items-center justify-center">
                  <Waves className="w-5 h-5 mr-3 text-purple-600" />
                  <span className="text-sm">Leading innovation in swim training</span>
                </div>
                <div className="flex items-center justify-center">
                  <Award className="w-5 h-5 mr-3 text-purple-600" />
                  <span className="text-sm">Recognized as the best in the region</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Core Values</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              The principles that guide everything we do at Prime Swim Academy
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Excellence</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-slate-600 text-sm leading-relaxed">
                  We strive for excellence in every aspect of our instruction, from technique refinement to character
                  development.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Integrity</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-slate-600 text-sm leading-relaxed">
                  We conduct ourselves with honesty, respect, and transparency in all our interactions with swimmers and
                  families.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Community</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-slate-600 text-sm leading-relaxed">
                  We foster a supportive community where swimmers, families, and coaches work together toward common
                  goals.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Innovation</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-slate-600 text-sm leading-relaxed">
                  We continuously evolve our training methods and embrace new technologies to enhance the swimming
                  experience.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Our Commitment Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Commitment</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            What you can expect when you join the Prime Swim Academy family
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Personalized Training</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Every swimmer receives individualized attention and training plans tailored to their specific goals,
                abilities, and learning style.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Expert Coaching</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                Our certified coaches bring years of competitive experience and proven teaching methods to help you
                achieve your swimming potential.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-teal-50 to-teal-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Safe Environment</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-sm leading-relaxed">
                We maintain the highest safety standards and create a positive, encouraging atmosphere where swimmers
                can thrive and grow.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-slate-800 mb-6">Ready to Start Your Swimming Journey?</h2>
          <p className="text-xl text-slate-600 mb-12">
            Join Prime Swim Academy and experience the difference our mission and values make in your swimming
            development.
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
      <Footer />
    </div>
  )
}
