'use client'

import React, { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Evaluation } from '@/types/evaluation'
import { Plus, ExternalLink, Search, Trash2, Edit, Calendar } from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function EvaluationsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [filteredEvaluations, setFilteredEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [evaluationToDelete, setEvaluationToDelete] = useState<Evaluation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [evaluationToEdit, setEvaluationToEdit] = useState<Evaluation | null>(null)
  const [editDate, setEditDate] = useState('')
  const [updating, setUpdating] = useState(false)

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
        fetchEvaluations()
      } else {
        router.push('/not-authorized')
      }
      setCheckedAuth(true)
    })
    return () => unsubscribe()
  }, [router])

  const fetchEvaluations = async () => {
    try {
      setLoading(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch('/api/evaluations', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        // 转换 Firestore Timestamp
        const evals = data.evaluations.map((e: Evaluation & { evaluatedAt?: { toDate?: () => Date } | Date | string | null; createdAt?: { toDate?: () => Date } | Date | string | null }) => {
          let evaluatedAt: Date
          if (e.evaluatedAt && typeof e.evaluatedAt === 'object' && 'toDate' in e.evaluatedAt && typeof e.evaluatedAt.toDate === 'function') {
            evaluatedAt = e.evaluatedAt.toDate()
          } else if (e.evaluatedAt instanceof Date) {
            evaluatedAt = e.evaluatedAt
          } else if (e.evaluatedAt && (typeof e.evaluatedAt === 'string' || typeof e.evaluatedAt === 'number')) {
            evaluatedAt = new Date(e.evaluatedAt)
          } else {
            evaluatedAt = new Date() // 默认使用今天
          }
          
          let createdAt: Date
          if (e.createdAt && typeof e.createdAt === 'object' && 'toDate' in e.createdAt && typeof e.createdAt.toDate === 'function') {
            createdAt = e.createdAt.toDate()
          } else if (e.createdAt instanceof Date) {
            createdAt = e.createdAt
          } else if (e.createdAt && (typeof e.createdAt === 'string' || typeof e.createdAt === 'number')) {
            createdAt = new Date(e.createdAt)
          } else {
            createdAt = new Date() // 默认使用今天
          }
          
          // 如果日期无效，使用今天
          if (isNaN(evaluatedAt.getTime())) evaluatedAt = new Date()
          if (isNaN(createdAt.getTime())) createdAt = new Date()
          
          return {
            ...e,
            evaluatedAt,
            createdAt,
          }
        })
        setEvaluations(evals)
        setFilteredEvaluations(evals)
      }
    } catch (error) {
      console.error('Failed to fetch evaluations:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选评估
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEvaluations(evaluations)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = evaluations.filter(evaluation => {
      return (
        evaluation.swimmerName.toLowerCase().includes(term) ||
        evaluation.level.toLowerCase().includes(term) ||
        evaluation.evaluatedBy.toLowerCase().includes(term) ||
        (evaluation.coachRecommendation.recommendedLevel?.toLowerCase().includes(term) ?? false)
      )
    })
    setFilteredEvaluations(filtered)
  }, [searchTerm, evaluations])

  const formatDate = (date: Date | string | { toDate?: () => Date } | null | undefined) => {
    if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    
    let d: Date
    if (typeof date === 'string') {
      d = new Date(date)
    } else if (date instanceof Date) {
      d = date
    } else if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate()
    } else {
      d = new Date()
    }
    
    if (isNaN(d.getTime())) {
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }
    
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDeleteClick = (evaluation: Evaluation) => {
    setEvaluationToDelete(evaluation)
    setDeleteDialogOpen(true)
  }

  const handleEditClick = (evaluation: Evaluation) => {
    setEvaluationToEdit(evaluation)
    // Format date as YYYY-MM-DD for input
    let dateStr: string
    if (evaluation.evaluatedAt instanceof Date) {
      dateStr = evaluation.evaluatedAt.toISOString().split('T')[0]
    } else if (typeof evaluation.evaluatedAt === 'string' || typeof evaluation.evaluatedAt === 'number') {
      dateStr = new Date(evaluation.evaluatedAt).toISOString().split('T')[0]
    } else {
      // Fallback to today
      dateStr = new Date().toISOString().split('T')[0]
    }
    setEditDate(dateStr)
    setEditDialogOpen(true)
  }

  const handleUpdateDate = async () => {
    if (!evaluationToEdit || !editDate) return

    try {
      setUpdating(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch(`/api/evaluations/${evaluationToEdit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          evaluatedAt: new Date(editDate).toISOString(),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setEditDialogOpen(false)
        setEvaluationToEdit(null)
        setEditDate('')
        await fetchEvaluations()
      } else {
        alert(`Failed to update date: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to update date:', error)
      alert('Failed to update date. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!evaluationToDelete) return

    try {
      setDeleting(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch(`/api/evaluations/${evaluationToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        // 刷新列表
        await fetchEvaluations()
        setDeleteDialogOpen(false)
        setEvaluationToDelete(null)
      } else {
        alert(`Failed to delete: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete evaluation:', error)
      alert('Failed to delete evaluation')
    } finally {
      setDeleting(false)
    }
  }

  if (!checkedAuth) return <div className="p-6">Checking access...</div>
  if (!isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Header />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Evaluations</h1>
          <p className="text-muted-foreground">View and manage all evaluations</p>
        </div>
        <Button onClick={() => router.push('/admin/evaluations/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Evaluation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Evaluations</CardTitle>
            <div className="w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, level, coach..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : evaluations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No evaluations yet</div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No evaluations match your search</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Swimmer</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Evaluated By</TableHead>
                  <TableHead>Promoted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>{formatDate(evaluation.evaluatedAt)}</TableCell>
                    <TableCell className="font-medium">{evaluation.swimmerName}</TableCell>
                    <TableCell>{evaluation.level}</TableCell>
                    <TableCell>{evaluation.evaluatedBy}</TableCell>
                    <TableCell>
                      {evaluation.coachRecommendation.levelUp ? (
                        <span className="text-green-600 font-medium">
                          ✓ {evaluation.coachRecommendation.recommendedLevel || 'Yes'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/evaluations/${evaluation.swimmerId}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(evaluation)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Edit date"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(evaluation)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Evaluation Date</DialogTitle>
            <DialogDescription>
              Update the evaluation date for {evaluationToEdit?.swimmerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-date" className="text-sm font-medium">
                Evaluation Date
              </label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full"
              />
              {evaluationToEdit && (
                <p className="text-xs text-muted-foreground">
                  Current date: {formatDate(evaluationToEdit.evaluatedAt)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEvaluationToEdit(null)
                setEditDate('')
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDate}
              disabled={updating || !editDate}
            >
              {updating ? 'Updating...' : 'Update Date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Evaluation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the evaluation for {evaluationToDelete?.swimmerName} on {evaluationToDelete ? formatDate(evaluationToDelete.evaluatedAt) : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setEvaluationToDelete(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

