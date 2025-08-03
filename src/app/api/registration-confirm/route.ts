// app/api/registration-confirm/route.ts

import { Resend } from "resend"
import { NextResponse } from "next/server"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const data = await request.json()
  console.log("Incoming request:", data)

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Prime Swim Academy</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          background: linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%);
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
          position: relative;
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to bottom, rgba(248, 250, 252, 0.1) 0%, transparent 100%);
        }
        .logo {
          width: 80px;
          height: 80px;
          background-color: rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          position: relative;
          z-index: 1;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
          tracking: -0.025em;
        }
        .header p {
          font-size: 16px;
          opacity: 0.9;
          position: relative;
          z-index: 1;
          font-weight: 300;
        }
        .content {
          padding: 40px 30px;
        }
        .welcome-message {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-left: 4px solid #1e293b;
          padding: 24px;
          margin-bottom: 30px;
          border-radius: 0 12px 12px 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .welcome-message h2 {
          color: #1e293b;
          font-size: 24px;
          margin-bottom: 12px;
          font-weight: 700;
        }
        .welcome-message p {
          color: #475569;
          font-size: 16px;
        }
        .swimmer-info {
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
          padding: 24px;
          border-radius: 12px;
          margin: 25px 0;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .swimmer-info h3 {
          color: #1e293b;
          font-size: 18px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          font-weight: 700;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: #64748b;
        }
        .info-value {
          color: #1e293b;
          font-weight: 500;
        }
        .next-steps {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #f59e0b;
          border-radius: 12px;
          padding: 24px;
          margin: 25px 0;
          box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.1);
        }
        .next-steps h3 {
          color: #92400e;
          font-size: 18px;
          margin-bottom: 16px;
          font-weight: 700;
        }
        .next-steps ul {
          list-style: none;
          padding: 0;
        }
        .next-steps li {
          padding: 10px 0;
          padding-left: 30px;
          position: relative;
          color: #78350f;
          font-weight: 500;
        }
        .next-steps li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #16a34a;
          font-weight: bold;
          font-size: 18px;
        }
        .cta-section {
          text-align: center;
          margin: 35px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: white;
          text-decoration: none;
          padding: 16px 32px;
          border-radius: 50px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 20px 25px -5px rgba(30, 41, 59, 0.3), 0 10px 10px -5px rgba(30, 41, 59, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 25px 30px -5px rgba(30, 41, 59, 0.4), 0 15px 15px -5px rgba(30, 41, 59, 0.15);
        }
        .contact-info {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          padding: 24px;
          border-radius: 12px;
          margin: 25px 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .contact-info h3 {
          color: #1e293b;
          font-size: 18px;
          margin-bottom: 16px;
          font-weight: 700;
        }
        .contact-item {
          display: flex;
          align-items: center;
          margin: 12px 0;
          color: #475569;
          font-weight: 500;
        }
        .contact-icon {
          width: 20px;
          height: 20px;
          margin-right: 12px;
          color: #1e293b;
          font-size: 16px;
        }
        .footer {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: white;
          padding: 35px 30px;
          text-align: center;
        }
        .footer p {
          margin: 8px 0;
          opacity: 0.9;
        }
        .footer strong {
          font-size: 18px;
          font-weight: 700;
        }
        .social-links {
          margin: 25px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 15px;
          color: #94a3b8;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }
        .social-links a:hover {
          color: #ffffff;
        }
        .signature {
          background: linear-gradient(135deg, rgba(248, 250, 252, 0.05) 0%, rgba(241, 245, 249, 0.05) 100%);
          padding: 20px;
          border-radius: 8px;
          margin-top: 30px;
          border-top: 1px solid #e2e8f0;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 8px;
          }
          .header, .content, .footer {
            padding: 25px 20px;
          }
          .header h1 {
            font-size: 24px;
          }
          .info-row {
            flex-direction: column;
            gap: 8px;
          }
          .cta-button {
            padding: 14px 28px;
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo">
            <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width: 100%; height: 100%; border-radius: 50%;" />
          </div>
          <h1>Prime Swim Academy</h1>
          <p>Excellence in Aquatic Education</p>
        </div>

        <!-- Main Content -->
        <div class="content">
          <div class="welcome-message">
            <h2>🎉 Welcome to Our Swimming Family!</h2>
            <p>Dear ${data.parentName || "Parent/Guardian"},</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 24px; color: #475569; line-height: 1.7;">
            Congratulations! We're thrilled to confirm that <strong style="color: #1e293b;">${data.swimmerName}</strong> has been successfully registered at Prime Swim Academy for the upcoming school year. We're excited to begin this aquatic journey together!
          </p>

          <!-- Registration Details -->
          <div class="swimmer-info">
            <h3>📋 Registration Details</h3>
            <div class="info-row">
              <span class="info-label">Swimmer Name:</span>
              <span class="info-value">${data.swimmerName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Parent/Guardian:</span>
              <span class="info-value">${data.parentName || "Not provided"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${data.parentEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span class="info-value">${data.phone || "Not provided"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Age:</span>
              <span class="info-value">${data.age || "Not provided"}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Registration Date:</span>
              <span class="info-value">${new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value" style="color: #16a34a; font-weight: 600;">✅ Confirmed & Paid</span>
            </div>
          </div>

          <!-- Next Steps -->
          <div class="next-steps">
            <h3>🚀 What Happens Next?</h3>
            <ul>
              <li>Access to our parent portal has be provided</li>
              <li>Equipment and uniform information coming your way</li>
              <li>Bring swimwear, goggles, towel, and a positive attitude</li>
            </ul>
          </div>

          <p style="font-size: 16px; margin: 25px 0; color: #475569; line-height: 1.7;">
            We're committed to providing exceptional swimming instruction and helping test test develop both technical skills and a lifelong love for the water. Our experienced coaches are excited to meet you and begin this journey together!
          </p>

          <!-- CTA Section -->
          <div class="cta-section">
            <a href="https://primeswimacademy.com" class="cta-button">
              Visit Our Website
            </a>
          </div>

          <!-- Contact Information -->
          <div class="contact-info">
            <h3>📞 Questions? We're Here to Help!</h3>
            <div class="contact-item">
              <span class="contact-icon">📧</span>
              <span>Email: prime.swim.us@gmail.com</span>
            </div>
            <div class="contact-item">
              <span class="contact-icon">📱</span>
              <span>Phone: (401) 402-0052</span>
            </div>
            <div class="contact-item">
              <span class="contact-icon">📍</span>
              <span>Location: Bellevue, Washington</span>
            </div>
            <div class="contact-item">
              <span class="contact-icon">🕒</span>
              <span>Office Hours: Mon-Fri 8AM-6PM, Sat 9AM-3PM</span>
            </div>
          </div>

          <div class="signature">
            <p style="font-size: 16px; color: #64748b; margin-bottom: 20px;">
              Thank you for choosing Prime Swim Academy. We can't wait to see ${data.swimmerName} make a splash with us! 🌊
            </p>
            <p style="font-size: 16px; margin-top: 25px;">
              <strong style="color: #1e293b;">Warm regards,</strong><br>
              <span style="color: #1e293b; font-weight: 600;">The Prime Swim Academy Team</span><br>
              <span style="color: #64748b; font-size: 14px; font-style: italic;">Building Champions, One Stroke at a Time</span>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>Prime Swim Academy</strong></p>
          <p style="font-size: 14px; margin-bottom: 5px;">Excellence in Swimming Instruction</p>
          <p style="font-size: 14px; opacity: 0.8;">Bellevue, Washington</p>
          
          <div class="social-links">
            <a href="#">Facebook</a>
            <a href="#">Instagram</a>
            <a href="https://primeswimacademy.com">Website</a>
          </div>
          
          <p style="font-size: 12px; margin-top: 25px; opacity: 0.7;">
            © ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.
          </p>
          
          <p style="font-size: 11px; margin-top: 15px; opacity: 0.6;">
            You received this email because you registered at Prime Swim Academy.<br>
            <a href="#" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a> | 
            <a href="#" style="color: #94a3b8; text-decoration: underline;">Update Preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `

  try {
    const response = await resend.emails.send({
      from: "Prime Swim Academy <noreply@primeswimacademy.com>",
      to: data.parentEmail,
      subject: "🎉 Registration Complete – Welcome to Prime Swim Academy!",
      html: emailHtml,
    })

    console.log("Resend response:", response)
    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error("Resend send error:", error)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
