"use client";

import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, orderBy, where, limit } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { NewsCard } from "@/components/news-card";
import { Button } from "@/components/ui/button";
import { Newspaper, ArrowRight } from "lucide-react";
import Link from "next/link";
import { NewsItem } from "@/types/news";

export default function LatestNewsSection() {
  const [latestNews, setLatestNews] = useState<NewsItem[]>([]);
  const db = getFirestore(app);

  useEffect(() => {
    const fetchLatestNews = async () => {
      try {
        const q = query(
          collection(db, "news"),
          where("isPublished", "==", true),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const snapshot = await getDocs(q);
        const newsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NewsItem[];
        setLatestNews(newsList);
      } catch (error) {
        console.error("Failed to fetch latest news:", error);
        // Silently fail - don't break the page if news can't be loaded
        setLatestNews([]);
      }
    };

    fetchLatestNews();
  }, [db]);

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-slate-800 mb-4">Latest News & Updates</h2>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Stay informed with the latest swimming techniques, training tips, and academy updates
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
        {latestNews.map((news) => (
          <NewsCard key={news.id} news={news} variant="compact" />
        ))}
      </div>

      <div className="text-center">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-0 shadow-xl bg-white hover:bg-slate-50 text-slate-800 px-8 py-6 text-lg rounded-full transition-all duration-300"
        >
          <Link href="/news">
            <Newspaper className="w-5 h-5 mr-2" />
            View All News
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
