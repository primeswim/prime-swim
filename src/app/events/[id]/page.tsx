'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Header from '@/components/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Event, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS, getEventStatus } from '@/types/event'
import { Calendar, MapPin, Clock, ExternalLink, FileText, ArrowLeft, Mail, Phone, Users } from 'lucide-react'

export default function EventDetailPage() {
  const params = useParams()
  const eventId = params?.id as string
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return

      try {
        setLoading(true)
        const res = await fetch(`/api/events/${eventId}?publishedOnly=true`)
        const data = await res.json()
        
        if (data.ok && data.event) {
          const eventData = data.event as Event & { startDate?: string | Date; endDate?: string | Date }
          setEvent({
            ...eventData,
            startDate: typeof eventData.startDate === 'string' ? eventData.startDate : (eventData.startDate instanceof Date ? eventData.startDate.toISOString().split('T')[0] : ''),
            endDate: eventData.endDate ? (typeof eventData.endDate === 'string' ? eventData.endDate : (eventData.endDate instanceof Date ? eventData.endDate.toISOString().split('T')[0] : '')) : undefined,
          } as Event)
        } else {
          setError('Event not found')
        }
      } catch (err) {
        console.error('Failed to fetch event:', err)
        setError('Failed to load event')
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [eventId])

  const formatDate = (date: string) => {
    if (!date) return 'N/A'
    const d = new Date(date)
    if (isNaN(d.getTime())) return 'Invalid Date'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <p className="text-center text-slate-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Event not found'}</p>
            <Link href="/events">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const status = getEventStatus(event)
  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-700',
    current: 'bg-green-100 text-green-700',
    past: 'bg-slate-100 text-slate-700',
    archived: 'bg-gray-100 text-gray-700',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      <Header />

      <div className="container mx-auto px-4 py-10">
        {/* Back Button */}
        <Link href="/events" className="inline-flex items-center text-slate-600 hover:text-slate-800 mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Link>

        {/* Event Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge className={EVENT_CATEGORY_COLORS[event.category]}>
              {EVENT_CATEGORY_LABELS[event.category]}
            </Badge>
            <Badge className={statusColors[status]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">{event.title}</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Event Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </CardContent>
            </Card>

            {/* Registration */}
            {event.registrationRequired && (
              <Card>
                <CardHeader>
                  <CardTitle>Registration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event.registrationUrl && (
                    <div>
                      <Button asChild className="w-full md:w-auto">
                        <a
                          href={event.registrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Register Now
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                      <p className="text-sm text-slate-600 mt-2">
                        This will open the USA Swimming registration page in a new tab.
                      </p>
                    </div>
                  )}
                  {event.registrationDeadline && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-400 rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-500 rounded-full p-2">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-orange-800 uppercase tracking-wide mb-1">
                            Registration Deadline
                          </div>
                          <div className="text-xl font-bold text-orange-900">
                            {formatDate(event.registrationDeadline)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {event.registrationNotes && (
                    <div className="bg-blue-50 border-l-4 border-blue-200 p-4 rounded-r-lg">
                      <p className="text-sm text-blue-800">{event.registrationNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents */}
            {event.documents && event.documents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Event Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {event.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <FileText className="h-5 w-5 text-slate-400" />
                        <span className="text-blue-600 hover:underline flex-1">{doc.name}</span>
                        <ExternalLink className="h-4 w-4 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Date & Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Date & Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Start</div>
                  <div className="font-medium">
                    {formatDate(event.startDate)}
                    {event.startTime && ` at ${formatTime(event.startTime)}`}
                  </div>
                </div>
                {event.endDate && (
                  <div>
                    <div className="text-sm text-slate-500 mb-1">End</div>
                    <div className="font-medium">
                      {formatDate(event.endDate)}
                      {event.endTime && ` at ${formatTime(event.endTime)}`}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location */}
            {event.location && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="font-medium">{event.location}</div>
                  {event.locationAddress && (
                    <div className="text-sm text-slate-600">{event.locationAddress}</div>
                  )}
                  {event.locationUrl && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a
                        href={event.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Map
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            {(event.contactEmail || event.contactPhone) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {event.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <a href={`mailto:${event.contactEmail}`} className="text-blue-600 hover:underline">
                        {event.contactEmail}
                      </a>
                    </div>
                  )}
                  {event.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <a href={`tel:${event.contactPhone}`} className="text-blue-600 hover:underline">
                        {event.contactPhone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            {event.maxParticipants && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Participants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-slate-600">
                    Maximum participants: <span className="font-medium">{event.maxParticipants}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

