'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Event, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS, getEventStatus } from '@/types/event'
import { Calendar, MapPin, Clock, ExternalLink } from 'lucide-react'

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/events?publishedOnly=true')
        const data = await res.json()
        
        if (data.ok) {
          // Helper to convert date to string
          const dateToString = (date: string | Date | { toDate?: () => Date } | undefined): string => {
            if (!date) return ''
            if (typeof date === 'string') return date
            if (date instanceof Date) return date.toISOString().split('T')[0]
            if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
              return date.toDate().toISOString().split('T')[0]
            }
            return ''
          }
          
          const eventsList = data.events.map((e: Event & { startDate?: string | Date | { toDate?: () => Date }; endDate?: string | Date | { toDate?: () => Date } }) => ({
            ...e,
            startDate: dateToString(e.startDate),
            endDate: e.endDate ? dateToString(e.endDate) : undefined,
          }))
          setEvents(eventsList)
          setFilteredEvents(eventsList)
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  // Filter events
  useEffect(() => {
    let filtered = events

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => {
        const status = getEventStatus(event)
        if (statusFilter === 'upcoming') {
          return status === 'upcoming' || status === 'current'
        } else if (statusFilter === 'past') {
          return status === 'past' || status === 'archived'
        }
        return true
      })
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(event => event.category === categoryFilter)
    }

    // Sort: upcoming first, then by date
    filtered.sort((a, b) => {
      const aStatus = getEventStatus(a)
      const bStatus = getEventStatus(b)
      if (aStatus === 'current' && bStatus !== 'current') return -1
      if (bStatus === 'current' && aStatus !== 'current') return 1
      if (aStatus === 'upcoming' && bStatus === 'past') return -1
      if (bStatus === 'upcoming' && aStatus === 'past') return 1
      
      const aDate = new Date(a.startDate).getTime()
      const bDate = new Date(b.startDate).getTime()
      return aDate - bDate
    })

    setFilteredEvents(filtered)
  }, [statusFilter, categoryFilter, events])

  const formatDate = (date: string) => {
    if (!date) return 'N/A'
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'Invalid Date'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatDateTime = (date: string, time?: string) => {
    const dateStr = formatDate(date)
    if (time) {
      // Format time from 24-hour to 12-hour
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const hour12 = hour % 12 || 12
      return `${dateStr} at ${hour12}:${minutes} ${ampm}`
    }
    return dateStr
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <Image
            src="/images/psa-logo.png"
            alt="Prime Swim Academy Logo"
            width={100}
            height={100}
            className="mx-auto mb-6 rounded-full shadow-lg"
          />
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight">
            Upcoming Events
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8 font-light">
            Stay informed about swim meets, meetings, and academy activities
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex gap-4 flex-wrap">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'upcoming' | 'past' | 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="upcoming">Current & Upcoming</SelectItem>
              <SelectItem value="past">Past & Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
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
        </div>
      </section>

      {/* Events Grid */}
      <section className="container mx-auto px-4 py-12">
        {loading ? (
          <p className="text-center py-12 text-slate-600">Loading events...</p>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-lg mb-4">No events found</p>
            <p className="text-slate-500">Check back later for upcoming events!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event) => {
              const status = getEventStatus(event)
              const statusColors = {
                upcoming: 'bg-blue-100 text-blue-700',
                current: 'bg-green-100 text-green-700',
                past: 'bg-slate-100 text-slate-700',
                archived: 'bg-gray-100 text-gray-700',
              }
              
              return (
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={EVENT_CATEGORY_COLORS[event.category]}>
                        {EVENT_CATEGORY_LABELS[event.category]}
                      </Badge>
                      <Badge className={statusColors[status]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">{event.title}</CardTitle>
                    <CardDescription className="line-clamp-3">{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDateTime(event.startDate, event.startTime)}</span>
                      </div>
                      {event.endDate && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="h-4 w-4" />
                          <span>Ends: {formatDateTime(event.endDate, event.endTime)}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {event.registrationRequired && event.registrationUrl && (
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-blue-600" />
                          <a
                            href={event.registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Register Now
                          </a>
                        </div>
                      )}
                      {event.registrationDeadline && (
                        <div className="bg-orange-50 border-l-4 border-orange-400 p-2 rounded-r-lg">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-orange-600" />
                            <span className="text-xs font-semibold text-orange-800">
                              Registration Deadline: <span className="font-bold">{formatDate(event.registrationDeadline)}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Link href={`/events/${event.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          View Details
                        </Button>
                      </Link>
                      {event.registrationRequired && event.registrationUrl && (
                        <Button
                          asChild
                          variant="default"
                          className="flex-1"
                        >
                          <a
                            href={event.registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Register
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

