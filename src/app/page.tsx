import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, Trophy, Users, Waves } from "lucide-react"
import Header from "@/components/header";
import LatestNewsSection from "@/components/latest-news-section"
import UpcomingEventsSection from "@/components/upcoming-events-section"
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

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
      {/* 徽章：USA & PNS —— 居中显示，尺寸与 PSA 同步 */}
      <div className="mt-4 md:mt-6 flex justify-center">
        <div className="flex items-center gap-4 md:gap-5">
          <Image
            src="/images/usa-swimming.png"
            alt="USA Swimming"
            width={120}
            height={120}
            className="w-[120px] h-[120px] object-contain"
            title="USA Swimming Member Club"
          />
          <Image
            src="/images/pns-logo.JPG"
            alt="Pacific Northwest Swimming (PNS)"
            width={120}
            height={120}
            className="w-[120px] h-[120px] object-contain"
            title="Pacific Northwest Swimming"
          />
        </div>
      </div>
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
              <CardDescription className="text-slate-600 text-sm leading-relaxed mb-4">
                Learning the basics such as floating, breathing, water safety and basic strokes.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold text-xs uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-amber-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-amber-800 text-sm font-medium space-y-1">
                  <li>Comfort in water</li>
                  <li>Swim 25 yards independently</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 2 sessions per week</p>
                <p>• 60-minute sessions</p>
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
              <CardDescription className="text-slate-600 text-sm leading-relaxed mb-4">
                Focusing on stroke development, learning proper technique and lane etiquette.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold text-xs uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-slate-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-slate-800 text-sm font-medium space-y-1">
                  <li>Swim 50 yards with legal technique in all the strokes</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 4 sessions per week</p>
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
              <CardDescription className="text-slate-600 text-sm leading-relaxed mb-4">
                Focusing on technique refinement, endurance, building, race skills and introduction to swim meet. Swimmers begin attending local competitions.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold text-xs uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-yellow-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-yellow-800 text-sm font-medium space-y-1">
                  <li>Legal strokes</li>
                  <li>Flip turn</li>
                  <li>Starts and consistent training habits</li>
                </ul>
              </div>
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
              <CardDescription className="text-slate-600 text-sm leading-relaxed mb-4">
                Focusing on more advanced stroke technique, interval training and goal setting. Regular meet participation and USA swimming times.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold text-xs uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-purple-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-purple-800 text-sm font-medium space-y-1">
                  <li>Qualify for large meets such as PNS champs</li>
                  <li>Age Group Champs</li>
                </ul>
              </div>
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
              <CardDescription className="text-slate-600 text-sm leading-relaxed mb-4">
                Focusing on race strategies, mental toughness, strength and conditioning, peak performance training and college prep. Highest commitment level and individualized training plans.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold text-xs uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-red-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-red-800 text-sm font-medium space-y-1">
                  <li>National level success</li>
                  <li>Achieve state and national Qualifying times</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-xs text-slate-500">
                <p>• 8+ sessions per week</p>
                <p>• 2.5-hour sessions</p>
                <p>• Olympic trials preparation</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <UpcomingEventsSection />

      <LatestNewsSection />
      
      {/* Coaches Section */}
      <section id="coaches" className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Expert Coaches</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              World-class instructors dedicated to your swimming excellence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto justify-items-center">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden border">
                  <Image
                    src="/images/coach-lara.jpeg"
                    alt="Coach Lara"
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Lara</CardTitle>
                <CardDescription className="text-slate-600">Director & Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Passionate and experienced swimming coach with a proven record of developing athletes. Expert in USA Swimming standards and China, age-group progression, and seasonal planning. Strong communicator with swimmers, parents, and staff.
                </p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>• USA Swimming Certified</p>
                  <p>• Head Coach Certified</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
              <CardHeader className="text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden border">
                  <Image
                    src="/images/coach-moe.jpg"
                    alt="Coach Moe"
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Coach Moe</CardTitle>
                <CardDescription className="text-slate-600">Head Coach</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Former Olympic swimmer with 12+ years coaching experience. Specializes in competitive stroke technique and mental preparation.
                </p>
                <div className="mt-4 text-xs text-slate-500">
                  <p>• USA Swimming Certified</p>
                  <p>• Head Coach Certified</p>
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
                <span className="text-sm">Weekdays & Weekend</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>7:00-8:00 PM (Mon)</p>
                <p>7:00-8:00 PM (Fri)</p>
                <p>4:00-5:00 PM (Sat)</p>
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
                <span className="text-sm">Weekdays</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>8:00-9:00 PM (Mon)</p>
                <p>8:00-9:00 PM (Tue)</p>
                <p>8:00-9:00 PM (Wed)</p>
                <p>8:00-9:00 PM (Thu)</p>
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
                <span className="text-sm">Weekdays & Weekend</span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p>8:00-9:00 PM (Mon)</p>
                <p>8:00-9:00 PM (Tue)</p>
                <p>8:00-9:00 PM (Wed)</p>
                <p>8:00-9:00 PM (Thu)</p>
                <p>10:00-11:00 AM (Sat)</p>
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
              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500">Olympic trials focus</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

    <Footer />

    </div>
  )
}
