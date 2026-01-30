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
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,.15);
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 16px;
          opacity: .9;
          font-weight: 300;
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
        .contact-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }
        .contact-section p {
          color: #475569;
          font-size: 14px;
          line-height: 1.8;
        }
        .contact-section a {
          color: #1e40af;
          text-decoration: none;
          font-weight: 500;
        }
        .wechat-qr {
          text-align: center;
          margin: 16px 0;
        }
        .wechat-qr img {
          width: 120px;
          height: 120px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          display: block;
          margin: 0 auto;
        }
        .footer {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: white;
          padding: 35px 30px;
          text-align: center;
        }
        .footer p {
          margin: 8px 0;
          opacity: .9;
        }
        .footer strong {
          font-size: 18px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" />
          </div>
          <h1>Prime Swim Academy</h1>
          <p>Excellence in Aquatic Education</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName},</h2>
          <p>🎉 Thanks for registering for private lessons with <strong>Prime Swim Academy</strong>!</p>
          <p>We're excited to help you grow stronger, safer, and more confident in the water.</p>
          <p>✅ Your registration has been received. We'll be in touch soon with scheduling details.</p>
          <p>💧 See you at the pool!</p>
          <p style="margin-top: 30px;"><strong>- Prime Swim Academy Team</strong></p>
          
          <div class="contact-section">
            <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">Questions? We're here to help!</p>
            <p style="margin:0 0 8px 0;">
              📧 Email us at: <a href="mailto:prime.swim.us@gmail.com">prime.swim.us@gmail.com</a>
            </p>
            <p style="margin:0 0 16px 0;">
              💬 Or scan our WeChat QR code:
            </p>
            <div class="wechat-qr">
              <img src="https://www.primeswimacademy.com/images/wechatlogo.JPG" alt="WeChat QR Code" />
            </div>
          </div>
        </div>
        <div class="footer">
          <p><strong>Prime Swim Academy</strong></p>
          <p style="font-size:12px;opacity:.7;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
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
