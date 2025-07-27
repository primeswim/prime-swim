// File: app/admin/slots/page.tsx
"use client"
import { getAuth } from "firebase/auth"
import { useState } from "react"
import { Timestamp, collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
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
  const [form, setForm] = useState({
    date: "",
    startTime: "",
    endTime: "",
    coachId: "",
    locationId: "",
    priorityOnly: false,
  })
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    const { date, startTime, endTime, coachId, locationId, priorityOnly } = form

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    try {
        const auth = getAuth()
console.log(auth.currentUser?.email, auth.currentUser?.uid)
      setLoading(true)
      await addDoc(collection(db, "availableSlots"), {
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        coachId: parseInt(coachId),
        locationId: parseInt(locationId),
        status: "available",
        priorityOnly,
      })
      setSuccess("Slot added successfully!")
      setForm({ date: "", startTime: "", endTime: "", coachId: "", locationId: "", priorityOnly: false })
    } catch (err) {
      setError("Failed to add slot")
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Add Available Slot</CardTitle>
          <CardDescription>Admin only: Add a new private lesson time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
              />
            </div>
            <div>
              <Label>Coach</Label>
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
              <Label>Start Time</Label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => handleChange("startTime", e.target.value)}
              />
            </div>
            <div>
              <Label>End Time</Label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => handleChange("endTime", e.target.value)}
              />
            </div>
            <div>
              <Label>Location</Label>
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

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Add Slot"}
          </Button>

          {success && <p className="text-green-600 text-sm pt-2">{success}</p>}
          {error && <p className="text-red-600 text-sm pt-2">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
