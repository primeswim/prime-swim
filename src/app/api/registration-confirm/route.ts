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
          color: #333333;
          background-color: #f8fafc;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        
        .logo {
          width: 80px;
          height: 80px;
          background-color: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .header p {
          font-size: 16px;
          opacity: 0.9;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .welcome-message {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-left: 4px solid #0ea5e9;
          padding: 20px;
          margin-bottom: 30px;
          border-radius: 0 8px 8px 0;
        }
        
        .welcome-message h2 {
          color: #0284c7;
          font-size: 24px;
          margin-bottom: 10px;
        }
        
        .swimmer-info {
          background-color: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
          border: 1px solid #e2e8f0;
        }
        
        .swimmer-info h3 {
          color: #1e293b;
          font-size: 18px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
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
          background-color: #fefce8;
          border: 1px solid #fde047;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .next-steps h3 {
          color: #a16207;
          font-size: 18px;
          margin-bottom: 15px;
        }
        
        .next-steps ul {
          list-style: none;
          padding: 0;
        }
        
        .next-steps li {
          padding: 8px 0;
          padding-left: 25px;
          position: relative;
        }
        
        .next-steps li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #16a34a;
          font-weight: bold;
        }
        
        .cta-section {
          text-align: center;
          margin: 30px 0;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);
          transition: transform 0.2s;
        }
        
        .contact-info {
          background-color: #f1f5f9;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        
        .contact-info h3 {
          color: #1e293b;
          font-size: 18px;
          margin-bottom: 15px;
        }
        
        .contact-item {
          display: flex;
          align-items: center;
          margin: 10px 0;
          color: #475569;
        }
        
        .contact-icon {
          width: 20px;
          height: 20px;
          margin-right: 10px;
          color: #0ea5e9;
        }
        
        .footer {
          background-color: #1e293b;
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .footer p {
          margin: 5px 0;
          opacity: 0.8;
        }
        
        .social-links {
          margin: 20px 0;
        }
        
        .social-links a {
          display: inline-block;
          margin: 0 10px;
          color: #0ea5e9;
          text-decoration: none;
          font-weight: 500;
        }
        
        @media (max-width: 600px) {
          .container {
            margin: 0;
            box-shadow: none;
          }
          
          .header, .content, .footer {
            padding: 20px;
          }
          
          .header h1 {
            font-size: 24px;
          }
          
          .info-row {
            flex-direction: column;
            gap: 5px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo">🏊‍♀️</div>
          <h1>Prime Swim Academy</h1>
          <p>Excellence in Aquatic Education</p>
        </div>
        
        <!-- Main Content -->
        <div class="content">
          <div class="welcome-message">
            <h2>🎉 Welcome to Our Swimming Family!</h2>
            <p>Dear ${data.parentName || "Parent"},</p>
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Congratulations! We're thrilled to confirm that <strong>${data.swimmerName}</strong> has been successfully registered at Prime Swim Academy for the upcoming school year.
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
            </ul>
          </div>
          
          <p style="font-size: 16px; margin: 25px 0;">
            We're committed to providing exceptional swimming instruction and helping ${data.swimmerName} develop both technical skills and a lifelong love for the water. Our experienced coaches are excited to begin this aquatic journey together!
          </p>
          
          <!-- CTA Section -->
          <div class="cta-section">
            <a href="https://primeswimacademy.com/dashboard" class="cta-button">
              Access Parent Portal
            </a>
          </div>
          
          <!-- Contact Information -->
          <div class="contact-info">
            <h3>📞 Need Help? We're Here for You!</h3>
            <div class="contact-item">
              <span class="contact-icon">📧</span>
              <span>Email: prime.swim.us@gmail.com</span>
            </div>
            <div class="contact-item">
              <span class="contact-icon">📱</span>
              <span>Phone: (401) 402-0052</span>
            </div>
            <div class="contact-item">
              <span class="contact-icon">🕒</span>
              <span>Office Hours: Mon-Fri 8AM-6PM, Sat 9AM-3PM</span>
            </div>
          </div>
          
          <p style="font-size: 16px; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Thank you for choosing Prime Swim Academy. We can't wait to see ${data.swimmerName} make a splash with us! 🌊
          </p>
          
          <p style="font-size: 16px; margin-top: 25px;">
            <strong>Warm regards,</strong><br>
            <span style="color: #0ea5e9; font-weight: 600;">The Prime Swim Academy Team</span>
          </p>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p><strong>Prime Swim Academy</strong></p>
          <p>Building Champions, One Stroke at a Time</p>
          
          <div class="social-links">
            <a href="">Facebook</a>
            <a href="">Instagram</a>
            <a href="https://primeswimacademy.com">Website</a>
          </div>
          
          <p style="font-size: 12px; margin-top: 20px;">
            © ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.<br>
          </p>
          
          <p style="font-size: 11px; margin-top: 15px; opacity: 0.7;">
            You received this email because you registered at Prime Swim Academy.<br>
            <a href="#" style="color: #0ea5e9;">Unsubscribe</a> | 
            <a href="#" style="color: #0ea5e9;">Update Preferences</a>
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
