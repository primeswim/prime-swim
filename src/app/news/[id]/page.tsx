// app/news/[id]/page.tsx

import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Header from "@/components/header"
import { ArrowLeft, Calendar, User, Share2, Clock } from "lucide-react"

export const dynamic = "force-dynamic" // 每次都从 Firestore 拉数据

interface NewsItem {
  id: string
  title: string
  content?: string
  summary?: string
  image?: string
  category?: string
  author?: string
  publishDate?: string
}

export default async function NewsDetailPage({
    params,
  }: {
    params: { id: string }
  }) {
    const { id } = params

  // 获取单篇新闻
  const docRef = doc(db, "news", id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    notFound()
  }

  const news = { id: docSnap.id, ...docSnap.data() } as NewsItem

  // 获取其他相关新闻（除当前这篇）
  const snapshot = await getDocs(collection(db, "news"))
  const relatedNews = snapshot.docs
    .filter((d) => d.id !== id)
    .slice(0, 3)
    .map((d) => ({ id: d.id, ...d.data() } as NewsItem))

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <nav className="flex items-center space-x-2 text-sm text-slate-600 mb-8">
          <Link href="/" className="hover:text-slate-800">Home</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-slate-800">News</Link>
          <span>/</span>
          <span className="text-slate-800 line-clamp-1">{news.title}</span>
        </nav>

        <Link href="/news">
          <Button variant="outline" className="mb-8 border-0 shadow-lg bg-white hover:bg-slate-50 text-slate-800 rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to News
          </Button>
        </Link>

        <article className="max-w-4xl mx-auto mb-16">
          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            {news.image && (
              <div className="relative h-64 md:h-96">
                <Image src={news.image} alt={news.title} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>
            )}
            <CardContent className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-slate-100 text-slate-800 uppercase tracking-wide">
                  {news.category}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 leading-tight">{news.title}</h1>

              <div className="flex flex-wrap items-center gap-6 mb-8 text-slate-600 border-b border-slate-200 pb-6">
                {news.author && (
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    <span className="font-medium">{news.author}</span>
                  </div>
                )}
                {news.publishDate && (
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>
                      {new Date(news.publishDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>5 min read</span>
                </div>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 ml-auto">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Article
                </Button>
              </div>

              {news.summary && (
                <div className="bg-slate-50 border-l-4 border-slate-800 p-6 mb-8 rounded-r-lg">
                  <p className="text-slate-700 font-medium text-lg leading-relaxed italic">{news.summary}</p>
                </div>
              )}

              <div className="prose prose-lg prose-slate max-w-none">
                <div className="text-slate-700 leading-relaxed text-lg space-y-6">
                  {news.content?.split("\n\n").map((paragraph, index) => (
                    <p key={index} className="mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </article>

        {relatedNews.length > 0 && (
          <section className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Related Articles</h2>
              <p className="text-slate-600">Discover more swimming news and updates</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedNews.map((article) => (
                <Card key={article.id} className="border-0 shadow-lg hover:shadow-xl transition-all bg-white group">
                  <Link href={`/news/${article.id}`} className="block">
                    {article.image && (
                      <div className="relative h-40 overflow-hidden rounded-t-lg">
                        <Image src={article.image} alt={article.title} fill className="object-cover" />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="text-xs font-semibold text-slate-600 uppercase mb-2">{article.category}</div>
                      <h3 className="font-bold text-slate-800 mb-2 line-clamp-2">{article.title}</h3>
                      <p className="text-slate-600 text-sm line-clamp-3">{article.summary}</p>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ✅ 告诉 Next.js 支持的动态路径（推荐）
export async function generateStaticParams() {
  const snapshot = await getDocs(collection(db, "news"))
  return snapshot.docs.map((doc) => ({ id: doc.id }))
}
