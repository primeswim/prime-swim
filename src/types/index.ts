import { Timestamp } from "firebase/firestore"

import { SwimmerLevel } from "@/lib/swimmer-levels"

export interface Swimmer {
  id: string
  childFirstName: string
  childLastName: string
  childDateOfBirth: string
  paymentStatus?: string
  level?: SwimmerLevel
  createdAt: Timestamp
}

export interface Parent {
  uid: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  createdAt?: Timestamp
}

export interface SwimmerFormData extends Partial<Swimmer> {
    paymentStatus?: string
    paymentName?: string
    paymentMemo?: string
}

export interface FirebaseUser {
    uid: string
    email: string | null
    displayName?: string | null
}