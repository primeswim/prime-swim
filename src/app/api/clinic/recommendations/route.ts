// app/api/clinic/recommendations/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { SwimmerLevel } from "@/lib/swimmer-levels";

interface Submission {
  id: string;
  parentEmail: string;
  parentPhone?: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  preferences: { location: string; selections: string[] }[];
  season?: string;
  submittedAt?: { toMillis?: () => number; _seconds?: number };
  swimmerId?: string;
}

interface Placement {
  location: string;
  slotLabel: string;
  lanes: {
    laneNumber: number;
    capacity: number;
    swimmers: Array<{
      submissionId: string;
      level: SwimmerLevel | string;
    }>;
  }[];
  waitlist: Array<{
    submissionId: string;
    waitlistOrder: number;
  }>;
}

interface Recommendation {
  submissionId: string;
  swimmerName: string;
  level: SwimmerLevel | string;
  parentEmail: string;
  parentPhone: string;
  recommendedSlots: Array<{
    location: string;
    slotLabel: string;
    reason: string;
    priority: number; // Lower is better
  }>;
  submittedAt: number; // Timestamp in milliseconds
}

// GET: 获取推荐 placements
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

    if (!season || !activityId) {
      return NextResponse.json({ error: "Missing season or activityId" }, { status: 400 });
    }

    // Get submissions
    const submissionsSnap = await adminDb
      .collection("clinicSubmissions")
      .where("season", "==", season)
      .get();
    
    const submissions = submissionsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Submission[];

    // Get placements
    const placementsSnap = await adminDb
      .collection("activityPlacements")
      .where("season", "==", season)
      .where("activityId", "==", activityId)
      .get();
    
    const placementsMap = new Map<string, Placement>();
    placementsSnap.forEach((doc) => {
      const data = doc.data() as Placement;
      const key = `${data.location}__${data.slotLabel}`;
      placementsMap.set(key, data);
    });

    // Verify activity config exists
    const configDoc = await adminDb.collection("clinicConfigs").doc(activityId).get();
    if (!configDoc.exists) {
      return NextResponse.json({ error: "Activity config not found" }, { status: 404 });
    }

    // Generate recommendations
    const recommendations: Recommendation[] = submissions.map((sub) => {
      const submittedAt = sub.submittedAt?.toMillis?.() || 
        (sub.submittedAt?._seconds ? sub.submittedAt._seconds * 1000 : Date.now());
      
      const recommendedSlots: Recommendation["recommendedSlots"] = [];
      
      // Process each preference
      for (const pref of sub.preferences || []) {
        for (const slotLabel of pref.selections || []) {
          const key = `${pref.location}__${slotLabel}`;
          const placement = placementsMap.get(key);
          
          // Calculate available capacity
          let totalCapacity = 0;
          let usedCapacity = 0;
          
          if (placement) {
            placement.lanes.forEach((lane) => {
              totalCapacity += lane.capacity;
              usedCapacity += lane.swimmers.length;
            });
          } else {
            // No placement yet - assume default 1 lane with capacity 3
            totalCapacity = 3;
            usedCapacity = 0;
          }
          
          const available = totalCapacity - usedCapacity;
          const waitlistCount = placement?.waitlist.length || 0;
          
          // Calculate priority (lower is better)
          // Factors: available capacity, waitlist size, submission time (first come first serve)
          let priority = 1000;
          
          if (available > 0) {
            // Has capacity - prioritize by submission time
            priority = submittedAt;
          } else {
            // No capacity - add to waitlist priority
            priority = 1000000 + waitlistCount * 1000 + submittedAt;
          }
          
          // Reason for recommendation
          let reason = "";
          if (available > 0) {
            reason = `Available capacity (${available} spot${available !== 1 ? "s" : ""} open)`;
          } else {
            reason = `Waitlist (${waitlistCount + 1} in queue)`;
          }
          
          // Check if already placed
          const alreadyPlaced = placement?.lanes.some((lane) =>
            lane.swimmers.some((s) => s.submissionId === sub.id)
          );
          
          if (!alreadyPlaced) {
            recommendedSlots.push({
              location: pref.location,
              slotLabel,
              reason,
              priority,
            });
          }
        }
      }
      
      // Sort by priority
      recommendedSlots.sort((a, b) => a.priority - b.priority);
      
      return {
        submissionId: sub.id,
        swimmerName: sub.swimmerName,
        level: sub.level,
        parentEmail: sub.parentEmail,
        parentPhone: sub.parentPhone || "",
        recommendedSlots: recommendedSlots.slice(0, 10), // Top 10 recommendations
        submittedAt,
      };
    });

    // Sort by submission time (first come first serve)
    recommendations.sort((a, b) => a.submittedAt - b.submittedAt);

    return NextResponse.json({ recommendations });
  } catch (e) {
    console.error("Get recommendations error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

