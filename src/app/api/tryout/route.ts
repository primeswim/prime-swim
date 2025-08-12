// app/api/tryout/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

function normalizeDate(d: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function isAlreadyExistsError(e: any) {
  if (e?.code === 6 || e?.code === "already-exists") return true;
  return /ALREADY_EXISTS/i.test(String(e?.message || ""));
}
async function acquireLock(program: string, date: string) {
  const id = `${program}_${date}`;
  await adminDb.collection("tryout_locks").doc(id).create({
    program, date, createdAt: Timestamp.now(),
  });
}

export async function POST(request: Request) {
  const data = await request.json();

  if (!data.liabilityAccepted) {
    return NextResponse.json({ error: "LIABILITY_REQUIRED", message: "Liability waiver not accepted" }, { status: 400 });
  }

  const program = String(data.program || "").trim().toLowerCase();
  const preferredDate = normalizeDate(data.preferredDate);

  const allowed = ["bronze","silver","gold","platinum","olympic","unsure"];
  if (!allowed.includes(program)) {
    return NextResponse.json({ error: "INVALID_PROGRAM", message: "Please select a valid program." }, { status: 400 });
  }
  if ((program === "bronze" || program === "silver") && !preferredDate) {
    return NextResponse.json({ error: "MISSING_DATE", message: "Please choose a date for Bronze/Silver tryouts." }, { status: 400 });
  }

  try {
    if (program === "bronze" || program === "silver") {
      // ① 兼容历史数据
      const existing = await adminDb.collection("tryouts")
        .where("program","==",program).where("preferredDate","==",preferredDate).limit(1).get();
      if (!existing.empty) {
        const capProgram = program[0].toUpperCase()+program.slice(1);
        return NextResponse.json({ error:"TRYOUT_FULL", message:`Tryout is full for ${capProgram} on ${preferredDate}. Please choose another date.` }, { status: 409 });
      }
      // ② 并发唯一锁
      try { await acquireLock(program, preferredDate); }
      catch (e:any) {
        if (isAlreadyExistsError(e)) {
          const capProgram = program[0].toUpperCase()+program.slice(1);
          return NextResponse.json({ error:"TRYOUT_FULL", message:`Tryout is full for ${capProgram} on ${preferredDate}. Please choose another date.` }, { status: 409 });
        }
        throw e;
      }
    }

    await adminDb.collection("tryouts").add({
      ...data,
      program,
      preferredDate,
      capKey: (program==="bronze"||program==="silver") ? `${program}_${preferredDate}` : null,
      submittedAt: Timestamp.now(),
    });
  } catch (e:any) {
    console.error("Error saving tryout:", e);
    return NextResponse.json({ error:"FAILED_SAVE", message:"Failed to save tryout form." }, { status: 500 });
  }

  // 邮件忽略错误
  try {
    const emailHtml = `
      <h2>New Tryout Submission</h2>
      <p><strong>First Name:</strong> ${data.firstName ?? ""}</p>
      <p><strong>Last Name:</strong> ${data.lastName ?? ""}</p>
      <p><strong>Email:</strong> ${data.email ?? ""}</p>
      <p><strong>Phone:</strong> ${data.phone ?? ""}</p>
      <p><strong>Age:</strong> ${data.age ?? ""}</p>
      <p><strong>Program:</strong> ${program}</p>
      <p><strong>Experience:</strong> ${data.experience ?? ""}</p>
      <p><strong>Preferred Location:</strong> ${data.location ?? ""}</p>
      <p><strong>Preferred Date:</strong> ${preferredDate}</p>
      <p><strong>Preferred Time:</strong> ${data.preferredTime ?? ""}</p>
      <p><strong>Health Issues:</strong> ${data.healthIssues ?? ""}</p>
      <p><strong>Notes:</strong> ${data.notes ?? ""}</p>
    `;
    await resend.emails.send({ from:"Prime Swim Academy <noreply@primeswimacademy.com>", to:"prime.swim.us@gmail.com", subject:"*** New Tryout Submission ***", html: emailHtml });
  } catch {}

  return NextResponse.json({ success: true });
}
