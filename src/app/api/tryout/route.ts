import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const data = await request.json();

  const emailHtml = `
    <h2>New Tryout Submission</h2>
    <p><strong>First Name:</strong> ${data.firstName}</p>
    <p><strong>Last Name:</strong> ${data.lastName}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Phone:</strong> ${data.phone}</p>
    <p><strong>Age:</strong> ${data.age}</p>
    <p><strong>Program:</strong> ${data.program}</p>
    <p><strong>Experience:</strong> ${data.experience}</p>
    <p><strong>Preferred Date:</strong> ${data.preferredDate}</p>
    <p><strong>Preferred Time:</strong> ${data.preferredTime}</p>
    <p><strong>Health Issues:</strong> ${data.healthIssues}</p>
    <p><strong>Notes:</strong> ${data.notes}</p>
  `;

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: "prime.swim.us@gmail.com",
    subject: "*** New Tryout Submission ***",
    html: emailHtml,
  });

  return NextResponse.json({ success: true });
}
