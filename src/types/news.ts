import { Timestamp } from "firebase/firestore";

export interface NewsItem {
  id: string;
  title: string;           // 必填
  content: string;         // 必填
  summary?: string;        // 可选摘要
  image?: string;          // ✅ 图片上传后生成的 download URL
  author?: string;         // 可选作者名
  publishDate: string;     // ✅ 用于前端显示（格式建议 YYYY-MM-DD）
  createdAt: Timestamp;    // ✅ Firestore serverTimestamp()
  isPublished: boolean;    // ✅ 是否展示
}