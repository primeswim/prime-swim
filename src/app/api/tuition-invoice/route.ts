// app/api/tuition-invoice/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  buildTuitionEmailHtml,
  buildTuitionEmailSubject,
  type TuitionEmailPayload,
} from "@/lib/tuition-email";

const resend = new Resend(process.env.RESEND_API_KEY);

type Payload = Omit<TuitionEmailPayload, "variant"> & {
  cc?: string[];
  bccAdmin?: boolean;
  variant?: TuitionEmailPayload["variant"];
  daysUntilDue?: number;
};

async function isInAdminsServer(email?: string | null, uid?: string | null) {
  const e = (email || "").trim().toLowerCase();
  const u = uid || undefined;
  const colNames = ["admin", "admins"];

  for (const col of colNames) {
    if (e) {
      const byEmail = await adminDb.collection(col).doc(e).get();
      if (byEmail.exists) return true;
    }
    if (u) {
      const byUid = await adminDb.collection(col).doc(u).get();
      if (byUid.exists) return true;
    }
  }
  for (const col of colNames) {
    if (e) {
      const snap = await adminDb.collection(col).where("email", "==", e).limit(1).get();
      if (!snap.empty) return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded: DecodedIdToken = await getAuth().verifyIdToken(idToken);
    const emailLower = (decoded.email ?? "").toLowerCase();

    const rawRole = (decoded as Record<string, unknown>)["role"];
    const hasAdminRole = typeof rawRole === "string" && rawRole.toLowerCase() === "admin";

    const allow = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      hasAdminRole ||
      (emailLower !== "" && allow.includes(emailLower)) ||
      (await isInAdminsServer(decoded.email ?? null, decoded.uid));

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    const data = (await req.json()) as Payload;

    const emailPayload: TuitionEmailPayload = {
      parentName: data.parentName,
      parentEmail: data.parentEmail,
      swimmerName: data.swimmerName,
      months: data.months || [],
      practiceText: data.practiceText,
      dueDate: data.dueDate,
      amount: data.amount,
      afterFeeNote: data.afterFeeNote,
      variant: data.variant ?? "invoice",
      daysUntilDue: data.daysUntilDue,
    };

    const html = buildTuitionEmailHtml(emailPayload);
    const subject = buildTuitionEmailSubject(emailPayload);

    const resp = await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: data.parentEmail,
      cc: data.cc?.length ? data.cc : undefined,
      bcc: data.bccAdmin ? ["prime.swim.us@gmail.com"] : undefined,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, data: resp });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tuition-invoice error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
