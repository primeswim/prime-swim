// app/api/testimonials/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

interface Testimonial {
  id?: string;
  content: string;
  parentName?: string;
  swimmerName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  order?: number; // For custom ordering
  isPublished?: boolean;
}

// GET: 获取所有已发布的评论（公开）或所有评论（管理员）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const adminOnly = searchParams.get("admin") === "true";

    // Check if admin request
    if (adminOnly) {
      const authz = req.headers.get("authorization") || "";
      const m = /^Bearer\s+(.+)$/.exec(authz);
      if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

      const decoded = await getAuth().verifyIdToken(m[1]);
      const email = (decoded.email || "").toLowerCase();
      if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

      const adminDoc = await adminDb.collection("admin").doc(email).get();
      if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

      // Return all testimonials for admin
      // Note: We'll sort in memory to avoid composite index requirement
      const snap = await adminDb.collection("parentTestimonials").get();

      const testimonials = snap.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            order: (data.order as number | undefined) ?? 999999,
            createdAt: data.createdAt?.toMillis?.() || null,
            updatedAt: data.updatedAt?.toMillis?.() || null,
          };
        })
        .sort((a, b) => {
          // Sort by order first, then by createdAt
          const orderA = a.order ?? 999999;
          const orderB = b.order ?? 999999;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA; // Descending
        });

      return NextResponse.json({ testimonials });
    }

    // Public: return only published testimonials
    // Note: We'll sort in memory to avoid composite index requirement
    const snap = await adminDb
      .collection("parentTestimonials")
      .where("isPublished", "==", true)
      .get();

    const testimonials = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content as string,
          parentName: (data.parentName as string | undefined) || "",
          swimmerName: (data.swimmerName as string | undefined) || "",
          createdAt: data.createdAt?.toMillis?.() || null,
          order: (data.order as number | undefined) ?? 999999,
        };
      })
      .sort((a, b) => {
        // Sort by order first, then by createdAt
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA; // Descending
      });

    return NextResponse.json({ testimonials });
  } catch (e) {
    console.error("Get testimonials error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: 创建新评论（仅管理员）
export async function POST(req: Request) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json() as Testimonial;

    if (!body.content || body.content.trim() === "") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // Get max order to set new order
    const existingSnap = await adminDb
      .collection("parentTestimonials")
      .orderBy("order", "desc")
      .limit(1)
      .get();

    const maxOrder = existingSnap.empty ? 0 : (existingSnap.docs[0].data().order || 0);

    const testimonial: Testimonial = {
      content: body.content.trim(),
      parentName: body.parentName?.trim() || "",
      swimmerName: body.swimmerName?.trim() || "",
      order: body.order !== undefined ? body.order : maxOrder + 1,
      isPublished: body.isPublished !== undefined ? body.isPublished : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection("parentTestimonials").add(testimonial);

    return NextResponse.json({ id: docRef.id, ...testimonial });
  } catch (e) {
    console.error("Create testimonial error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

