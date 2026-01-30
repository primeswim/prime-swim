// app/api/news/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

interface NewsItem {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  image?: string;
  category?: string;
  author?: string;
  publishDate?: string;
  createdAt?: unknown;
  isPublished?: boolean;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the specific news item
    const docRef = adminDb.collection("news").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "News not found" }, { status: 404 });
    }

    const data = docSnap.data();
    const news: NewsItem = {
      id: docSnap.id,
      title: data?.title || "",
      content: data?.content || "",
      summary: data?.summary || "",
      image: data?.image || "",
      category: data?.category || "",
      author: data?.author || "",
      publishDate: data?.publishDate || "",
      isPublished: data?.isPublished || false,
      createdAt: data?.createdAt,
    };

    // Get related news (excluding current one)
    const allNewsSnap = await adminDb
      .collection("news")
      .where("isPublished", "==", true)
      .get();

    const relatedNews: NewsItem[] = allNewsSnap.docs
      .filter((d) => d.id !== id)
      .slice(0, 3)
      .map((d) => {
        const dData = d.data();
        return {
          id: d.id,
          title: dData?.title || "",
          content: dData?.content || "",
          summary: dData?.summary || "",
          image: dData?.image || "",
          category: dData?.category || "",
          author: dData?.author || "",
          publishDate: dData?.publishDate || "",
          isPublished: dData?.isPublished || false,
        };
      });

    return NextResponse.json({ news, relatedNews });
  } catch (err: unknown) {
    console.error("Get news error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: 删除 news（需要 admin 权限）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check admin permission
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const { getAuth } = await import("firebase-admin/auth");
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const emailLower = (decoded.email ?? "").toLowerCase();
    const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    let isAdmin = allow.includes(emailLower);
    if (!isAdmin) {
      const colNames = ["admin", "admins"];
      for (const col of colNames) {
        if (emailLower) {
          const byEmail = await adminDb.collection(col).doc(emailLower).get();
          if (byEmail.exists) {
            isAdmin = true;
            break;
          }
        }
        if (decoded.uid) {
          const byUid = await adminDb.collection(col).doc(decoded.uid).get();
          if (byUid.exists) {
            isAdmin = true;
            break;
          }
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // Delete the news
    await adminDb.collection("news").doc(id).delete();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Delete news error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PUT: 更新 news（需要 admin 权限）
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Check admin permission
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const { getAuth } = await import("firebase-admin/auth");
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const emailLower = (decoded.email ?? "").toLowerCase();
    const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    let isAdmin = allow.includes(emailLower);
    if (!isAdmin) {
      const colNames = ["admin", "admins"];
      for (const col of colNames) {
        if (emailLower) {
          const byEmail = await adminDb.collection(col).doc(emailLower).get();
          if (byEmail.exists) {
            isAdmin = true;
            break;
          }
        }
        if (decoded.uid) {
          const byUid = await adminDb.collection(col).doc(decoded.uid).get();
          if (byUid.exists) {
            isAdmin = true;
            break;
          }
        }
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // Validate required fields
    if (!body.title || !body.summary || !body.content || !body.publishDate) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    // Update the news
    const updateData: Partial<NewsItem> = {
      title: body.title.trim(),
      content: body.content.trim(),
      summary: body.summary.trim(),
      author: body.author?.trim() || null,
      image: body.image || null,
      publishDate: body.publishDate,
      isPublished: body.isPublished || false,
    };

    await adminDb.collection("news").doc(id).update(updateData);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Update news error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

