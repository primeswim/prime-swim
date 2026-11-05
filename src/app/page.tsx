import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, ArrowUpRight, Calendar, ShoppingBag, Trophy } from "lucide-react"
import Header from "@/components/header";
import HomeHero from "@/components/home-hero";
import WhyChoosePrime from "@/components/why-choose-prime";
import LatestNewsSection from "@/components/latest-news-section"
import UpcomingEventsSection from "@/components/upcoming-events-section"
import Footer from "@/components/footer";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      <HomeHero />

      <WhyChoosePrime />

      {/* Programs Section */}
      <section id="programs" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Our Training Levels</h2>
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
              <CardDescription className="text-slate-600 text-base leading-relaxed mb-4">
                Learning the basics such as floating, breathing, water safety and basic strokes.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold text-sm uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-amber-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-amber-800 text-base font-medium space-y-1">
                  <li>Comfortable in the water and swim independently</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>• 1～2 sessions per week</p>
                <p>• 60-minute sessions</p>
                <p>• Small group instruction</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-slate-50 to-slate-100">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Silver</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-600 text-base leading-relaxed mb-4">
                Learning all four competitive strokes while improving endurance and technique.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold text-sm uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-slate-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-slate-800 text-base font-medium space-y-1">
                  <li>Swim 50 yards with legal technique in all the strokes</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>• 2～3 sessions per week</p>
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
              <CardDescription className="text-slate-600 text-base leading-relaxed mb-4">
                Building competitive skills and endurance, improving race technique, and learning starts as swimmers begin competing in swim meets.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold text-sm uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-yellow-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-yellow-800 text-base font-medium space-y-1">
                  <li>Compete with confidence and show steady progress</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>• 3～4 sessions per week</p>
                <p>• 75-minute sessions</p>
                <p>• Competitive development focus</p>
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
              <CardDescription className="text-slate-600 text-base leading-relaxed mb-4">
                Reach a higher level of performance and consistency through advanced stroke technique, race strategy and pacing. Preparing swimmers for the path to the elite level.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold text-sm uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-purple-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-purple-800 text-base font-medium space-y-1">
                  <li>Achieve PNS Championship qualifying standards.</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>• 5～6 sessions per week</p>
                <p>• 1.5～2-hour sessions</p>
                <p>• Advanced competitive development</p>
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
              <CardDescription className="text-slate-600 text-base leading-relaxed mb-4">
                Focusing on race strategies, mental toughness, strength and conditioning, peak performance training and college prep. Highest commitment level and individualized training plans.
              </CardDescription>
              <div className="flex flex-col items-center mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold text-sm uppercase tracking-wide shadow-sm">
                    <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4 mr-1 text-red-600' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-7-7 7-7-9 2-2 9z' /></svg>
                    Goals
                  </span>
                </div>
                <ul className="text-red-800 text-base font-medium space-y-1">
                  <li>Achieve national qualifying times</li>
                  <li>College swimming pathway</li>
                </ul>
              </div>
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>• 8+ sessions per week</p>
                <p>• 2-hour sessions</p>
                <p>• Olympic trials preparation</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Program Schedules</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          <Card className="gap-3 py-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-amber-500" />
                Bronze
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className={styles.scheduleTimes}>
                <p><strong>Mon</strong><span>6:30–7:30 PM</span></p>
                <p><strong>Thu</strong><span>5:00–5:55 PM</span></p>
                <p><strong>Fri</strong><span>5:00–6:00 PM</span></p>
                <p><strong>Sat</strong><span>5:00–6:00 PM</span></p>
                <p><strong>Sun</strong><span>4:00–5:00 PM</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-slate-600" />
                Silver
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className={styles.scheduleTimes}>
                <p><strong>Mon</strong><span>6:30–7:30 PM</span></p>
                <p><strong>Tue</strong><span>7:00–8:00 PM</span></p>
                <p><strong>Wed</strong><span>7:00–8:00 PM</span></p>
                <p><strong>Thu</strong><span>7:00–8:00 PM</span></p>
                <p><strong>Fri</strong><span>5:00–6:00 PM</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-yellow-500" />
                Gold
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className={styles.scheduleTimes}>
                <p><strong>Mon</strong><span>8:00–9:00 PM</span></p>
                <p><strong>Tue</strong><span>7:00–8:15 PM</span></p>
                <p><strong>Thu</strong><span>7:00–8:15 PM</span></p>
                <p><strong>Fri</strong><span>7:45–9:00 PM</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                Platinum
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className="pt-3 border-t">
                <p className="text-sm text-slate-500">National meet preparation</p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center text-lg font-bold text-slate-800">
                <Calendar className="w-5 h-5 mr-2 text-red-600" />
                Olympic
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className="pt-3 border-t">
                <p className="text-sm text-slate-500">Olympic trials focus</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <UpcomingEventsSection />

      {/* Coaches Section */}
      <section id="coaches" className="container mx-auto px-4 py-12" aria-labelledby="coaches-title">
        <div className={styles.coachIntro}>
          <div className={styles.coachFaces}>
            <Image src="/images/coach-lara.jpeg" alt="Coach Lara" width={80} height={80} />
            <Image src="/images/coach-moe.jpg" alt="Coach Mo" width={80} height={80} />
          </div>
          <div className={styles.coachCopy}>
            <h2 id="coaches-title"><Link href="/coaches">Our Coaches</Link></h2>
            <p>Olympic experience. Personal guidance. Get to know the people behind your swimmer’s progress.</p>
          </div>
          <Link href="/coaches" className={styles.coachCta}>
            Meet Lara &amp; Mo <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <LatestNewsSection />

      {/* Team Suit / Team Store */}
      <section id="team-store" className="container mx-auto px-4 py-10">
        <div className={styles.store}>
          <div className={styles.storeIcon}><ShoppingBag aria-hidden="true" /></div>
          <div>
            <h2>Team Suit &amp; Gear</h2>
            <p>Official Prime Swim Academy suits and training essentials.</p>
          </div>
          <a href="https://www.swimoutlet.com/collections/psa" target="_blank" rel="noopener noreferrer" className={styles.storeLink}>
            Shop Team Store <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>


    <Footer />

    </div>
  )
}
