// src/hooks/useIsAdminFromDB.ts
"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

/** 返回:
 *  - null: 加载中
 *  - true: 是管理员
 *  - false: 非管理员
 */
export function useIsAdminFromDB(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) setIsAdmin(false)
        return
      }
      try {
        const idToken = await user.getIdToken(true)
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.ok) {
          if (mounted) setIsAdmin(false)
          return
        }
        if (mounted) setIsAdmin(Boolean(data.isAdmin))
      } catch (err) {
        console.error("useIsAdminFromDB error:", err)
        if (mounted) setIsAdmin(false)
      }
    })

    return () => {
      mounted = false
      unsub()
    }
  }, [])

  return isAdmin
}