export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authErrorResponse, requireTuitionV2Admin } from "@/lib/tuition-v2/admin-auth";
import { normalizeSiblingIds } from "@/lib/swimmer-siblings";
import { refreshOpenMonthsForSwimmers } from "@/lib/tuition-v2/refresh-month";

function readSiblingIds(data: Record<string, unknown> | undefined, selfId: string): string[] {
  return normalizeSiblingIds(data?.siblingIds, selfId);
}

export async function POST(req: Request) {
  try {
    const email = await requireTuitionV2Admin(req);
    const body = (await req.json()) as {
      swimmerId?: unknown;
      siblingId?: unknown;
      linked?: unknown;
    };
    const swimmerId = typeof body.swimmerId === "string" ? body.swimmerId.trim() : "";
    const siblingId = typeof body.siblingId === "string" ? body.siblingId.trim() : "";
    if (!swimmerId || !siblingId || swimmerId === siblingId || swimmerId.includes("/") || siblingId.includes("/")) {
      return NextResponse.json({ error: "Invalid swimmer pair" }, { status: 400 });
    }

    const linked = body.linked === true;
    const swimmerRef = adminDb.collection("swimmers").doc(swimmerId);
    const siblingRef = adminDb.collection("swimmers").doc(siblingId);
    const [swimmerSnap, siblingSnap] = await Promise.all([swimmerRef.get(), siblingRef.get()]);
    if (!swimmerSnap.exists || !siblingSnap.exists) {
      return NextResponse.json({ error: "Swimmer not found" }, { status: 404 });
    }

    const swimmerSiblings = readSiblingIds(swimmerSnap.data(), swimmerId);
    const siblingSiblings = readSiblingIds(siblingSnap.data(), siblingId);
    const nextSwimmer = linked
      ? normalizeSiblingIds([...swimmerSiblings, siblingId], swimmerId)
      : swimmerSiblings.filter((id) => id !== siblingId);
    const nextSibling = linked
      ? normalizeSiblingIds([...siblingSiblings, swimmerId], siblingId)
      : siblingSiblings.filter((id) => id !== swimmerId);

    await Promise.all([
      swimmerRef.set({ siblingIds: nextSwimmer, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      siblingRef.set({ siblingIds: nextSibling, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);

    const familyIds = [...new Set([swimmerId, siblingId, ...nextSwimmer, ...nextSibling])];
    const refresh = await refreshOpenMonthsForSwimmers(adminDb, email, familyIds);
    return NextResponse.json({
      ok: true,
      swimmerId,
      siblingId,
      linked,
      siblingIds: { [swimmerId]: nextSwimmer, [siblingId]: nextSibling },
      refreshedMonths: refresh.months,
      refreshedLevels: refresh.levels,
    });
  } catch (e) {
    const auth = authErrorResponse(e);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    console.error("tuition-v2 siblings:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
