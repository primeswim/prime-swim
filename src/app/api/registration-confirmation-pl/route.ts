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
            <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Registration Confirmed</title>
      <style>
        body {
          background-color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          background-color: white;
          margin: 40px auto;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
        }
        .header {
          background: linear-gradient(135deg, #1e293b, #334155);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .header img {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          margin-bottom: 15px;
        }
        .content {
          padding: 30px;
        }
        .content h2 {
          font-size: 24px;
          margin-bottom: 16px;
        }
        .content p {
          font-size: 16px;
          margin-bottom: 16px;
          line-height: 1.6;
        }
        .footer {
          background: #f1f5f9;
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
        }
        .footer a {
          color: #334155;
          text-decoration: none;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="PSA Logo" />
          <h1>Prime Swim Academy</h1>
          <p>Private Lesson Registration</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName},</h2>
          <p>🎉 Thanks for registering for private lessons with <strong>Prime Swim Academy</strong>!</p>
          <p>We’re excited to help you grow stronger, safer, and more confident in the water.</p>
          <p>✅ Your registration has been received. We’ll be in touch soon with scheduling details.</p>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>💧 See you at the pool!</p>
          <p style="margin-top: 30px;"><strong>- Prime Swim Academy Team</strong></p>
        </div>
        <div class="footer">
          <p>Prime Swim Academy · Bellevue, WA</p>
          <p><a href="https://www.primeswimacademy.com">Visit our website</a></p>
        </div>
      </div>
    </body>
    </html>
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
