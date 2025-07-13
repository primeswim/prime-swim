// components/news-card.tsx
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, Clock } from "lucide-react";
import type { NewsItem } from "@/data/news";

interface NewsCardProps {
  news: NewsItem;
  variant?: "default" | "compact";
}

export function NewsCard({ news, variant = "default" }: NewsCardProps) {
  const isCompact = variant === "compact";

  const getCategoryGradient = (category: string | undefined) => {
    if (!category) return "from-stone-50 to-white";
    switch (category.toLowerCase()) {
      case "technology":
        return "from-amber-50 to-amber-100";
      case "framework":
        return "from-slate-50 to-slate-100";
      case "css":
        return "from-yellow-50 to-yellow-100";
      case "language":
        return "from-purple-50 to-purple-100";
      case "architecture":
        return "from-red-50 to-red-100";
      case "performance":
        return "from-blue-50 to-blue-100";
      default:
        return "from-stone-50 to-white";
    }
  };

  return (
    <Card
      className={`border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br ${getCategoryGradient(
        news.category
      )}`}
    >
      <Link href={`/news/${news.id}`} className="block">
        {news.image && (
          <div className={`relative overflow-hidden rounded-t-lg ${isCompact ? "h-32" : "h-48"}`}>
            <Image
              src={news.image || "/placeholder.svg"}
              alt={news.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        <CardHeader className={isCompact ? "pb-2" : "pb-4"}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{news.category}</span>
            <div className="flex items-center text-xs text-slate-500">
              <Clock className="w-3 h-3 mr-1" />
              <span>5 min read</span>
            </div>
          </div>

          <CardTitle
            className={`font-bold text-slate-800 hover:text-slate-600 transition-colors line-clamp-2 ${
              isCompact ? "text-lg" : "text-xl"
            }`}
          >
            {news.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <CardDescription
            className={`text-slate-600 line-clamp-2 leading-relaxed ${isCompact ? "text-sm" : "text-base"}`}
          >
            {news.summary}
          </CardDescription>

          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <div className="flex items-center">
              <User className="w-3 h-3 mr-1" />
              <span>{news.author}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{new Date(news.publishDate).toLocaleDateString("en-US")}</span>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
