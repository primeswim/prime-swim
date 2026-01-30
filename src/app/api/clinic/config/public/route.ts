// app/api/clinic/config/public/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

interface ClinicSlot {
  date?: string;
  label: string;
  time?: string;
}

interface ClinicLocation {
  name: string;
  slots: ClinicSlot[];
}

interface ClinicConfig {
  id: string;
  locations?: ClinicLocation[];
  active?: boolean;
  [key: string]: unknown;
}

/**
 * Check if a clinic is expired by finding the latest date in all slots
 * A clinic is expired if all its slots have dates that are in the past
 */
function isClinicExpired(clinic: ClinicConfig): boolean {
  if (!clinic.locations || clinic.locations.length === 0) {
    return false; // If no locations/slots, consider it not expired
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day for comparison

  let latestDate: Date | null = null;

  // Find the latest date across all slots
  for (const location of clinic.locations) {
    if (!location.slots || location.slots.length === 0) continue;
    
    for (const slot of location.slots) {
      if (slot.date) {
        try {
          // Parse date string as local date to avoid timezone offset
          let slotDate: Date;
          if (/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
            // YYYY-MM-DD format - parse as local date
            const [year, month, day] = slot.date.split('-').map(Number);
            slotDate = new Date(year, month - 1, day);
          } else {
            slotDate = new Date(slot.date);
          }
          slotDate.setHours(0, 0, 0, 0);
          
          if (!latestDate || slotDate > latestDate) {
            latestDate = slotDate;
          }
        } catch (e) {
          // Invalid date, skip
          console.warn(`Invalid date in clinic ${clinic.id}: ${slot.date}`);
        }
      }
    }
  }

  // If no valid dates found, consider it not expired
  if (!latestDate) {
    return false;
  }

  // Clinic is expired if the latest date is in the past
  return latestDate < now;
}

// GET: 获取所有 clinic 配置（公开，不需要认证）
// 返回所有 clinic，包括 active 和 archived，并标记是否过期
export async function GET() {
  try {
    // Get all clinics (both active and archived)
    const snap = await adminDb
      .collection("clinicConfigs")
      .get();

    if (snap.empty) {
      return NextResponse.json({ configs: [] });
    }

    const archivePromises: Promise<void>[] = [];
    const allClinics: (ClinicConfig & { isExpired: boolean })[] = [];

    // Process each clinic
    for (const doc of snap.docs) {
      const data = doc.data();
      const clinic: ClinicConfig = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt,
      } as ClinicConfig;

      // Check if clinic is expired
      const expired = isClinicExpired(clinic);
      
      // Auto-archive expired clinics that are still marked as active
      if (expired && clinic.active === true) {
        archivePromises.push(
          adminDb.collection("clinicConfigs").doc(doc.id).update({
            active: false,
            archivedAt: Timestamp.now(),
          }).then(() => {
            console.log(`Auto-archived expired clinic: ${doc.id}`);
          }).catch((err) => {
            console.error(`Failed to archive clinic ${doc.id}:`, err);
          })
        );
        // Update clinic data to reflect archived status
        clinic.active = false;
      }

      // Include all clinics with expiration status
      allClinics.push({
        ...clinic,
        isExpired: expired,
      });
    }

    // Wait for all archive operations to complete (but don't fail if some fail)
    await Promise.allSettled(archivePromises);

    // Sort by createdAt descending (most recent first)
    allClinics.sort((a, b) => {
      const aTime = (a.createdAt as { toMillis?: () => number; _seconds?: number })?.toMillis?.() || 
                    ((a.createdAt as { _seconds?: number })?._seconds ? (a.createdAt as { _seconds: number })._seconds * 1000 : 0) || 0;
      const bTime = (b.createdAt as { toMillis?: () => number; _seconds?: number })?.toMillis?.() || 
                    ((b.createdAt as { _seconds?: number })?._seconds ? (b.createdAt as { _seconds: number })._seconds * 1000 : 0) || 0;
      return bTime - aTime;
    });

    return NextResponse.json({ configs: allClinics });
  } catch (e) {
    console.error("Get public clinic configs error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

