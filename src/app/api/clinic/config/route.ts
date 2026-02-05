// app/api/clinic/config/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

interface ClinicSlot {
  date: string;
  label: string;
  time?: string;
}

export type ActivityType = "clinic" | "camp" | "pop-up";

interface ClinicConfig {
  id?: string;
  season: string;
  title: string;
  type?: ActivityType; // Default to "clinic" for backward compatibility
  description?: string;
  locations: {
    name: string;
    slots: ClinicSlot[];
  }[];
  levels?: string[];
  active: boolean;
  // Manually mark clinic as full (0 slots available) even if not expired
  isFull?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// GET: 获取所有 clinic 配置或单个配置
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const season = searchParams.get("season");
    const activeOnly = searchParams.get("activeOnly") === "true";

    // If ID is provided, return single config (public, no auth required)
    if (id) {
      const doc = await adminDb.collection("clinicConfigs").doc(id).get();
      if (!doc.exists) {
        return NextResponse.json({ error: "Config not found" }, { status: 404 });
      }
      return NextResponse.json({ config: { id: doc.id, ...doc.data() } });
    }

    // Otherwise, return list of configs (requires auth for admin)
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    let queryRef: FirebaseFirestore.Query = adminDb.collection("clinicConfigs");
    
    if (season) {
      queryRef = queryRef.where("season", "==", season);
    }
    if (activeOnly) {
      queryRef = queryRef.where("active", "==", true);
    }

    const snap = await queryRef.orderBy("createdAt", "desc").get();
    const configs = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ configs });
  } catch (e) {
    console.error("Get clinic configs error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: 创建新的 clinic 配置
export async function POST(req: Request) {
  try {
    // Auth check
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json() as ClinicConfig;
    
    // Validate
    if (!body.season || !body.title || !body.locations || body.locations.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const config: ClinicConfig = {
      season: body.season.trim(),
      title: body.title.trim(),
      type: body.type || "clinic",
      description: body.description?.trim() || "",
      locations: body.locations,
      levels: body.levels || [],
      active: body.active !== undefined ? body.active : true,
      isFull: body.isFull === true, // default to false if not provided
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await adminDb.collection("clinicConfigs").add(config);
    
    return NextResponse.json({ id: docRef.id, ...config });
  } catch (e) {
    console.error("Create clinic config error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: 更新 clinic 配置
export async function PUT(req: Request) {
  try {
    // Auth check
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json() as ClinicConfig & { id: string };
    
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const updateData: Partial<ClinicConfig> = {
      season: body.season?.trim(),
      title: body.title?.trim(),
      type: body.type,
      description: body.description?.trim(),
      locations: body.locations,
      levels: body.levels,
      active: body.active,
      isFull: body.isFull,
      updatedAt: Timestamp.now(),
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await adminDb.collection("clinicConfigs").doc(body.id).update(updateData);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update clinic config error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: 删除 clinic 配置
export async function DELETE(req: Request) {
  try {
    // Auth check
    const authz = req.headers.get("authorization") || "";
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const decoded = await getAuth().verifyIdToken(m[1]);
    const email = (decoded.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    
    const adminDoc = await adminDb.collection("admin").doc(email).get();
    if (!adminDoc.exists) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await adminDb.collection("clinicConfigs").doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete clinic config error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

