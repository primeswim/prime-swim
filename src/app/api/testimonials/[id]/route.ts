// app/api/testimonials/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

// PUT: 更新评论（仅管理员）
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (body.content !== undefined) {
      if (body.content.trim() === "") {
        return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
      }
      updateData.content = body.content.trim();
    }

    if (body.parentName !== undefined) {
      updateData.parentName = body.parentName.trim();
    }

    if (body.swimmerName !== undefined) {
      updateData.swimmerName = body.swimmerName.trim();
    }

    if (body.order !== undefined) {
      updateData.order = body.order;
    }

    if (body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
    }

    await adminDb.collection("parentTestimonials").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update testimonial error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: 删除评论（仅管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await adminDb.collection("parentTestimonials").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete testimonial error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

