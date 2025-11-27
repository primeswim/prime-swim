// app/api/clinic/config/active/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// GET: 获取当前激活的 clinic 配置（公开，不需要认证）
export async function GET() {
  try {
    const snap = await adminDb
      .collection("clinicConfigs")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ config: null });
    }

    const doc = snap.docs[0];
    const config = {
      id: doc.id,
      ...doc.data(),
    };

    return NextResponse.json({ config });
  } catch (e) {
    console.error("Get active clinic config error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

