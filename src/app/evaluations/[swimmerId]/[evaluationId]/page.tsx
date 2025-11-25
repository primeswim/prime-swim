'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Evaluation,
  EvaluationTemplate,
  RATING_LABELS,
  RATING_COLORS,
} from '@/types/evaluation'
import { Award, ArrowLeft, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const swimmerId = params.swimmerId as string
  const evaluationId = params.evaluationId as string
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      await fetchData()
    })
    return () => unsubscribe()
  }, [swimmerId, evaluationId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 获取所有评估，然后找到对应的
      const user = auth.currentUser
      const idToken = user ? await user.getIdToken() : null

      const res = await fetch(`/api/evaluations?swimmerId=${swimmerId}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      })

      const data = await res.json()
      if (data.ok && data.evaluations) {
        const found = data.evaluations.find((e: Evaluation) => e.id === evaluationId)
        if (found) {
          // 转换日期
          let evaluatedAt: Date
          if (found.evaluatedAt && typeof found.evaluatedAt === 'object' && 'toDate' in found.evaluatedAt && typeof found.evaluatedAt.toDate === 'function') {
            evaluatedAt = found.evaluatedAt.toDate()
          } else if (found.evaluatedAt instanceof Date) {
            evaluatedAt = found.evaluatedAt
          } else if (found.evaluatedAt) {
            evaluatedAt = new Date(found.evaluatedAt)
          } else {
            evaluatedAt = new Date()
          }
          
          let createdAt: Date
          if (found.createdAt && typeof found.createdAt === 'object' && 'toDate' in found.createdAt && typeof found.createdAt.toDate === 'function') {
            createdAt = found.createdAt.toDate()
          } else if (found.createdAt instanceof Date) {
            createdAt = found.createdAt
          } else if (found.createdAt) {
            createdAt = new Date(found.createdAt)
          } else {
            createdAt = new Date()
          }
          
          if (isNaN(evaluatedAt.getTime())) evaluatedAt = new Date()
          if (isNaN(createdAt.getTime())) createdAt = new Date()
          
          const evalData = {
            ...found,
            evaluatedAt,
            createdAt,
          }
          
          setEvaluation(evalData)

          // 获取模板数据
          const templatesRes = await fetch('/api/evaluation-templates')
          const templatesData = await templatesRes.json()
          if (templatesData.ok) {
            const foundTemplate = templatesData.templates.find((t: EvaluationTemplate) => t.id === found.templateId)
            if (foundTemplate) {
              setTemplate(foundTemplate)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }


  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
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

  if (!evaluation) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-10">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Evaluation not found.</p>
              <Button
                variant="outline"
                onClick={() => router.push(`/evaluations/${swimmerId}`)}
                className="mt-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Evaluation History
              </Button>
            </CardContent>
          </Card>
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
          <Button
            variant="ghost"
            onClick={() => router.push(`/evaluations/${swimmerId}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Evaluation History
          </Button>
          <h1 className="text-3xl font-bold mb-2">
            Evaluation Details
          </h1>
          <p className="text-muted-foreground">
            {evaluation.swimmerName} • {formatDate(evaluation.evaluatedAt)}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5" />
                  Evaluation Information
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Level: {evaluation.level} • Evaluated by: {evaluation.evaluatedBy}
                </p>
              </div>
              {evaluation.coachRecommendation.levelUp && (
                <div className="flex items-center gap-2 text-green-600">
                  <Award className="w-5 h-5" />
                  <div>
                    <span className="font-medium">
                      Recommended for {evaluation.coachRecommendation.recommendedLevel || 'next level'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Categories and Subcategories */}
        {template && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Skills Evaluation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {evaluation.categoryScores.map(catScore => {
                  const category = template.categories.find(c => c.id === catScore.categoryId)
                  if (!category) return null

                  return (
                    <div key={catScore.categoryId} className="border rounded-lg p-6 space-y-4">
                      <h3 className="text-xl font-semibold">{category.name}</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {catScore.subcategoryScores.map(subScore => {
                          const subcategory = category.subcategories.find(
                            s => s.id === subScore.subcategoryId
                          )
                          if (!subcategory) return null

                          return (
                            <div key={subScore.subcategoryId} className="p-4 bg-accent/30 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{subcategory.name}</h4>
                                <span
                                  className={cn(
                                    'px-3 py-1 rounded-full text-sm font-medium',
                                    RATING_COLORS[subScore.rating]
                                  )}
                                >
                                  {RATING_LABELS[subScore.rating]}
                                </span>
                              </div>
                              {subcategory.description && (
                                <p className="text-xs text-muted-foreground">{subcategory.description}</p>
                              )}
                              {subScore.comment && (
                                <div className="pt-2 border-t">
                                  <p className="text-sm text-muted-foreground">{subScore.comment}</p>
                                </div>
                              )}
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

        {/* Overall Comments */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Overall Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {evaluation.overallComments}
            </p>
          </CardContent>
        </Card>

        {/* Coach Recommendation */}
        {evaluation.coachRecommendation.levelUp && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Coach Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-blue-50 rounded-lg p-6">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Recommended Level: {evaluation.coachRecommendation.recommendedLevel || 'Next Level'}
              </p>
              {evaluation.coachRecommendation.recommendationNotes && (
                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                  {evaluation.coachRecommendation.recommendationNotes}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  )
}

