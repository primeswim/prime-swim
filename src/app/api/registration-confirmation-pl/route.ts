import { Resend } from "resend"
import { NextResponse } from "next/server"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const data = await request.json()
  console.log("Incoming private lesson registration:", data)

  const { firstName, lastName, email, phone, dateOfBirth, swimmingLevel, goals } = data

  try {
    // Email to registrant
    await resend.emails.send({
      from: "Prime Swim Academy <no-reply@primeswimacademy.com>",
      to: email,
      subject: "🎉 Private Lesson Registration Confirmed - Prime Swim Academy",
      html: `
        <h2>Hi ${firstName},</h2>
        <p>Thanks for registering for private lessons with Prime Swim Academy! We're excited to work with you.</p>
        <p>We'll be in touch soon with scheduling details. If you have any questions, feel free to reply to this email.</p>
        <p>💧 See you at the pool!</p>
        <p><strong>- Prime Swim Academy Team</strong></p>
      `,
    })

    // Email to yourself
    await resend.emails.send({
      from: "Private Lesson Bot <no-reply@primeswimacademy.com>",
      to: "prime.swim.us@gmail.com",
      subject: `📥 New Private Lesson Registration: ${firstName} ${lastName}`,
      html: `
        <h2>New Private Lesson Registration</h2>
        <ul>
          <li><strong>Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>DOB:</strong> ${dateOfBirth}</li>
          <li><strong>Level:</strong> ${swimmingLevel}</li>
          <li><strong>Goals:</strong> ${goals || "N/A"}</li>
        </ul>
        <p>📬 Check Firestore for full form data.</p>
      `,
    })

    return NextResponse.json({ status: "success" })
  } catch (error) {
    console.error("Email sending failed:", error)
    return NextResponse.json({ error: "Email sending failed" }, { status: 500 })
  }
}
