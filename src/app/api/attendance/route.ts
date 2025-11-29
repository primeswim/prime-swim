// app/api/attendance/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

interface AttendanceRecord {
  id?: string;
  date: string; // YYYY-MM-DD format
  swimmerId: string;
  swimmerName: string;
  status: "attended" | "absent" | "make-up" | "trial";
  location?: string;
  timeSlot?: string;
  notes?: string;
  markedBy: string; // Admin email
  markedAt: Timestamp;
}

// GET: 获取考勤记录
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
    const date = searchParams.get("date"); // YYYY-MM-DD
    const swimmerId = searchParams.get("swimmerId");
    const month = searchParams.get("month"); // YYYY-MM
    const year = searchParams.get("year"); // YYYY

    let queryRef: FirebaseFirestore.Query = adminDb.collection("attendance");

    if (date) {
      queryRef = queryRef.where("date", "==", date);
    } else if (month) {
      // Query for all dates in the month
      const startDate = `${month}-01`;
      // Get last day of month
      const [year, monthNum] = month.split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      queryRef = queryRef.where("date", ">=", startDate).where("date", "<=", endDate);
    } else if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      queryRef = queryRef.where("date", ">=", startDate).where("date", "<=", endDate);
    }

    if (swimmerId) {
      queryRef = queryRef.where("swimmerId", "==", swimmerId);
    }

    const snap = await queryRef.orderBy("date", "desc").orderBy("markedAt", "desc").get();
    const records = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ records });
  } catch (e) {
    console.error("Get attendance error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: 创建或更新考勤记录
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

    const body = await req.json() as AttendanceRecord & { id?: string };
    
    if (!body.date || !body.swimmerId || !body.swimmerName || !body.status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["attended", "absent", "make-up", "trial"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ 
        error: `Invalid status: ${body.status}. Must be one of: ${validStatuses.join(", ")}` 
      }, { status: 400 });
    }

    // Build record data, only including defined fields
    const recordData: Record<string, unknown> = {
      date: body.date,
      swimmerId: body.swimmerId,
      swimmerName: body.swimmerName,
      status: body.status,
      markedBy: email,
      markedAt: Timestamp.now(),
    };

    // Only add optional fields if they are defined
    if (body.location !== undefined && body.location !== null && body.location !== "") {
      recordData.location = body.location;
    }
    if (body.timeSlot !== undefined && body.timeSlot !== null && body.timeSlot !== "") {
      recordData.timeSlot = body.timeSlot;
    }
    if (body.notes !== undefined && body.notes !== null && body.notes !== "") {
      recordData.notes = body.notes;
    }

    if (body.id) {
      // Update existing
      await adminDb.collection("attendance").doc(body.id).update(recordData);
      return NextResponse.json({ id: body.id, ...recordData });
    } else {
      // Check if record already exists for this date and swimmer
      const existing = await adminDb
        .collection("attendance")
        .where("date", "==", body.date)
        .where("swimmerId", "==", body.swimmerId)
        .get();

      if (!existing.empty) {
        // Update existing record
        const docId = existing.docs[0].id;
        await adminDb.collection("attendance").doc(docId).update(recordData);
        return NextResponse.json({ id: docId, ...recordData });
      } else {
        // Create new record
        const docRef = await adminDb.collection("attendance").add(recordData);
        return NextResponse.json({ id: docRef.id, ...recordData });
      }
    }
  } catch (e) {
    console.error("Create/update attendance error:", e);
    const errorMessage = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE: 删除考勤记录
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

    await adminDb.collection("attendance").doc(id).delete();
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete attendance error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

