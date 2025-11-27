// app/api/clinic/config/active/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// GET: 获取当前激活的 clinic 配置（公开，不需要认证）
export async function GET() {
  try {
    // Query all active configs (without orderBy to avoid index requirement)
    const snap = await adminDb
      .collection("clinicConfigs")
      .where("active", "==", true)
      .get();

    if (snap.empty) {
      console.log("No active clinic configs found");
      return NextResponse.json({ config: null });
    }

    // Sort in memory by createdAt (most recent first)
    const docs = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt,
      } as { id: string; createdAt?: { toMillis?: () => number; _seconds?: number }; [key: string]: unknown };
    });

    // Sort by createdAt descending (most recent first)
    docs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || (a.createdAt?._seconds ? a.createdAt._seconds * 1000 : 0) || 0;
      const bTime = b.createdAt?.toMillis?.() || (b.createdAt?._seconds ? b.createdAt._seconds * 1000 : 0) || 0;
      return bTime - aTime;
    });

    const config = docs[0];
    console.log("Found active clinic config:", config.id);
    return NextResponse.json({ config });
  } catch (e) {
    console.error("Get active clinic config error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

