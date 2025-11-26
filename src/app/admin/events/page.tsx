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
import { Event, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS, getEventStatus } from '@/types/event'
import { Plus, ExternalLink, Search, Trash2, Edit, Calendar, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function AdminEventsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        fetchEvents()
      } else {
        router.push('/not-authorized')
      }
      setCheckedAuth(true)
    })
    return () => unsubscribe()
  }, [router])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch('/api/events', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        const eventsList = data.events.map((e: Event & { startDate?: string | Date; endDate?: string | Date; createdAt?: { toDate?: () => Date } | Date | string | null; updatedAt?: { toDate?: () => Date } | Date | string | null }) => {
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
          
          let updatedAt: Date
          if (e.updatedAt && typeof e.updatedAt === 'object' && 'toDate' in e.updatedAt && typeof e.updatedAt.toDate === 'function') {
            updatedAt = e.updatedAt.toDate()
          } else if (e.updatedAt instanceof Date) {
            updatedAt = e.updatedAt
          } else if (e.updatedAt && (typeof e.updatedAt === 'string' || typeof e.updatedAt === 'number')) {
            updatedAt = new Date(e.updatedAt)
          } else {
            updatedAt = new Date()
          }
          
          if (isNaN(createdAt.getTime())) createdAt = new Date()
          if (isNaN(updatedAt.getTime())) updatedAt = new Date()
          
          return {
            ...e,
            createdAt,
            updatedAt,
          }
        })
        setEvents(eventsList)
        setFilteredEvents(eventsList)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选事件
  useEffect(() => {
    let filtered = events

    // 按搜索词筛选
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(event => {
        return (
          event.title.toLowerCase().includes(term) ||
          event.description.toLowerCase().includes(term) ||
          (event.location?.toLowerCase().includes(term) ?? false) ||
          (event.category.toLowerCase().includes(term) ?? false)
        )
      })
    }

    // 按类别筛选
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(event => event.category === categoryFilter)
    }

    // 按状态筛选
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => {
        const status = getEventStatus(event)
        if (statusFilter === 'upcoming') return status === 'upcoming'
        if (statusFilter === 'current') return status === 'current'
        if (statusFilter === 'past') return status === 'past'
        if (statusFilter === 'archived') return status === 'archived'
        return true
      })
    }

    setFilteredEvents(filtered)
  }, [searchTerm, categoryFilter, statusFilter, events])

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return 'Invalid Date'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatDateTime = (date: string | Date | null | undefined, time?: string) => {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return 'Invalid Date'
    const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    if (time) {
      return `${dateStr} at ${time}`
    }
    return dateStr
  }

  const handleDelete = async () => {
    if (!eventToDelete) return

    try {
      setDeleting(true)
      const user = auth.currentUser
      if (!user) return
      const idToken = await user.getIdToken()

      const res = await fetch(`/api/events/${eventToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      const data = await res.json()
      if (data.ok) {
        await fetchEvents()
        setDeleteDialogOpen(false)
        setEventToDelete(null)
      } else {
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      alert('Failed to delete event')
    } finally {
      setDeleting(false)
    }
  }

  if (!checkedAuth || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking admin access…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Events Management</h1>
          <Link href="/admin/events/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="text-center py-8">Loading events...</p>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center py-8 text-slate-500">No events found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const status = getEventStatus(event)
                      const statusColors = {
                        upcoming: 'bg-blue-100 text-blue-700',
                        current: 'bg-green-100 text-green-700',
                        past: 'bg-slate-100 text-slate-700',
                        archived: 'bg-gray-100 text-gray-700',
                      }
                      return (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.title}</TableCell>
                          <TableCell>
                            <Badge className={EVENT_CATEGORY_COLORS[event.category]}>
                              {EVENT_CATEGORY_LABELS[event.category]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {formatDateTime(event.startDate, event.startTime)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {event.location ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                <span className="truncate max-w-[200px]">{event.location}</span>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[status]}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.isPublished ? (
                              <Badge className="bg-green-100 text-green-700">Published</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link href={`/admin/events/${event.id}/edit`}>
                                <Button variant="ghost" size="icon">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEventToDelete(event)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{eventToDelete?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

