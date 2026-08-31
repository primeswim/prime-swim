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
  if (!month) return null;
  const decoded = decodeURIComponent(month.trim());
  const normalized = /^\d{4}_\d{2}$/.test(decoded) ? decoded.replace("_", "-") : decoded;
  if (!/^\d{4}-\d{2}$/.test(normalized)) return null;
  const m = Number(normalized.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return normalized;
}
