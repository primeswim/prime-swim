import { Resend } from "resend";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // ✅ 确保你有这个
import { collection, addDoc, Timestamp } from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const data = await request.json();

  // ✅ 拒绝没有勾选免责同意书的请求
  if (!data.liabilityAccepted) {
    return NextResponse.json({ error: "Liability waiver not accepted" }, { status: 400 });
  }

  // ✅ 保存到 Firestore
  try {
    await addDoc(collection(db, "tryouts"), {
      ...data,
      submittedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    return NextResponse.json({ error: "Failed to save tryout form." }, { status: 500 });
  }

  // ✅ 构建并发送邮件
  const emailHtml = `
    <h2>New Tryout Submission</h2>
    <p><strong>First Name:</strong> ${data.firstName}</p>
    <p><strong>Last Name:</strong> ${data.lastName}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Phone:</strong> ${data.phone}</p>
    <p><strong>Age:</strong> ${data.age}</p>
    <p><strong>Program:</strong> ${data.program}</p>
    <p><strong>Experience:</strong> ${data.experience}</p>
    <p><strong>Preferred Location:</strong> ${data.location}</p>
    <p><strong>Preferred Date:</strong> ${data.preferredDate}</p>
    <p><strong>Preferred Time:</strong> ${data.preferredTime}</p>
    <p><strong>Health Issues:</strong> ${data.healthIssues}</p>
    <p><strong>Notes:</strong> ${data.notes}</p>
  `;

  try {
    await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: "prime.swim.us@gmail.com",
      subject: "*** New Tryout Submission ***",
      html: emailHtml,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: "Tryout saved, but failed to send email." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
