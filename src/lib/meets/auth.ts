import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";

export async function optionalMeetUser(req: Request): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) return null;
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export async function requireMeetUser(req: Request): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) throw new Error("UNAUTHORIZED");
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

async function isInAdmins(email?: string | null, uid?: string | null): Promise<boolean> {
  const e = (email || "").trim().toLowerCase();
  const u = uid || undefined;
  for (const col of ["admin", "admins"]) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get();
      if (byEmail.exists) return true;
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get();
      if (byUid.exists) return true;
    }
  }
  if (e) {
    for (const col of ["admin", "admins"]) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get();
      if (!snap.empty) return true;
    }
  }
  return false;
}

export async function requireMeetAdmin(req: Request): Promise<DecodedIdToken> {
  const user = await requireMeetUser(req);
  const email = (user.email || "").toLowerCase();
  const rawRole = (user as Record<string, unknown>)["role"];
  const hasAdminRole = typeof rawRole === "string" && rawRole.toLowerCase() === "admin";
  const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const ok = hasAdminRole || (email && allow.includes(email)) || (await isInAdmins(user.email, user.uid));
  if (!ok) throw new Error("FORBIDDEN");
  return user;
}

/** Admin Firebase token, or MEETS_READ_API_KEY for the separate meet-entries app. */
export async function requireMeetAdminOrReadKey(req: Request): Promise<DecodedIdToken | { kind: "apiKey" }> {
  const expected = (process.env.MEETS_READ_API_KEY || "").trim();
  const headerKey = (req.headers.get("x-api-key") || "").trim();
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (expected && (headerKey === expected || bearer === expected)) {
    return { kind: "apiKey" };
  }
  return requireMeetAdmin(req);
}

export function meetAuthError(e: unknown): { error: string; status: number } | null {
  if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
    return { error: e.message, status: e.message === "UNAUTHORIZED" ? 401 : 403 };
  }
  return null;
}
