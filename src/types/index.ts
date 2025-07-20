import { Timestamp } from "firebase/firestore"

export interface Swimmer {
  id: string
  childFirstName: string
  childLastName: string
  childDateOfBirth: string
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