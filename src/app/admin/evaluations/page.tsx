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
import { Plus, ExternalLink, Search, Trash2 } from 'lucide-react'
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
  const [fixingDates, setFixingDates] = useState(false)

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
        // 转换日期（API 返回的是毫秒数）
        const evals = data.evaluations.map((e: Evaluation & { evaluatedAt?: number | { toDate?: () => Date } | Date | string | null; createdAt?: number | { toDate?: () => Date } | Date | string | null }) => {
          // Parse createdAt (could be milliseconds from API or Timestamp object)
          let createdAt: Date
          if (typeof e.createdAt === 'number') {
            // API returns milliseconds
            createdAt = new Date(e.createdAt)
          } else if (e.createdAt && typeof e.createdAt === 'object' && 'toDate' in e.createdAt && typeof e.createdAt.toDate === 'function') {
            createdAt = e.createdAt.toDate()
          } else if (e.createdAt instanceof Date) {
            createdAt = e.createdAt
          } else if (e.createdAt && (typeof e.createdAt === 'string' || typeof e.createdAt === 'number')) {
            createdAt = new Date(e.createdAt)
          } else {
            createdAt = new Date() // 默认使用今天
          }
          
          if (isNaN(createdAt.getTime())) createdAt = new Date()
          
          // Parse evaluatedAt (could be milliseconds from API or Timestamp object)
          // Use evaluatedAt if valid, otherwise use createdAt
          let evaluatedAt: Date
          if (typeof e.evaluatedAt === 'number') {
            // API returns milliseconds
            evaluatedAt = new Date(e.evaluatedAt)
          } else if (e.evaluatedAt && typeof e.evaluatedAt === 'object' && 'toDate' in e.evaluatedAt && typeof e.evaluatedAt.toDate === 'function') {
            const parsed = e.evaluatedAt.toDate()
            evaluatedAt = !isNaN(parsed.getTime()) ? parsed : createdAt
          } else if (e.evaluatedAt instanceof Date && !isNaN(e.evaluatedAt.getTime())) {
            evaluatedAt = e.evaluatedAt
          } else if (e.evaluatedAt && (typeof e.evaluatedAt === 'string' || typeof e.evaluatedAt === 'number')) {
            const parsed = new Date(e.evaluatedAt)
            evaluatedAt = !isNaN(parsed.getTime()) ? parsed : createdAt
          } else {
            // If evaluatedAt is missing or invalid, use createdAt
            evaluatedAt = createdAt
          }
          
          if (isNaN(evaluatedAt.getTime())) {
            evaluatedAt = createdAt
          }
          
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

  const handleFixDates = async () => {
    if (!confirm('This will set all evaluation dates (evaluatedAt) to match their creation dates (createdAt).\n\nContinue?')) {
      return
    }

    try {
      setFixingDates(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch('/api/evaluations/fix-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        alert(`Successfully fixed dates: ${data.message}`)
        await fetchEvaluations()
      } else {
        alert(`Failed to fix dates: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to fix dates:', error)
      alert('Failed to fix dates. Please try again.')
    } finally {
      setFixingDates(false)
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleFixDates}
            disabled={fixingDates}
          >
            {fixingDates ? 'Fixing...' : 'Fix Dates'}
          </Button>
          <Button onClick={() => router.push('/admin/evaluations/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Evaluation
          </Button>
        </div>
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

