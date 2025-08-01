'use client'

import { useState, useEffect } from 'react'
import {
  collection,
  getDocs,
  updateDoc,
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
  childFirstName: string
  childLastName: string
  childDateOfBirth?: string
  childGender?: string
  parentFirstName?: string
  parentLastName?: string
  parentEmail?: string
  parentPhone?: string
  paymentName?: string
  paymentMemo?: string
  paymentStatus?: string
}

export default function AdminSwimmerPage() {
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
    const q = collection(db, 'swimmers')
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Swimmer)
    )
    setSwimmers(data)
  }

  const markPaid = async (id: string) => {
    const ref = doc(db, 'swimmers', id)
    await updateDoc(ref, { paymentStatus: 'paid' })
    await fetchSwimmers()
  
    const swimmer = swimmers.find((s) => s.id === id)
    console.log(swimmer?.parentEmail)
    if (swimmer?.parentEmail && swimmer?.childFirstName) {
      await fetch('/api/registration-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail: swimmer.parentEmail,
          parentName: `${swimmer.parentFirstName ?? ''} ${swimmer.parentLastName ?? ''}`.trim(),
          swimmerName: `${swimmer.childFirstName} ${swimmer.childLastName}`
        })
      })
    }
  }

  const markPending = async (id: string) => {
    const ref = doc(db, 'swimmers', id)
    await updateDoc(ref, { paymentStatus: 'pending' })
    fetchSwimmers()
  }

  const markAllPending = async () => {
    if (!confirm('Are you sure you want to mark all swimmers as pending?')) return

    const snapshot = await getDocs(collection(db, 'swimmers'))
    const updates = snapshot.docs.map((docSnap) => {
      const swimmerRef = doc(db, 'swimmers', docSnap.id)
      return updateDoc(swimmerRef, { paymentStatus: 'pending' })
    })

    await Promise.all(updates)
    fetchSwimmers()
  }

  const deleteSwimmer = async (id: string) => {
    if (confirm('Are you sure you want to delete this swimmer?')) {
      const ref = doc(db, 'swimmers', id)
      await deleteDoc(ref)
      fetchSwimmers()
    }
  }

  const filteredSwimmers = swimmers.filter((s) =>
    `${s.childFirstName} ${s.childLastName}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  if (!checked) return <p className="text-center mt-10">Checking access...</p>
  if (!isAdmin) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Header />
      <h1 className="text-2xl font-bold mb-6">Swimmer Management</h1>

      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search swimmers by name"
          className="w-80"
        />
        <Button
          variant="outline"
          onClick={markAllPending}
          className="border border-yellow-500 text-yellow-600 hover:bg-yellow-100"
        >
          Mark All as Pending
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Birth Date</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Payment Name</TableHead>
            <TableHead>Payment Memo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSwimmers.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                {s.childFirstName} {s.childLastName}
              </TableCell>
              <TableCell>{s.childDateOfBirth ?? '-'}</TableCell>
              <TableCell>{s.childGender ?? '-'}</TableCell>
              <TableCell>
                {s.parentFirstName || s.parentLastName
                  ? `${s.parentFirstName ?? ''} ${s.parentLastName ?? ''}`.trim()
                  : '-'}
              </TableCell>
              <TableCell>{s.parentEmail ?? '-'}</TableCell>
              <TableCell>{s.parentPhone ?? '-'}</TableCell>
              <TableCell>{s.paymentName ?? '-'}</TableCell>
              <TableCell>{s.paymentMemo ?? '-'}</TableCell>
              <TableCell>{s.paymentStatus ?? '-'}</TableCell>
              <TableCell className="space-y-1 space-x-1">
                <Button
                  onClick={() => markPaid(s.id)}
                  className="bg-green-600 text-white"
                  disabled={s.paymentStatus === 'paid'}
                >
                  {s.paymentStatus === 'paid' ? 'Paid' : 'Mark as Paid'}
                </Button>
                <Button
                  onClick={() => markPending(s.id)}
                  className="bg-yellow-500 text-white"
                  disabled={s.paymentStatus === 'pending'}
                >
                  {s.paymentStatus === 'pending' ? 'Pending' : 'Mark as Pending'}
                </Button>
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
