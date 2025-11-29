// app/api/attendance/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

// Optimized: shorter field names to save storage
// Field mapping: d=date, sId=swimmerId, sN=swimmerName, st=status (a/x/m/t), 
// l=location, t=timeSlot, n=notes, mBy=markedBy, mAt=markedAt

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
      queryRef = queryRef.where("d", "==", date);
    } else if (month) {
      // Query for all dates in the month
      const startDate = `${month}-01`;
      // Get last day of month
      const [yearNum, monthNum] = month.split('-').map(Number);
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      queryRef = queryRef.where("d", ">=", startDate).where("d", "<=", endDate);
    } else if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      queryRef = queryRef.where("d", ">=", startDate).where("d", "<=", endDate);
    }

    if (swimmerId) {
      queryRef = queryRef.where("sId", "==", swimmerId);
    }

    // Try to order by date and markedAt, but if index doesn't exist, just order by date
    let snap;
    try {
      snap = await queryRef.orderBy("d", "desc").orderBy("mAt", "desc").get();
    } catch {
      // If composite index doesn't exist, just order by date
      console.log("Composite index not found, ordering by date only");
      snap = await queryRef.orderBy("d", "desc").get();
    }
    
    // Convert optimized fields back to readable format for frontend
    const records = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        // Support both old and new field names
        date: data.d || data.date,
        swimmerId: data.sId || data.swimmerId,
        swimmerName: data.sN || data.swimmerName,
        status: data.st === "a" ? "attended" : data.st === "x" ? "absent" : data.st === "m" ? "make-up" : data.st === "t" ? "trial" : data.status,
        location: data.l || data.location,
        timeSlot: data.t || data.timeSlot,
        notes: data.n || data.notes,
        markedBy: data.mBy || data.markedBy,
        markedAt: data.mAt || data.markedAt,
      };
    });

    console.log(`Found ${records.length} attendance records for query`);
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

    const body = await req.json() as {
      id?: string;
      date?: string;
      d?: string;
      swimmerId?: string;
      sId?: string;
      swimmerName?: string;
      sN?: string;
      status?: "attended" | "absent" | "make-up" | "trial";
      st?: "a" | "x" | "m" | "t";
      location?: string;
      l?: string;
      timeSlot?: string;
      t?: string;
      notes?: string;
      n?: string;
    };
    
    // Support both old and new field names for backward compatibility
    const date = body.date || body.d;
    const swimmerId = body.swimmerId || body.sId;
    const swimmerName = body.swimmerName || body.sN;
    const statusInput = body.status || body.st;
    
    if (!date || !swimmerId || !swimmerName || !statusInput) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Convert status to short form
    const statusMap: Record<string, "a" | "x" | "m" | "t"> = {
      "attended": "a",
      "absent": "x",
      "make-up": "m",
      "trial": "t",
      "a": "a",
      "x": "x",
      "m": "m",
      "t": "t",
    };
    
    const status = statusMap[statusInput];
    if (!status) {
      return NextResponse.json({ 
        error: `Invalid status: ${statusInput}` 
      }, { status: 400 });
    }

    // Build record data with optimized field names
    const recordData: Record<string, unknown> = {
      d: date,
      sId: swimmerId,
      sN: swimmerName,
      st: status,
      mBy: email,
      mAt: Timestamp.now(),
    };

    // Only add optional fields if they are defined
    const location = body.location || body.l;
    const timeSlot = body.timeSlot || body.t;
    const notes = body.notes || body.n;
    
    if (location !== undefined && location !== null && location !== "") {
      recordData.l = location;
    }
    if (timeSlot !== undefined && timeSlot !== null && timeSlot !== "") {
      recordData.t = timeSlot;
    }
    if (notes !== undefined && notes !== null && notes !== "") {
      recordData.n = notes;
    }

    if (body.id) {
      // Update existing
      await adminDb.collection("attendance").doc(body.id).update(recordData);
      return NextResponse.json({ id: body.id, ...recordData });
    } else {
      // Check if record already exists for this date and swimmer
      const existing = await adminDb
        .collection("attendance")
        .where("d", "==", date)
        .where("sId", "==", swimmerId)
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

