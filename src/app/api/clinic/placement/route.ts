// app/api/clinic/placement/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { SwimmerLevel } from "@/lib/swimmer-levels";

interface PlacementSwimmer {
  submissionId: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  parentEmail: string;
  parentPhone: string;
  submittedAt: Timestamp;
  placedAt?: Timestamp;
}

interface WaitlistSwimmer {
  submissionId: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  parentEmail: string;
  parentPhone: string;
  submittedAt: Timestamp;
  waitlistOrder: number;
}

interface Placement {
  id?: string;
  activityId: string; // Reference to clinicConfigs
  season: string;
  location: string;
  slotLabel: string;
  lanes: {
    laneNumber: number;
    capacity: number; // Default 3, can be changed
    swimmers: PlacementSwimmer[];
  }[];
  waitlist: WaitlistSwimmer[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// GET: 获取所有 placements
export async function GET(req: Request) {
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
    const season = searchParams.get("season");
    const activityId = searchParams.get("activityId");

    let queryRef: FirebaseFirestore.Query = adminDb.collection("activityPlacements");
    
    if (season) {
      queryRef = queryRef.where("season", "==", season);
    }
    if (activityId) {
      queryRef = queryRef.where("activityId", "==", activityId);
    }

    const snap = await queryRef.get();
    const placements = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ placements });
  } catch (e) {
    console.error("Get placements error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: 创建或更新 placement
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

    const body = await req.json() as Placement & { id?: string };
    
    if (!body.activityId || !body.season || !body.location || !body.slotLabel) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const placementData: Placement = {
      activityId: body.activityId,
      season: body.season,
      location: body.location,
      slotLabel: body.slotLabel,
      lanes: body.lanes || [],
      waitlist: body.waitlist || [],
      updatedAt: Timestamp.now(),
    };

    if (body.id) {
      // Update existing
      await adminDb.collection("activityPlacements").doc(body.id).update(placementData as unknown as Record<string, unknown>);
      return NextResponse.json({ id: body.id, ...placementData });
    } else {
      // Create new
      placementData.createdAt = Timestamp.now();
      const docRef = await adminDb.collection("activityPlacements").add(placementData as unknown as Record<string, unknown>);
      return NextResponse.json({ id: docRef.id, ...placementData });
    }
  } catch (e) {
    console.error("Create/update placement error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: 删除 placement
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

    await adminDb.collection("activityPlacements").doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete placement error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

