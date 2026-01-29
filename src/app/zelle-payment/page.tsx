// app/zelle-payment/page.tsx
"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import type { User as FirebaseAuthUser } from "firebase/auth"
import { auth } from "@/lib/firebase"
import ZellePaymentStep from "@/components/ZellePaymentStep"

function ZellePaymentPageContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const paymentId = sp.get("paymentId") || null     // Renew 优先走 paymentId
  const swimmerIdFromUrl = sp.get("swimmerId") || sp.get("id") || null     // 支持 swimmerId 和 id 参数

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<FirebaseAuthUser | null>(null)
  const [swimmerId, setSwimmerId] = useState<string>("")
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return }
      try {
        const idToken = await u.getIdToken(true)
        const qs = new URLSearchParams()
        if (paymentId) qs.set("paymentId", paymentId)
        if (swimmerIdFromUrl) qs.set("swimmerId", swimmerIdFromUrl)

        const res = await fetch(`/api/zelle-payment/resolve?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Load failed")

        setUser(u)
        setSwimmerId(String(data.swimmerId || ""))
        setResolvedPaymentId(data.paymentId ? String(data.paymentId) : undefined)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Load failed")
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [paymentId, swimmerIdFromUrl, router])

  if (loading) return <div className="p-6 text-slate-700">Loading…</div>
  if (error) return <div className="p-6 text-rose-600">{error}</div>

  return (
    <ZellePaymentStep
      swimmerId={swimmerId}
      user={user}
      paymentId={resolvedPaymentId}
    />
  )
}

export default function ZellePaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-700">Loading…</div>}>
      <ZellePaymentPageContent />
    </Suspense>
  )
}
