"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { NewsCard } from "@/components/news-card";
import { getFirestore, collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { app } from "@/lib/firebase"; // 你创建 firebase app 的地方
import Header from "@/components/header";
import { NewsItem } from "@/types/news";

export default function NewsPage() {
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const db = getFirestore(app);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const q = query(
          collection(db, "news"),
          where("isPublished", "==", true),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const newsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as NewsItem[];

        setAllNews(newsList);
      } catch (error) {
        console.error("Failed to fetch news:", error);
        // Silently fail - don't break the page if news can't be loaded
        setAllNews([]);
      }
    };

    fetchNews();
  }, [db]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Image
            src="/images/psa-logo.png"
            alt="Prime Swim Academy Logo"
            width={100}
            height={100}
            className="mx-auto mb-6 rounded-full shadow-lg"
          />
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
