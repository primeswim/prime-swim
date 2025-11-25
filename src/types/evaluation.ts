import { Timestamp } from "firebase/firestore"

// 评分等级
export type RatingLevel = "excellent" | "good" | "needs_improvement" | "developing"

export const RATING_LABELS: Record<RatingLevel, string> = {
  excellent: "Excellent",
  good: "Good",
  developing: "Developing",
  needs_improvement: "Needs Improvement",
}

export const RATING_COLORS: Record<RatingLevel, string> = {
  excellent: "text-green-700 bg-green-100",
  good: "text-blue-700 bg-blue-100",
  developing: "text-yellow-700 bg-yellow-100",
  needs_improvement: "text-red-700 bg-red-100",
}

// 子分类（每个泳姿下的具体技能）
export interface EvaluationSubcategory {
  id: string
  name: string // 例如: "Body Position", "Arm Technique", "Leg Kicking", "Breathing"
  description?: string
  required: boolean
}

// 大类别（泳姿）
export interface EvaluationCategory {
  id: string
  name: string // 例如: "Freestyle", "Backstroke", "Breaststroke", "Butterfly"
  subcategories: EvaluationSubcategory[]
}

// 子分类的评分和评论
export interface SubcategoryScore {
  subcategoryId: string
  rating: RatingLevel
  comment: string // 教练的评论
}

// 类别评分（包含该类别下所有子分类的评分）
export interface CategoryScore {
  categoryId: string
  subcategoryScores: SubcategoryScore[]
}

// 评估模板
export interface EvaluationTemplate {
  id: string
  level: string // 例如: "Beginner", "Intermediate", "Advanced"
  name: string // 模板名称
  categories: EvaluationCategory[]
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
  createdBy: string // coach email
}

// 评估记录
export interface Evaluation {
  id: string
  swimmerId: string
  swimmerName: string // 冗余字段，方便查询
  templateId: string
  level: string // 评估时的 level
  evaluatedAt: Timestamp | Date
  evaluatedBy: string // coach name (optional, defaults to email if not provided)
  categoryScores: CategoryScore[] // 所有类别的评分
  overallComments: string // 总体评论
  coachRecommendation: {
    levelUp: boolean // 是否推荐升级
    recommendedLevel?: string // 推荐的下一级别
    recommendationNotes?: string // 推荐说明
  }
  createdAt: Timestamp | Date
}

// 用于前端展示的评估数据（包含模板信息）
export interface EvaluationWithTemplate extends Evaluation {
  template?: EvaluationTemplate
}

// Growth 数据点
export interface GrowthDataPoint {
  date: Date
  evaluationId: string
  level: string
  averageRating: number // 所有评分的平均值（转换为数字：excellent=4, good=3, developing=2, needs_improvement=1）
  categoryRatings: Record<string, number> // categoryId -> 平均评分
  subcategoryRatings: Record<string, number> // subcategoryId -> 评分
}

// 评分转换为数字（用于计算平均值）
export function ratingToNumber(rating: RatingLevel): number {
  const map: Record<RatingLevel, number> = {
    excellent: 4,
    good: 3,
    developing: 2,
    needs_improvement: 1,
  }
  return map[rating]
}

// 数字转换为评分
export function numberToRating(num: number): RatingLevel {
  if (num >= 3.5) return "excellent"
  if (num >= 2.5) return "good"
  if (num >= 1.5) return "developing"
  return "needs_improvement"
}
