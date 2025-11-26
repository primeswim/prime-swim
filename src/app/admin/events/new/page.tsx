'use client'

import React, { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Event, EventCategory, EVENT_CATEGORY_LABELS, EventDocument } from '@/types/event'
import { Calendar, MapPin, Clock, Link as LinkIcon, FileText, Plus, X, AlertCircle, CheckCircle2, Upload } from 'lucide-react'
import { useIsAdminFromDB } from '@/hooks/useIsAdminFromDB'

export default function NewEventPage() {
  const router = useRouter()
  const isAdmin = useIsAdminFromDB()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<EventCategory>('swim_meet')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [locationUrl, setLocationUrl] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [registrationRequired, setRegistrationRequired] = useState(false)
  const [registrationNotes, setRegistrationNotes] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>(undefined)
  const [isPublished, setIsPublished] = useState(false)
  const [isArchived, setIsArchived] = useState(false)
  
  // Documents
  const [documents, setDocuments] = useState<EventDocument[]>([])
  const [newDocName, setNewDocName] = useState('')
  const [newDocUrl, setNewDocUrl] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login')
      }
    })
    return () => unsubscribe()
  }, [router])

  // Set default start date to today
  useEffect(() => {
    if (!startDate) {
      const today = new Date().toISOString().split('T')[0]
      setStartDate(today)
    }
  }, [])

  const addDocument = () => {
    if (!newDocName.trim() || !newDocUrl.trim()) {
      setError('Please provide both document name and URL')
      return
    }
    setDocuments([...documents, { id: Date.now().toString(), name: newDocName, url: newDocUrl }])
    setNewDocName('')
    setNewDocUrl('')
    setError('')
  }

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = auth.currentUser
      if (!user) {
        setError('You must be logged in')
        return
      }

      // Validation
      if (!title.trim() || !description.trim() || !startDate) {
        setError('Please fill in all required fields')
        return
      }

      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        category,
        description: description.trim(),
        startDate,
        startTime: startTime || undefined,
        endDate: endDate || undefined,
        endTime: endTime || undefined,
        location: location.trim() || undefined,
        locationAddress: locationAddress.trim() || undefined,
        locationUrl: locationUrl.trim() || undefined,
        registrationDeadline: registrationDeadline || undefined,
        registrationUrl: registrationUrl.trim() || undefined,
        registrationRequired,
        registrationNotes: registrationNotes.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        maxParticipants: maxParticipants || undefined,
        documents: documents.length > 0 ? documents : undefined,
        isPublished,
        isArchived,
        createdBy: user.email || user.uid,
      }

      const idToken = await user.getIdToken()
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(eventData),
      })

      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/events')
        }, 1500)
      } else {
        setError(data.error || 'Failed to create event')
      }
    } catch (err) {
      console.error('Failed to create event:', err)
      setError('Failed to create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking admin access…</p>
        </div>
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>You do not have permission to access this page.</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            Create New Event
          </h1>
          <p className="text-slate-600">Add a new event for Prime Swim Academy</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Event created successfully! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Enter the event title, category, and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Winter Junior Nationals, Board Meeting"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as EventCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a detailed description of the event..."
                  required
                  rows={6}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Date & Time
              </CardTitle>
              <CardDescription>Set the event date and time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (for multi-day events)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Location
              </CardTitle>
              <CardDescription>Event location information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location Name</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., King County Aquatic Center"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationAddress">Address</Label>
                <Textarea
                  id="locationAddress"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Full address of the event location"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationUrl">Location URL (Google Maps or venue website)</Label>
                <Input
                  id="locationUrl"
                  type="url"
                  value={locationUrl}
                  onChange={(e) => setLocationUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Registration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Registration
              </CardTitle>
              <CardDescription>Registration details and links</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="registrationRequired"
                  checked={registrationRequired}
                  onCheckedChange={(checked) => setRegistrationRequired(checked === true)}
                />
                <Label htmlFor="registrationRequired" className="cursor-pointer">
                  Registration Required
                </Label>
              </div>

              {registrationRequired && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                    <Input
                      id="registrationDeadline"
                      type="date"
                      value={registrationDeadline}
                      onChange={(e) => setRegistrationDeadline(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationUrl">Registration URL (USA Swimming link or other)</Label>
                    <Input
                      id="registrationUrl"
                      type="url"
                      value={registrationUrl}
                      onChange={(e) => setRegistrationUrl(e.target.value)}
                      placeholder="https://www.usaswimming.org/..."
                    />
                    <p className="text-xs text-slate-500">
                      For swim meets, this should be the USA Swimming registration link
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNotes">Registration Notes</Label>
                    <Textarea
                      id="registrationNotes"
                      value={registrationNotes}
                      onChange={(e) => setRegistrationNotes(e.target.value)}
                      placeholder="Additional notes about registration..."
                      rows={3}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Event Documents
              </CardTitle>
              <CardDescription>Add documents, PDFs, or links related to this event</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {doc.name}
                        </a>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newDocName">Document Name</Label>
                  <Input
                    id="newDocName"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="e.g., Meet Information Packet"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newDocUrl">Document URL</Label>
                  <Input
                    id="newDocUrl"
                    type="url"
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addDocument}
                disabled={!newDocName.trim() || !newDocUrl.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Document
              </Button>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Contact information and other details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Participants (optional)</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={maxParticipants || ''}
                  onChange={(e) => setMaxParticipants(e.target.value ? parseInt(e.target.value) : undefined)}
                  min={1}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </CardContent>
          </Card>

          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Publish Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={(checked) => setIsPublished(checked === true)}
                />
                <Label htmlFor="isPublished" className="cursor-pointer">
                  Publish Event (make it visible to public)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isArchived"
                  checked={isArchived}
                  onCheckedChange={(checked) => setIsArchived(checked === true)}
                />
                <Label htmlFor="isArchived" className="cursor-pointer">
                  Archive Event (mark as past/archived)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push('/admin/events')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

