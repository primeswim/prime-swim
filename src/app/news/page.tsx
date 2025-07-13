import Image from "next/image";
import Link from "next/link";
import { getAllNews } from "@/data/news";
import { NewsCard } from "@/components/news-card";

export default function NewsPage() {
  const allNews = getAllNews();

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
            <Link href="/" className="text-slate-600 hover:text-slate-800 transition-colors">
              Home
            </Link>
            <Link href="/#programs" className="text-slate-600 hover:text-slate-800 transition-colors">
              Programs
            </Link>
            <Link href="/#coaches" className="text-slate-600 hover:text-slate-800 transition-colors">
              Coaches
            </Link>
            <Link href="/#schedule" className="text-slate-600 hover:text-slate-800 transition-colors">
              Schedule
            </Link>
            <Link href="/#contact" className="text-slate-600 hover:text-slate-800 transition-colors">
              Contact
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={100}
              height={100}
              className="mx-auto mb-6 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">
            Latest News & Updates
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Stay informed with the latest swimming tips, academy news, and community updates
          </p>
        </div>
      </section>

      {/* News Grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allNews.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>
      </section>
    </div>
  );
}
