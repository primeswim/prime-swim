// src/hooks/useIsAdminFromDB.ts
"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"

const ADMIN_CHECK_MS = 10_000

/** 返回:
 *  - null: 加载中
 *  - true: 是管理员
 *  - false: 非管理员
 */
export function useIsAdminFromDB(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const failSafe = window.setTimeout(() => {
      if (!cancelled) setIsAdmin((prev) => (prev === null ? false : prev))
    }, ADMIN_CHECK_MS)

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!cancelled) setIsAdmin(false)
        return
      }
      void (async () => {
        const controller = new AbortController()
        const abortTimer = window.setTimeout(() => controller.abort(), 8_000)
        try {
          const idToken = await user.getIdToken()
          if (cancelled) return
          const res = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${idToken}` },
            signal: controller.signal,
          })
          const data = await res.json().catch(() => ({}))
          if (cancelled) return
          if (!res.ok || !data?.ok) {
            setIsAdmin(false)
            return
          }
          setIsAdmin(Boolean(data.isAdmin))
        } catch (err) {
          console.error("useIsAdminFromDB error:", err)
          if (!cancelled) setIsAdmin(false)
        } finally {
          window.clearTimeout(abortTimer)
        }
      })()
    })

    return () => {
      cancelled = true
      window.clearTimeout(failSafe)
      unsub()
    }
  }, [])

  return isAdmin
}
