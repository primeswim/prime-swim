'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Evaluation,
  EvaluationTemplate,
  GrowthDataPoint,
  ratingToNumber,
} from '@/types/evaluation'
import { Calendar, Award, ArrowRight, FileText } from 'lucide-react'

export default function SwimmerEvaluationsPage() {
  const params = useParams()
  const router = useRouter()
  const swimmerId = params.swimmerId as string
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [templates, setTemplates] = useState<Record<string, EvaluationTemplate>>({})
  const [loading, setLoading] = useState(true)
  const [swimmerName, setSwimmerName] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async () => {
      await fetchData()
    })
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimmerId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 获取评估数据
      const user = auth.currentUser
      const idToken = user ? await user.getIdToken() : null

      const res = await fetch(`/api/evaluations?swimmerId=${swimmerId}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      })

      const data = await res.json()
      console.log('Fetched evaluation data:', data)
      if (data.ok && data.evaluations) {
        console.log('Evaluations found:', data.evaluations.length)
        const evals = data.evaluations.map((e: Evaluation & { evaluatedAt?: { toDate?: () => Date } | Date | string | null; createdAt?: { toDate?: () => Date } | Date | string | null }) => {
          // API now returns ISO strings, so parse them
          let evaluatedAt: Date | null = null
          if (e.evaluatedAt) {
            if (typeof e.evaluatedAt === 'object' && 'toDate' in e.evaluatedAt && typeof e.evaluatedAt.toDate === 'function') {
              evaluatedAt = e.evaluatedAt.toDate()
            } else if (e.evaluatedAt instanceof Date) {
              evaluatedAt = e.evaluatedAt
            } else if (typeof e.evaluatedAt === 'string' || typeof e.evaluatedAt === 'number') {
              evaluatedAt = new Date(e.evaluatedAt)
            }
            
            if (evaluatedAt && isNaN(evaluatedAt.getTime())) {
              console.warn('Invalid evaluatedAt for evaluation:', e.id, e.evaluatedAt)
              evaluatedAt = null
            }
          }
          
          let createdAt: Date | null = null
          if (e.createdAt) {
            if (typeof e.createdAt === 'object' && 'toDate' in e.createdAt && typeof e.createdAt.toDate === 'function') {
              createdAt = e.createdAt.toDate()
            } else if (e.createdAt instanceof Date) {
              createdAt = e.createdAt
            } else if (typeof e.createdAt === 'string' || typeof e.createdAt === 'number') {
              createdAt = new Date(e.createdAt)
            }
            
            if (createdAt && isNaN(createdAt.getTime())) {
              console.warn('Invalid createdAt for evaluation:', e.id, e.createdAt)
              createdAt = null
            }
          }
          
          // Only use fallback if date is truly missing or invalid
          if (!evaluatedAt) {
            console.error('Missing evaluatedAt for evaluation:', e.id)
          }
          
          return {
            ...e,
            evaluatedAt: evaluatedAt || new Date(0), // Use epoch date as fallback
            createdAt: createdAt || new Date(0), // Use epoch date as fallback
          }
        })
        setEvaluations(evals.sort((a: Evaluation & { evaluatedAt: Date; createdAt: Date }, b: Evaluation & { evaluatedAt: Date; createdAt: Date }) => {
          // evaluatedAt 已经在上面转换为 Date 了
          const aDate = a.evaluatedAt.getTime()
          const bDate = b.evaluatedAt.getTime()
          return bDate - aDate
        }))
        if (evals.length > 0) {
          setSwimmerName(evals[0].swimmerName)
        } else {
          console.log('No evaluations found for swimmer:', swimmerId)
        }
      } else {
        console.error('Failed to fetch evaluations:', data)
      }

      // 获取模板数据
      const templatesRes = await fetch('/api/evaluation-templates')
      const templatesData = await templatesRes.json()
      if (templatesData.ok) {
        const templatesMap: Record<string, EvaluationTemplate> = {}
        templatesData.templates.forEach((t: EvaluationTemplate) => {
          templatesMap[t.id] = t
        })
        setTemplates(templatesMap)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算 growth 数据，按时间升序排序（从左到右显示从最早到最新）
  const growthData: GrowthDataPoint[] = evaluations
    .map(evaluation => {
      let totalRating = 0
      let count = 0
      const subcategoryRatings: Record<string, number> = {}
      const categoryRatings: Record<string, number> = {}

      evaluation.categoryScores.forEach(catScore => {
        let catTotal = 0
        let catCount = 0

        catScore.subcategoryScores.forEach(subScore => {
          const ratingNum = ratingToNumber(subScore.rating)
          totalRating += ratingNum
          count++
          subcategoryRatings[subScore.subcategoryId] = ratingNum
          catTotal += ratingNum
          catCount++
        })

        if (catCount > 0) {
          categoryRatings[catScore.categoryId] = catTotal / catCount
        }
      })

      const avgRating = count > 0 ? totalRating / count : 0

      // evaluatedAt 已经在上面转换为 Date 了
      return {
        date: evaluation.evaluatedAt as Date,
        evaluationId: evaluation.id,
        level: evaluation.level,
        averageRating: avgRating,
        categoryRatings,
        subcategoryRatings,
      }
    })
    .sort((a, b) => {
      // 按时间升序排序（最早的在前）
      return a.date.getTime() - b.date.getTime()
    })

  // 获取所有分类和子分类信息
  const categoryInfo = useMemo(() => {
    const info: Record<string, { name: string; subcategories: Record<string, { name: string; categoryName: string }> }> = {}
    Object.values(templates).forEach(template => {
      template.categories.forEach(category => {
        if (!info[category.id]) {
          info[category.id] = {
            name: category.name,
            subcategories: {},
          }
        }
        category.subcategories.forEach(subcategory => {
          info[category.id].subcategories[subcategory.id] = {
            name: subcategory.name,
            categoryName: category.name,
          }
        })
      })
    })
    return info
  }, [templates])

  const formatDate = (date: Date | string | { toDate?: () => Date } | null | undefined) => {
    if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    
    let d: Date
    if (typeof date === 'string') {
      d = new Date(date)
    } else if (date instanceof Date) {
      d = date
    } else if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate()
    } else {
      d = new Date()
    }
    
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // 优化的折线图组件
  const SimpleLineChart = ({
    data,
    subcategoryId,
    title,
  }: {
    data: GrowthDataPoint[]
    subcategoryId?: string
    title?: string
  }) => {
    if (data.length === 0) return <div className="text-center py-8 text-muted-foreground">No data</div>

    const values = data.map(d =>
      subcategoryId ? d.subcategoryRatings[subcategoryId] || 0 : d.averageRating
    )
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 4)
    const range = max - min || 1
    const width = 600
    const height = 220
    const padding = 50

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding)
      const y = height - padding - ((values[i] - min) / range) * (height - 2 * padding)
      return { x, y, value: values[i], date: d.date }
    })

    // 根据值获取颜色
    const getColorForValue = (val: number) => {
      if (val >= 3.5) return '#10b981' // green for excellent
      if (val >= 2.5) return '#3b82f6' // blue for good
      if (val >= 1.5) return '#f59e0b' // yellow for developing
      return '#ef4444' // red for needs improvement
    }

    return (
      <div className="w-full">
        {title && <h4 className="font-semibold text-base mb-3 text-slate-700">{title}</h4>}
        <div className="w-full overflow-x-auto">
          <svg width={width} height={height} className="rounded-lg">
            {/* 背景渐变 */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f0f9ff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 网格线 */}
            {[0, 1, 2, 3, 4].map(val => {
              const y = height - padding - ((val - min) / range) * (height - 2 * padding)
              const isMainLine = val === 1 || val === 2 || val === 3 || val === 4
              return (
                <g key={val}>
                  <line 
                    x1={padding} 
                    y1={y} 
                    x2={width - padding} 
                    y2={y} 
                    stroke={isMainLine ? "#cbd5e1" : "#f1f5f9"} 
                    strokeWidth={isMainLine ? "1.5" : "1"}
                    strokeDasharray={isMainLine ? "0" : "4,4"}
                  />
                  <text 
                    x={padding - 15} 
                    y={y + 5} 
                    textAnchor="end" 
                    fontSize="11" 
                    fill="#64748b"
                    fontWeight={isMainLine ? "600" : "400"}
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* 填充区域 */}
            {points.length > 1 && (
              <polygon
                points={`${points[0].x},${height - padding} ${points.map(p => `${p.x},${p.y}`).join(' ')} ${points[points.length - 1].x},${height - padding}`}
                fill="url(#gradient)"
              />
            )}

            {/* 折线 */}
            <polyline
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 数据点 */}
            {points.map((p, i) => {
              const color = getColorForValue(p.value)
              return (
                <g key={i}>
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="6" 
                    fill="white" 
                    stroke={color}
                    strokeWidth="2.5"
                  />
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="3" 
                    fill={color}
                  />
                  <title>{`${formatDate(p.date)}: ${p.value.toFixed(1)} (${p.value >= 3.5 ? 'Excellent' : p.value >= 2.5 ? 'Good' : p.value >= 1.5 ? 'Developing' : 'Needs Improvement'})`}</title>
                </g>
              )
            })}

            {/* X轴日期标签 */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={height - padding + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
                fontWeight="500"
              >
                {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            ))}
          </svg>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="text-center py-20">Loading...</div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {swimmerName || 'Swimmer'} Evaluation History
          </h1>
          <p className="text-muted-foreground">Track progress and growth over time</p>
        </div>

        {evaluations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No evaluations yet for this swimmer.</p>
              <p className="text-xs text-muted-foreground mt-2">Swimmer ID: {swimmerId}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overall Progress Chart */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <SimpleLineChart data={growthData} />
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-center mb-2">Average Rating Across All Skills Over Time</p>
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">1:</span>
                      <span className="text-red-600">Needs Improvement</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">2:</span>
                      <span className="text-yellow-600">Developing</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">3:</span>
                      <span className="text-blue-600">Good</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">4:</span>
                      <span className="text-green-600">Excellent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subcategory Progress Charts */}
            {Object.keys(categoryInfo).length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="space-y-8">
                    {Object.entries(categoryInfo).map(([categoryId, category]) => {
                      // 检查这个类别下是否有数据
                      const hasSubcategoryData = Object.keys(category.subcategories).some(subcategoryId =>
                        growthData.some(d => d.subcategoryRatings[subcategoryId] !== undefined)
                      )
                      if (!hasSubcategoryData) return null

                      return (
                        <div key={categoryId} className="space-y-4">
                          <h3 className="text-xl font-semibold text-slate-800 border-b pb-2">{category.name}</h3>
                          <div className="grid md:grid-cols-2 gap-6">
                            {Object.entries(category.subcategories).map(([subcategoryId, subcategory]) => {
                              const hasData = growthData.some(d => d.subcategoryRatings[subcategoryId] !== undefined)
                              if (!hasData) return null
                              return (
                                <div key={subcategoryId} className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:shadow-md transition-shadow">
                                  <SimpleLineChart
                                    data={growthData}
                                    subcategoryId={subcategoryId}
                                    title={subcategory.name}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evaluation Details List */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5" />
                    Evaluation Details
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Click on any evaluation below to view detailed comments and feedback from your coach
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {evaluations.map((evaluation) => {
                    // 计算平均分
                    let total = 0
                    let count = 0
                    evaluation.categoryScores.forEach(catScore => {
                      catScore.subcategoryScores.forEach(subScore => {
                        total += ratingToNumber(subScore.rating)
                        count++
                      })
                    })
                    const avgRating = count > 0 ? total / count : 0

                    return (
                      <div
                        key={evaluation.id}
                        className="border-2 border-blue-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-r from-blue-50/50 to-white"
                        onClick={() => router.push(`/evaluations/${swimmerId}/${evaluation.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-slate-800">
                                {formatDate(evaluation.evaluatedAt)}
                              </h3>
                              {evaluation.coachRecommendation.levelUp && (
                                <span className="flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-50 px-2 py-1 rounded-full">
                                  <Award className="w-4 h-4" />
                                  Level Up Recommended
                                </span>
                              )}
                            </div>
                            <div className="space-y-2 mb-3">
                              <p className="text-sm text-slate-600">
                                <span className="font-semibold">Level:</span> {evaluation.level} • <span className="font-semibold">Evaluated by:</span> {evaluation.evaluatedBy}
                              </p>
                              <p className="text-sm text-slate-600">
                                <span className="font-semibold">Average Rating:</span> <span className="font-bold text-blue-600">{avgRating.toFixed(1)}/4.0</span>
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-blue-200">
                              <p className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                View detailed comments and feedback →
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <ArrowRight className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
