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
import { Calendar, Award, ArrowRight } from 'lucide-react'

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
          let evaluatedAt: Date
          if (e.evaluatedAt && typeof e.evaluatedAt === 'object' && 'toDate' in e.evaluatedAt && typeof e.evaluatedAt.toDate === 'function') {
            evaluatedAt = e.evaluatedAt.toDate()
          } else if (e.evaluatedAt instanceof Date) {
            evaluatedAt = e.evaluatedAt
          } else if (e.evaluatedAt && (typeof e.evaluatedAt === 'string' || typeof e.evaluatedAt === 'number')) {
            evaluatedAt = new Date(e.evaluatedAt)
          } else {
            evaluatedAt = new Date()
          }
          
          let createdAt: Date
          if (e.createdAt && typeof e.createdAt === 'object' && 'toDate' in e.createdAt && typeof e.createdAt.toDate === 'function') {
            createdAt = e.createdAt.toDate()
          } else if (e.createdAt instanceof Date) {
            createdAt = e.createdAt
          } else if (e.createdAt && (typeof e.createdAt === 'string' || typeof e.createdAt === 'number')) {
            createdAt = new Date(e.createdAt)
          } else {
            createdAt = new Date()
          }
          
          if (isNaN(evaluatedAt.getTime())) evaluatedAt = new Date()
          if (isNaN(createdAt.getTime())) createdAt = new Date()
          
          return {
            ...e,
            evaluatedAt,
            createdAt,
          }
        })
        setEvaluations(evals.sort((a: Evaluation, b: Evaluation) =>
          new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
        ))
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

  // 计算 growth 数据
  const growthData: GrowthDataPoint[] = evaluations.map(evaluation => {
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

    return {
      date: new Date(evaluation.evaluatedAt),
      evaluationId: evaluation.id,
      level: evaluation.level,
      averageRating: avgRating,
      categoryRatings,
      subcategoryRatings,
    }
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

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // 简单的折线图组件
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
    const height = 200
    const padding = 40

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding)
      const y = height - padding - ((values[i] - min) / range) * (height - 2 * padding)
      return { x, y, value: values[i], date: d.date }
    })

    return (
      <div className="w-full overflow-x-auto">
        {title && <h3 className="font-medium mb-2">{title}</h3>}
        <svg width={width} height={height} className="border rounded-lg bg-white">
          {[0, 1, 2, 3, 4].map(val => {
            const y = height - padding - ((val - min) / range) * (height - 2 * padding)
            return (
              <g key={val}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b">
                  {val}
                </text>
              </g>
            )
          })}

          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
              <title>{`${formatDate(p.date)}: ${p.value.toFixed(1)}`}</title>
            </g>
          ))}

          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          ))}
        </svg>
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
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Average rating across all skills over time (1=Needs Improvement, 4=Excellent)
                </p>
              </CardContent>
            </Card>

            {/* Category Progress Charts */}
            {Object.keys(categoryInfo).length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(categoryInfo).map(([categoryId, category]) => {
                      const hasData = growthData.some(d => d.categoryRatings[categoryId] !== undefined)
                      if (!hasData) return null
                      return (
                        <div key={categoryId} className="space-y-2">
                          <h3 className="font-semibold text-lg">{category.name}</h3>
                          <SimpleLineChart
                            data={growthData.map(d => ({
                              ...d,
                              averageRating: d.categoryRatings[categoryId] || 0,
                            }))}
                            title=""
                          />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subcategory Progress Charts */}
            {Object.keys(categoryInfo).length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {Object.entries(categoryInfo).map(([categoryId, category]) => (
                      <div key={categoryId} className="space-y-4">
                        <h3 className="font-semibold text-lg">{category.name}</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {Object.entries(category.subcategories).map(([subcategoryId, subcategory]) => {
                            const hasData = growthData.some(d => d.subcategoryRatings[subcategoryId] !== undefined)
                            if (!hasData) return null
                            return (
                              <div key={subcategoryId} className="space-y-2">
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
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evaluation List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Evaluation History
                </CardTitle>
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
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/evaluations/${swimmerId}/${evaluation.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">
                                {formatDate(evaluation.evaluatedAt)}
                              </h3>
                              {evaluation.coachRecommendation.levelUp && (
                                <span className="flex items-center gap-1 text-green-600 text-sm">
                                  <Award className="w-4 h-4" />
                                  Level Up Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Level: {evaluation.level} • Evaluated by: {evaluation.evaluatedBy}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Average Rating: <span className="font-medium">{avgRating.toFixed(1)}/4.0</span>
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
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
