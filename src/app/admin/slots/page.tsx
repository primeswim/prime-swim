// File: app/admin/slots/page.tsx
"use client"

import { useState } from "react"
import { Timestamp, collection, addDoc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, Trash2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const coaches = [
  { id: 1, name: "Coach Lara" },
  { id: 2, name: "Coach Moe" },
  { id: 3, name: "Coach Emma" },
]

const locations = [
  { id: 1, name: "Bellevue Aquatic Center" },
  { id: 2, name: "Redmond Pool" },
  { id: 3, name: "Mary Wayte Swimming Pool" },
]

export default function AddSlotPage() {
  const [mode, setMode] = useState<"single" | "recurring" | "delete">("single")
  
  // Single slot form
  const [form, setForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    coachId: "",
    locationId: "",
    priorityOnly: false,
    interval: "60", // 30 or 60 minutes
  })

  // Recurring slots form
  const [recurringForm, setRecurringForm] = useState({
    startDate: "",
    endDate: "",
    daysOfWeek: [] as number[],
    startTime: "",
    endTime: "",
    coachId: "",
    locationId: "",
    priorityOnly: false,
    interval: "60", // 30 or 60 minutes
  })

  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)
  
  // Delete slots form
  const [deleteBeforeDate, setDeleteBeforeDate] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletedCount, setDeletedCount] = useState(0)

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleRecurringChange = (key: string, value: string | boolean | number[]) => {
    setRecurringForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleDayOfWeek = (day: number) => {
    setRecurringForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }))
  }

  const handleSubmit = async () => {
    const { date, startTime, endTime, coachId, locationId, priorityOnly, interval } = form

    if (!date || !startTime || !endTime || !coachId || !locationId) {
      setError("Please fill in all required fields")
      return
    }

    // Create dates - browser will interpret as local time (PST/PDT)
    // This is correct because we want to store the time as the user entered it
    // When stored to Firestore, it will be converted to UTC automatically
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    if (end <= start) {
      setError("End time must be after start time")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const intervalMinutes = parseInt(interval)
      const slots: Array<{ start: Date; end: Date }> = []
      
      // Generate slots based on interval
      let currentStart = new Date(start)
      while (currentStart < end) {
        const currentEnd = new Date(currentStart)
        currentEnd.setMinutes(currentEnd.getMinutes() + intervalMinutes)
        
        // Don't create a slot if it would exceed the end time
        if (currentEnd > end) break
        
        slots.push({ start: new Date(currentStart), end: new Date(currentEnd) })
        currentStart = new Date(currentEnd)
      }

      if (slots.length === 0) {
        setError("No valid slots can be created with the given time range and interval")
        return
      }

      // Create all slots
      const promises = slots.map((slot) =>
        addDoc(collection(db, "availableSlots"), {
          startTime: Timestamp.fromDate(slot.start),
          endTime: Timestamp.fromDate(slot.end),
          coachId: parseInt(coachId),
          locationId: parseInt(locationId),
          status: "available",
          priorityOnly,
        })
      )

      await Promise.all(promises)
      setCreatedCount(slots.length)
      setSuccess(`Successfully created ${slots.length} slot${slots.length > 1 ? "s" : ""}!`)
      setForm({ date: "", startTime: "", endTime: "", coachId: "", locationId: "", priorityOnly: false, interval: "60" })
      setTimeout(() => {
        setSuccess("")
        setCreatedCount(0)
      }, 5000)
    } catch (err) {
      setError("Failed to add slot")
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRecurringSubmit = async () => {
    const { startDate, endDate, daysOfWeek, startTime, endTime, coachId, locationId, priorityOnly, interval } = recurringForm

    if (!startDate || !endDate || !startTime || !endTime || !coachId || !locationId) {
      setError("Please fill in all required fields")
      return
    }

    if (daysOfWeek.length === 0) {
      setError("Please select at least one day of the week")
      return
    }

    const [startHour, startMin] = startTime.split(":").map(Number)
    const [endHour, endMin] = endTime.split(":").map(Number)
    const timeStart = new Date()
    timeStart.setHours(startHour, startMin, 0, 0)
    const timeEnd = new Date()
    timeEnd.setHours(endHour, endMin, 0, 0)

    if (timeEnd <= timeStart) {
      setError("End time must be after start time")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const start = new Date(startDate)
      const end = new Date(endDate)
      const slots: Array<{ start: Date; end: Date }> = []
      const intervalMinutes = parseInt(interval)

      // Generate all dates between start and end
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay() // 0 = Sunday, 1 = Monday, etc.
        if (daysOfWeek.includes(dayOfWeek)) {
          // Generate slots for this day based on interval
          const dayStart = new Date(d)
          dayStart.setHours(startHour, startMin, 0, 0)
          const dayEnd = new Date(d)
          dayEnd.setHours(endHour, endMin, 0, 0)

          let currentStart = new Date(dayStart)
          while (currentStart < dayEnd) {
            const currentEnd = new Date(currentStart)
            currentEnd.setMinutes(currentEnd.getMinutes() + intervalMinutes)
            
            // Don't create a slot if it would exceed the end time
            if (currentEnd > dayEnd) break
            
            slots.push({ start: new Date(currentStart), end: new Date(currentEnd) })
            currentStart = new Date(currentEnd)
          }
        }
      }

      if (slots.length === 0) {
        setError("No valid slots can be created with the given parameters")
        return
      }

      // Create all slots
      const promises = slots.map((slot) =>
        addDoc(collection(db, "availableSlots"), {
          startTime: Timestamp.fromDate(slot.start),
          endTime: Timestamp.fromDate(slot.end),
          coachId: parseInt(coachId),
          locationId: parseInt(locationId),
          status: "available",
          priorityOnly,
        })
      )

      await Promise.all(promises)
      setCreatedCount(slots.length)
      setSuccess(`Successfully created ${slots.length} slots!`)
      setRecurringForm({
        startDate: "",
        endDate: "",
        daysOfWeek: [],
        startTime: "",
        endTime: "",
        coachId: "",
        locationId: "",
        priorityOnly: false,
        interval: "60",
      })
      setTimeout(() => {
        setSuccess("")
        setCreatedCount(0)
      }, 5000)
    } catch (err) {
      setError("Failed to add slots")
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  const handleBulkDelete = async () => {
    if (!deleteBeforeDate) {
      setError("Please select a date")
      return
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ALL slots before ${deleteBeforeDate}? This action cannot be undone.`
    )
    if (!confirmDelete) return

    try {
      setDeleteLoading(true)
      setError("")
      setSuccess("")

      const user = auth.currentUser
      if (!user) {
        throw new Error("Not authenticated")
      }

      const idToken = await user.getIdToken()
      const response = await fetch(
        `/api/private-lessons/slots/bulk-delete?beforeDate=${deleteBeforeDate}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to delete slots")
      }

      const data = await response.json()
      setDeletedCount(data.deletedCount || 0)
      setSuccess(`Successfully deleted ${data.deletedCount || 0} slot${data.deletedCount !== 1 ? "s" : ""} before ${deleteBeforeDate}`)
      setDeleteBeforeDate("")
      setIsDeleteDialogOpen(false)
      setTimeout(() => {
        setSuccess("")
        setDeletedCount(0)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete slots")
      console.error(err)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Available Slots</CardTitle>
          <CardDescription>Admin only: Add single or recurring private lesson times</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "recurring" | "delete")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="single">Single Slot</TabsTrigger>
              <TabsTrigger value="recurring">Recurring Slots</TabsTrigger>
              <TabsTrigger value="delete">Delete Slots</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Coach *</Label>
                  <Select value={form.coachId} onValueChange={(val) => handleChange("coachId", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => handleChange("startTime", e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => handleChange("endTime", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Time Interval *</Label>
                  <Select value={form.interval} onValueChange={(val) => handleChange("interval", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Location *</Label>
                  <Select value={form.locationId} onValueChange={(val) => handleChange("locationId", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id.toString()}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={form.priorityOnly}
                  onCheckedChange={(checked) => handleChange("priorityOnly", !!checked)}
                />
                <Label>This slot is for VIP only</Label>
              </div>

              <Button onClick={handleSubmit} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Slot"
                )}
              </Button>
            </TabsContent>

            <TabsContent value="recurring" className="space-y-4 mt-6">
              <div className="col-span-2 mb-2">
                <p className="text-sm text-slate-600">
                  Slots will be automatically created based on the time range and interval for each selected day. 
                  For example, 8:00 AM - 10:00 AM with 1 hour interval creates two slots per day: 8:00-9:00 AM and 9:00-10:00 AM.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={recurringForm.startDate}
                    onChange={(e) => handleRecurringChange("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={recurringForm.endDate}
                    onChange={(e) => handleRecurringChange("endDate", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={recurringForm.startTime}
                    onChange={(e) => handleRecurringChange("startTime", e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={recurringForm.endTime}
                    onChange={(e) => handleRecurringChange("endTime", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Time Interval *</Label>
                  <Select value={recurringForm.interval} onValueChange={(val) => handleRecurringChange("interval", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Coach *</Label>
                  <Select
                    value={recurringForm.coachId}
                    onValueChange={(val) => handleRecurringChange("coachId", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location *</Label>
                  <Select
                    value={recurringForm.locationId}
                    onValueChange={(val) => handleRecurringChange("locationId", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id.toString()}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Days of Week *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {dayNames.map((day, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        checked={recurringForm.daysOfWeek.includes(index)}
                        onCheckedChange={() => toggleDayOfWeek(index)}
                      />
                      <Label className="text-sm font-normal">{day}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={recurringForm.priorityOnly}
                  onCheckedChange={(checked) => handleRecurringChange("priorityOnly", !!checked)}
                />
                <Label>These slots are for VIP only</Label>
              </div>

              <Button onClick={handleRecurringSubmit} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating slots...
                  </>
                ) : (
                  "Create Recurring Slots"
                )}
              </Button>
            </TabsContent>

            <TabsContent value="delete" className="space-y-4 mt-6">
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will permanently delete all slots before the selected date. This action cannot be undone.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="deleteBeforeDate">Delete all slots before this date *</Label>
                  <Input
                    id="deleteBeforeDate"
                    type="date"
                    value={deleteBeforeDate}
                    onChange={(e) => setDeleteBeforeDate(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    All slots with start time before the selected date (00:00:00) will be deleted.
                  </p>
                </div>

                <Button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={!deleteBeforeDate || deleteLoading}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Slots
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete ALL slots before <strong>{deleteBeforeDate}</strong>?
                  <br />
                  <br />
                  This action <strong>cannot be undone</strong>. All slots with start time before this date will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {success && (
            <Alert className="mt-4">
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                {success}
                {createdCount > 0 && ` (${createdCount} slot${createdCount > 1 ? "s" : ""} created)`}
                {deletedCount > 0 && ` (${deletedCount} slot${deletedCount > 1 ? "s" : ""} deleted)`}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
