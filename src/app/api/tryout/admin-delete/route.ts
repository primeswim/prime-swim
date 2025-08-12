// app/api/tryout/admin-delete/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

interface DeleteBody {
  id: string;
  capKey?: string | null;
  program?: string;
  preferredDate?: string;
}

// 方便连通性自检：浏览器打开 /api/tryout/admin-delete 应该返回 200
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/tryout/admin-delete" });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeleteBody;
    const { id, capKey, program, preferredDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Missing tryout document id." },
        { status: 400 }
      );
    }

    const prog = String(program ?? "").trim().toLowerCase();
    const date = String(preferredDate ?? "").trim();

    // 计算 lock 文档 ID（优先用后端写入的 capKey，兼容没有 capKey 的旧数据）
    let lockId: string | null = null;
    if (capKey) lockId = capKey;
    else if ((prog === "bronze" || prog === "silver") && date) lockId = `${prog}_${date}`;

    const batch = adminDb.batch();
    batch.delete(adminDb.collection("tryouts").doc(id));
    if (lockId) batch.delete(adminDb.collection("tryout_locks").doc(lockId));

    await batch.commit();

    return NextResponse.json({ ok: true, deletedLockId: lockId ?? null });
  } catch (e) {
    console.error("admin-delete error:", e);
    return NextResponse.json(
      { error: "DELETE_FAILED", message: "Failed to delete tryout and lock." },
      { status: 500 }
    );
  }
}
