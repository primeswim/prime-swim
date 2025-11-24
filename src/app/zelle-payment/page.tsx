// app/zelle-payment/page.tsx
"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import ZellePaymentStep from "@/components/ZellePaymentStep"

type PaymentDoc = {
  swimmerId: string
  parentUID: string
  status: "pending" | "paid" | "cancelled"
  method: "zelle"
  amountCents: number
  zelleSubmitted?: boolean        // ✅ 新增：家长是否已经点了 "I've completed"
}

function ZellePaymentPageContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const paymentId = sp.get("paymentId") || null     // Renew 优先走 paymentId
  const swimmerIdFromUrl = sp.get("swimmerId") || sp.get("id") || null     // 支持 swimmerId 和 id 参数

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null)
  const [swimmerId, setSwimmerId] = useState<string>("")
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return }
      try {
        if (paymentId) {
          // 根据 payment 找 swimmer，并校验归属
          const psnap = await getDoc(doc(db, "payments", paymentId))
          if (!psnap.exists()) throw new Error("Payment not found")
          const pdata = psnap.data() as PaymentDoc

          if (pdata.parentUID && pdata.parentUID !== u.uid) {
            throw new Error("You do not have access to this payment.")
          }

          const ssnap = await getDoc(doc(db, "swimmers", pdata.swimmerId))
          if (!ssnap.exists()) throw new Error("Swimmer not found")
          const sdata = ssnap.data() || {}
          if (sdata.parentUID && sdata.parentUID !== u.uid) {
            throw new Error("You do not have access to this swimmer.")
          }

          setUser(u)
          setSwimmerId(pdata.swimmerId)
          setResolvedPaymentId(paymentId)
        } else if (swimmerIdFromUrl) {
          // 兜底：仅凭 swimmerId 进入（注册场景）
          const ssnap = await getDoc(doc(db, "swimmers", swimmerIdFromUrl))
          if (!ssnap.exists()) throw new Error("Swimmer not found")
          const sdata = ssnap.data() || {}
          if (sdata.parentUID && sdata.parentUID !== u.uid) {
            throw new Error("You do not have access to this swimmer.")
          }
          setUser(u)
          setSwimmerId(swimmerIdFromUrl)
          setResolvedPaymentId(undefined)
        } else {
          throw new Error("Missing paymentId or swimmer id")
        }
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
