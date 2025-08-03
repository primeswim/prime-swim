'use client'

import { useState, useEffect } from 'react'
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useRouter } from 'next/navigation'
import Header from '@/components/header'

interface Swimmer {
  id: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  isPregnant?: string
  pregnancyWeeks?: string
  phone?: string
  email?: string
  medicalConditions?: string
  swimmingLevel?: string
  participantSignature?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
}

export default function PrivateLessonSwimmerAdmin() {
  const router = useRouter()
  const [swimmers, setSwimmers] = useState<Swimmer[]>([])
  const [search, setSearch] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

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
        fetchSwimmers()
      } else {
        router.push('/not-authorized')
      }
      setChecked(true)
    })

    return () => unsubscribe()
  }, [router])

  const fetchSwimmers = async () => {
    const q = collection(db, 'privatelessonstudents')
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Swimmer)
    )
    setSwimmers(data)
  }

  const deleteSwimmer = async (id: string) => {
    if (confirm('Are you sure you want to delete this swimmer?')) {
      const ref = doc(db, 'privatelessonstudents', id)
      await deleteDoc(ref)
      fetchSwimmers()
    }
  }

  const filteredSwimmers = swimmers.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  if (!checked) return <p className="text-center mt-10">Checking access...</p>
  if (!isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Header />
      <h1 className="text-2xl font-bold mb-6">Private Lesson Swimmer Management</h1>

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search swimmers by name"
          className="w-80"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date of Birth</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Medical</TableHead>
            <TableHead>Pregnancy</TableHead>
            <TableHead>Swim Level</TableHead>
            <TableHead>Emergency Contact</TableHead>
            <TableHead>Signature</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSwimmers.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.firstName} {s.lastName}</TableCell>
              <TableCell>{s.dateOfBirth || '-'}</TableCell>
              <TableCell>{s.email || '-'}</TableCell>
              <TableCell>{s.phone || '-'}</TableCell>
              <TableCell>{s.medicalConditions || 'None'}</TableCell>
              <TableCell>
                {s.isPregnant === 'yes'
                  ? `Yes (${s.pregnancyWeeks ?? 'N/A'} weeks)`
                  : s.isPregnant || '-'}
              </TableCell>
              <TableCell>{s.swimmingLevel || '-'}</TableCell>
              <TableCell>
                {s.emergencyContactName
                  ? `${s.emergencyContactName} (${s.emergencyContactRelation}) - ${s.emergencyContactPhone}`
                  : '-'}
              </TableCell>
              <TableCell>{s.participantSignature || '-'}</TableCell>
              <TableCell>
                <Button
                  onClick={() => deleteSwimmer(s.id)}
                  className="bg-red-600 text-white"
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
