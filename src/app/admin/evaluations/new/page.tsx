'use client'

import React, { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  EvaluationTemplate,
  Evaluation,
  CategoryScore,
  SubcategoryScore,
  RatingLevel,
  RATING_LABELS,
  RATING_COLORS,
} from '@/types/evaluation'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Swimmer {
  id: string
  childFirstName: string
  childLastName: string
  parentEmail?: string
}

export default function NewEvaluationPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [swimmers, setSwimmers] = useState<Swimmer[]>([])
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([])
  const [selectedSwimmerId, setSelectedSwimmerId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [categoryScores, setCategoryScores] = useState<Record<string, CategoryScore>>({})
  const [overallComments, setOverallComments] = useState('')
  const [levelUp, setLevelUp] = useState(false)
  const [recommendedLevel, setRecommendedLevel] = useState('')
  const [recommendationNotes, setRecommendationNotes] = useState('')
  const [coachName, setCoachName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      const adminDocRef = doc(db, 'admin', user.email ?? '')
      const adminSnap = await getDoc(adminDocRef)
      if (adminSnap.exists()) {
        setIsAdmin(true)
        fetchSwimmers()
        fetchTemplates()
      } else {
        router.push('/not-authorized')
      }
      setCheckedAuth(true)
    })
    return () => unsubscribe()
  }, [router])

  const fetchSwimmers = async () => {
    try {
      const snap = await getDocs(collection(db, 'swimmers'))
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Swimmer[]
      setSwimmers(data.sort((a, b) =>
        `${a.childFirstName} ${a.childLastName}`.localeCompare(`${b.childFirstName} ${b.childLastName}`)
      ))
    } catch (error) {
      console.error('Failed to fetch swimmers:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/evaluation-templates')
      const data = await res.json()
      if (data.ok) {
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find(t => t.id === templateId)
    if (template) {
      // 初始化所有类别和子分类的评分
      const newCategoryScores: Record<string, CategoryScore> = {}
      template.categories.forEach(category => {
        const subcategoryScores: SubcategoryScore[] = category.subcategories.map(subcat => ({
          subcategoryId: subcat.id,
          rating: 'good' as RatingLevel,
          comment: '',
        }))
        newCategoryScores[category.id] = {
          categoryId: category.id,
          subcategoryScores,
        }
      })
      setCategoryScores(newCategoryScores)
    }
  }

  const handleSubcategoryScoreChange = (
    categoryId: string,
    subcategoryId: string,
    field: 'rating' | 'comment',
    value: RatingLevel | string
  ) => {
    setCategoryScores(prev => {
      const categoryScore = prev[categoryId]
      if (!categoryScore) return prev

      const newSubcategoryScores = categoryScore.subcategoryScores.map(sub =>
        sub.subcategoryId === subcategoryId
          ? { ...sub, [field]: value }
          : sub
      )

      return {
        ...prev,
        [categoryId]: {
          ...categoryScore,
          subcategoryScores: newSubcategoryScores,
        },
      }
    })
  }

  const handleSave = async () => {
    if (!selectedSwimmerId || !selectedTemplateId) {
      alert('Please select a swimmer and template')
      return
    }

    const template = templates.find(t => t.id === selectedTemplateId)
    if (!template) return

    // 验证必需子分类都已填写
    for (const category of template.categories) {
      const categoryScore = categoryScores[category.id]
      if (!categoryScore) {
        alert(`Please provide scores for category: ${category.name}`)
        return
      }

      for (const subcategory of category.subcategories) {
        if (subcategory.required) {
          const subcategoryScore = categoryScore.subcategoryScores.find(s => s.subcategoryId === subcategory.id)
          if (!subcategoryScore || !subcategoryScore.rating) {
            alert(`Please provide a rating for required subcategory: ${subcategory.name}`)
            return
          }
        }
      }
    }

    if (!overallComments.trim()) {
      alert('Please provide overall comments')
      return
    }

    const swimmer = swimmers.find(s => s.id === selectedSwimmerId)
    if (!swimmer) return

    try {
      setSaving(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const evaluationData: Omit<Evaluation, 'id' | 'createdAt'> = {
        swimmerId: selectedSwimmerId,
        swimmerName: `${swimmer.childFirstName} ${swimmer.childLastName}`,
        templateId: selectedTemplateId,
        level: template.level,
        categoryScores: Object.values(categoryScores),
        overallComments: overallComments.trim(),
        coachRecommendation: {
          levelUp,
          recommendedLevel: levelUp ? recommendedLevel.trim() : undefined,
          recommendationNotes: levelUp ? recommendationNotes.trim() : undefined,
        },
        evaluatedAt: new Date(),
        evaluatedBy: coachName.trim() || user.email || user.uid,
      }

      const res = await fetch('/api/evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(evaluationData),
      })

      const data = await res.json()
      if (data.ok) {
        alert('Evaluation saved successfully!')
        
        // 发送邮件通知（如果家长有邮箱）- 异步执行，不阻塞
        if (swimmer.parentEmail && data.id) {
          fetch('/api/evaluations/notify-parent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              evaluationId: data.id,
              swimmerId: selectedSwimmerId,
              parentEmail: swimmer.parentEmail,
              swimmerName: `${swimmer.childFirstName} ${swimmer.childLastName}`,
            }),
          }).catch(err => {
            console.warn('Failed to send notification email:', err)
          })
        }
        
        // 重置表单
        setSelectedSwimmerId('')
        setSelectedTemplateId('')
        setCategoryScores({})
        setOverallComments('')
        setLevelUp(false)
        setRecommendedLevel('')
        setRecommendationNotes('')
        
        // 使用 router.push 但确保在下一个 tick
        setTimeout(() => {
          router.push('/admin/evaluations')
        }, 0)
      } else {
        alert(`Failed to save: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to save evaluation:', error)
      alert('Failed to save evaluation')
    } finally {
      setSaving(false)
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  if (!checkedAuth) return <div className="p-6">Checking access...</div>
  if (!isAdmin) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Header />
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">New Evaluation</h1>
        <p className="text-muted-foreground">Create a new evaluation for a swimmer</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Swimmer Selection */}
          <div>
            <Label htmlFor="swimmer">Swimmer *</Label>
            <select
              id="swimmer"
              value={selectedSwimmerId}
              onChange={(e) => setSelectedSwimmerId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
            >
              <option value="">Select a swimmer...</option>
              {swimmers.map(swimmer => (
                <option key={swimmer.id} value={swimmer.id}>
                  {swimmer.childFirstName} {swimmer.childLastName}
                </option>
              ))}
            </select>
          </div>

          {/* Template Selection */}
          <div>
            <Label htmlFor="template">Evaluation Template *</Label>
            <select
              id="template"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mt-1"
            >
              <option value="">Select a template...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.level})
                </option>
              ))}
            </select>
          </div>

          {/* Categories Evaluation */}
          {selectedTemplate && (
            <div className="space-y-6">
              <Label className="text-lg font-semibold">Skills Evaluation</Label>
              {selectedTemplate.categories.map(category => {
                const categoryScore = categoryScores[category.id]
                return (
                  <div key={category.id} className="border rounded-lg p-4 space-y-4">
                    <h3 className="text-lg font-semibold">{category.name}</h3>
                    {category.subcategories.map(subcategory => {
                      const subcategoryScore = categoryScore?.subcategoryScores.find(
                        s => s.subcategoryId === subcategory.id
                      ) || { subcategoryId: subcategory.id, rating: 'good' as RatingLevel, comment: '' }

                      return (
                        <div key={subcategory.id} className="p-3 bg-accent/30 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="font-medium">
                                {subcategory.name}
                                {subcategory.required && <span className="text-red-500 ml-1">*</span>}
                              </Label>
                              {subcategory.description && (
                                <p className="text-sm text-muted-foreground">{subcategory.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label>Rating *</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(Object.keys(RATING_LABELS) as RatingLevel[]).map(rating => (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => handleSubcategoryScoreChange(category.id, subcategory.id, 'rating', rating)}
                                    className={cn(
                                      "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                                      subcategoryScore.rating === rating
                                        ? RATING_COLORS[rating]
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    )}
                                  >
                                    {RATING_LABELS[rating]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label>Comment</Label>
                              <Textarea
                                value={subcategoryScore.comment || ''}
                                onChange={(e) => handleSubcategoryScoreChange(category.id, subcategory.id, 'comment', e.target.value)}
                                placeholder="Add your comment..."
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Coach Name */}
          <div>
            <Label htmlFor="coachName">Coach Name (Optional)</Label>
            <Input
              id="coachName"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="Enter coach name (defaults to your email if not provided)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If left empty, your email will be used as the evaluator name
            </p>
          </div>

          {/* Overall Comments */}
          <div>
            <Label htmlFor="overallComments">Overall Comments *</Label>
            <Textarea
              id="overallComments"
              value={overallComments}
              onChange={(e) => setOverallComments(e.target.value)}
              placeholder="Overall evaluation and feedback..."
              rows={6}
              required
            />
          </div>

          {/* Coach Recommendation */}
          <div className="space-y-3 p-4 border rounded-lg bg-blue-50">
            <Label className="text-lg font-semibold">Coach Recommendation</Label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={levelUp}
                onChange={(e) => setLevelUp(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">Recommend Level Up</span>
            </label>

            {levelUp && (
              <div className="space-y-3 ml-6">
                <div>
                  <Label htmlFor="recommendedLevel">Recommended Next Level</Label>
                  <Input
                    id="recommendedLevel"
                    value={recommendedLevel}
                    onChange={(e) => setRecommendedLevel(e.target.value)}
                    placeholder="e.g., Intermediate"
                  />
                </div>
                <div>
                  <Label htmlFor="recommendationNotes">Recommendation Notes</Label>
                  <Textarea
                    id="recommendationNotes"
                    value={recommendationNotes}
                    onChange={(e) => setRecommendationNotes(e.target.value)}
                    placeholder="Explain why you recommend leveling up..."
                    rows={4}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Evaluation'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin/evaluations')}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
