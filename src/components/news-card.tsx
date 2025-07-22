import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, Clock } from "lucide-react";
import type { NewsItem } from "@/types/news";

interface NewsCardProps {
  news: NewsItem;
  variant?: "default" | "compact";
}

export function NewsCard({ news, variant = "default" }: NewsCardProps) {
  const isCompact = variant === "compact";

  return (
    <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white">
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
