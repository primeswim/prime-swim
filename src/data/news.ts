export interface NewsItem {
    id: number;
    title: string;
    date: string;
    summary: string;
    category: string;
    image?: string;
    content?: string;
    author: string;
    publishDate: string;
  }
  
  const allNews: NewsItem[] = [
    {
      id: 1,
      title: "Summer Swim Camp Registration Open",
      date: "2025-07-15",
      summary: "Join our exciting summer swim camp. Spaces are limited!",
      image: "/images/news1.jpg",
      content: "Full article text here...",
      author: "Coach Lara",
      publishDate: "2025-07-15",
      category: "Swim Camp"
    },
    {
      id: 2,
      title: "Coach Moe Recognized for Outstanding Coaching",
      date: "2025-06-10",
      summary: "Coach Moe was honored this season for dedication and positive impact on our swim team.",
      image: "/images/news2.jpg",    
      content: "Full article text here...",
      author: "Coach Lara",
      publishDate: "2025-06-10",
      category: "Coach Recognition"
    },
    {
      id: 3,
      title: "New Platinum Training Sessions",
      date: "2025-05-20",
      summary: "Introducing our new advanced training sessions for elite swimmers.",
      image: "/images/news3.jpg",
      content: "Full article text here...",
      author: "Coach Lara",
      publishDate: "2025-05-20",
      category: "Training"
    }
  ];
  
  export function getLatestNews(limit: number): NewsItem[] {
    return allNews.slice(0, limit);
  }
  
  export function getAllNews(): NewsItem[] {
    return allNews;
  }
  
  export function getNewsById(id: number): NewsItem | undefined {
    return allNews.find((n) => n.id === id);
  }
  