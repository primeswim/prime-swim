'use client'

import React, { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { EvaluationTemplate, EvaluationCategory, EvaluationSubcategory } from '@/types/evaluation'
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react'

export default function EvaluationTemplatesPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<Partial<EvaluationTemplate>>({
    level: '',
    name: '',
    categories: [],
  })

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
        fetchTemplates()
      } else {
        router.push('/not-authorized')
      }
      setCheckedAuth(true)
    })
    return () => unsubscribe()
  }, [router])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/evaluation-templates')
      const data = await res.json()
      if (data.ok) {
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = () => {
    const newCategory: EvaluationCategory = {
      id: Date.now().toString(),
      name: '',
      subcategories: [],
    }
    setFormData({
      ...formData,
      categories: [...(formData.categories || []), newCategory],
    })
    setExpandedCategories(prev => new Set([...prev, newCategory.id]))
  }

  const handleUpdateCategory = (index: number, field: keyof EvaluationCategory, value: any) => {
    const newCategories = [...(formData.categories || [])]
    newCategories[index] = { ...newCategories[index], [field]: value }
    setFormData({ ...formData, categories: newCategories })
  }

  const handleRemoveCategory = (index: number) => {
    const newCategories = [...(formData.categories || [])]
    const categoryId = newCategories[index].id
    newCategories.splice(index, 1)
    setFormData({ ...formData, categories: newCategories })
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.delete(categoryId)
      return next
    })
  }

  const handleAddSubcategory = (categoryIndex: number) => {
    const newSubcategory: EvaluationSubcategory = {
      id: Date.now().toString(),
      name: '',
      required: true,
    }
    const newCategories = [...(formData.categories || [])]
    newCategories[categoryIndex].subcategories.push(newSubcategory)
    setFormData({ ...formData, categories: newCategories })
  }

  const handleUpdateSubcategory = (
    categoryIndex: number,
    subcategoryIndex: number,
    field: keyof EvaluationSubcategory,
    value: any
  ) => {
    const newCategories = [...(formData.categories || [])]
    newCategories[categoryIndex].subcategories[subcategoryIndex] = {
      ...newCategories[categoryIndex].subcategories[subcategoryIndex],
      [field]: value,
    }
    setFormData({ ...formData, categories: newCategories })
  }

  const handleRemoveSubcategory = (categoryIndex: number, subcategoryIndex: number) => {
    const newCategories = [...(formData.categories || [])]
    newCategories[categoryIndex].subcategories.splice(subcategoryIndex, 1)
    setFormData({ ...formData, categories: newCategories })
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!formData.level || !formData.name || !formData.categories || formData.categories.length === 0) {
      alert('Please fill in all required fields')
      return
    }

    // 验证所有类别都有名称
    if (formData.categories.some(c => !c.name.trim())) {
      alert('All categories must have a name')
      return
    }

    // 验证所有类别至少有一个子分类
    if (formData.categories.some(c => c.subcategories.length === 0)) {
      alert('Each category must have at least one subcategory')
      return
    }

    // 验证所有子分类都有名称
    for (const category of formData.categories) {
      if (category.subcategories.some(s => !s.name.trim())) {
        alert('All subcategories must have a name')
        return
      }
    }

    try {
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const url = '/api/evaluation-templates'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId
        ? { id: editingId, ...formData }
        : formData

      // 调试：打印发送的数据
      console.log('Sending template data:', JSON.stringify(body, null, 2))

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.ok) {
        alert('Template saved successfully!')
        setFormData({ level: '', name: '', categories: [] })
        setEditingId(null)
        setExpandedCategories(new Set())
        fetchTemplates()
      } else {
        console.error('Save error:', data)
        alert(`Failed to save: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template')
    }
  }

  const handleEdit = (template: EvaluationTemplate) => {
    setFormData({
      level: template.level,
      name: template.name,
      categories: template.categories,
    })
    setEditingId(template.id)
    setExpandedCategories(new Set(template.categories.map(c => c.id)))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch(`/api/evaluation-templates?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        fetchTemplates()
      } else {
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Failed to delete template')
    }
  }

  if (!checkedAuth) return <div className="p-6">Checking access...</div>
  if (!isAdmin) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Header />
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Evaluation Templates</h1>
        <p className="text-muted-foreground">Manage evaluation templates with categories and subcategories</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Template List */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No templates yet</div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-sm text-muted-foreground">Level: {template.level}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.categories.length} categor{template.categories.length !== 1 ? 'ies' : 'y'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Template Form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Template' : 'Create New Template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="level">Level *</Label>
              <Input
                id="level"
                value={formData.level || ''}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                placeholder="e.g., Beginner, Intermediate, Advanced"
              />
            </div>

            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Beginner Evaluation"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Categories (e.g., Freestyle, Backstroke) *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCategory}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Category
                </Button>
              </div>

              <div className="space-y-3">
                {(formData.categories || []).map((category, catIndex) => {
                  const isExpanded = expandedCategories.has(category.id)
                  return (
                    <div key={category.id} className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            className="p-1 hover:bg-accent rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <Input
                            placeholder="Category name (e.g., Freestyle)"
                            value={category.name}
                            onChange={(e) => handleUpdateCategory(catIndex, 'name', e.target.value)}
                            className="flex-1"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCategory(catIndex)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="ml-6 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Subcategories</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddSubcategory(catIndex)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add
                            </Button>
                          </div>

                          {category.subcategories.map((subcat, subIndex) => (
                            <div key={subcat.id} className="p-2 bg-accent/30 rounded space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Subcategory (e.g., Body Position)"
                                  value={subcat.name}
                                  onChange={(e) => handleUpdateSubcategory(catIndex, subIndex, 'name', e.target.value)}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveSubcategory(catIndex, subIndex)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-4">
                                <Textarea
                                  placeholder="Description (optional)"
                                  value={subcat.description || ''}
                                  onChange={(e) => handleUpdateSubcategory(catIndex, subIndex, 'description', e.target.value)}
                                  className="text-sm"
                                  rows={2}
                                />
                                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={subcat.required}
                                    onChange={(e) => handleUpdateSubcategory(catIndex, subIndex, 'required', e.target.checked)}
                                  />
                                  Required
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {editingId ? 'Update Template' : 'Create Template'}
            </Button>

            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setFormData({ level: '', name: '', categories: [] })
                  setEditingId(null)
                  setExpandedCategories(new Set())
                }}
                className="w-full"
              >
                Cancel Edit
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
