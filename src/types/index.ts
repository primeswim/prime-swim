export interface Swimmer {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: string
    createdAt: any // 可以换成 Firestore.Timestamp 类型
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
    createdAt?: any  // Firestore.Timestamp，如果你用了时间戳
}
  
  