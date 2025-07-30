'use client'

import { useState } from 'react'
import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function BulkInsertPage() {
    const defaultJSON = `[
        {
          "coachId": 2,
          "locationId": 1,
          "priorityOnly": false,
          "startTime": "2025-11-01T08:00:00-07:00",
          "endTime": "2025-11-01T08:30:00-07:00",
          "status": "available"
        },
        {
          "coachId": 2,
          "locationId": 1,
          "priorityOnly": false,
          "startTime": "2025-11-01T08:30:00-07:00",
          "endTime": "2025-11-01T09:00:00-07:00",
          "status": "available"
        }
      ]`
      
  const [input, setInput] = useState(defaultJSON)    

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  type SlotEvent = {
    coachId: number;
    locationId: number;
    priorityOnly: boolean;
    startTime: string;
    endTime: string;
    status: string;
  };

  const handleInsert = async () => {
    setStatus('idle')
    setMessage('')

    let parsed
    try {
      parsed = JSON.parse(input)
      if (!Array.isArray(parsed)) throw new Error('Input must be an array')
    } catch {
      setStatus('error')
      setMessage('Invalid JSON format')
      return
    }

    try {
      const batch = writeBatch(db)
      const ref = collection(db, 'availableSlots')

      parsed.forEach((slot: SlotEvent) => {
        const docRef = doc(ref)
        batch.set(docRef, {
          ...slot,
          startTime: Timestamp.fromDate(new Date(slot.startTime)),
          endTime: Timestamp.fromDate(new Date(slot.endTime)),
        })
      })

      await batch.commit()
      setStatus('success')
      setMessage(`Successfully inserted ${parsed.length} slots`)
    } catch (err) {
      console.error(err)
      setStatus('error')
      setMessage('Insertion failed. Check console for details.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Bulk Insert Private Lesson Slots</h1>

      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={15}
        className="mb-4"
      />

      <Button onClick={handleInsert} className="bg-blue-600 text-white">
        Insert Slots
      </Button>

      {status === 'success' && (
        <div className="mt-4 flex items-center text-green-600">
          <CheckCircle className="w-5 h-5 mr-2" />
          {message}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 flex items-center text-red-600">
          <AlertCircle className="w-5 h-5 mr-2" />
          {message}
        </div>
      )}
    </div>
  )
}
