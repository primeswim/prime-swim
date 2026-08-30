import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export async function requireTuitionV2Admin(req: Request): Promise<string> {
  const authz = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(authz);
  if (!m) throw new Error("UNAUTHORIZED");
  const decoded = await getAuth().verifyIdToken(m[1]);
  const email = (decoded.email || "").toLowerCase();
  if (!email) throw new Error("UNAUTHORIZED");
  const adminDoc = await adminDb.collection("admin").doc(email).get();
  if (!adminDoc.exists) throw new Error("FORBIDDEN");
  return email;
}

export function authErrorResponse(e: unknown) {
  if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
    return { error: e.message, status: e.message === "UNAUTHORIZED" ? 401 : 403 };
  }
  return null;
}

export function parseMonthParam(month: string | undefined): string | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  return month;
}
