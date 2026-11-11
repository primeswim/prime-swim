import { escapeEmailHtml, wrapBrandedEmail } from "./branded-email";

export const tryoutEmailSubject = "Thank You for Scheduling a Tryout — Prime Swim Academy";

export function buildTryoutReceipt(firstName: string, lastName: string): string {
  const swimmerName = escapeEmailHtml(`${firstName} ${lastName}`.trim());
  return wrapBrandedEmail(tryoutEmailSubject, `
    <h2 style="margin:0 0 20px;font-size:26px;line-height:1.3;color:#1e293b;">Thank you for scheduling a tryout!</h2>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;">We’ve received the tryout request for <strong style="color:#1e293b;">${swimmerName}</strong>.</p>
    <div style="margin:24px 0;padding:20px 22px;background:#f1f5f9;border-left:4px solid #1e293b;border-radius:0 8px 8px 0;">
      <h3 style="margin:0 0 8px;font-size:18px;color:#1e293b;">What happens next</h3>
      <p style="margin:0;font-size:16px;color:#475569;">Our team will reach out to finalize your tryout date, time, and location.</p>
    </div>
    <h3 style="margin:28px 0 12px;font-size:18px;color:#1e293b;">What to bring</h3>
    <ul style="margin:0 0 24px;padding-left:22px;font-size:16px;color:#475569;">
      <li style="margin-bottom:8px;">Swimsuit</li>
      <li style="margin-bottom:8px;">Swim goggles</li>
      <li>Swim cap, if you have one</li>
    </ul>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;">If you have any questions, simply reply to this email. We look forward to seeing you at the pool!</p>
    <p style="margin:24px 0 0;font-size:16px;color:#475569;">Warmly,<br><strong style="color:#1e293b;">Prime Swim Academy Team</strong></p>
  `);
}
