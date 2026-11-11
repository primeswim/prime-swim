import { escapeEmailHtml, wrapBrandedEmail } from "./branded-email";
import { getTryoutExperienceDetails, type TryoutFormData } from "./tryout-form";

export const tryoutEmailSubject = "Thank You for Scheduling a Tryout — Prime Swim Academy";
export const adminTryoutEmailSubject = "New Tryout Submission — Prime Swim Academy";

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
    <p style="margin:0 0 16px;font-size:16px;color:#475569;">Questions? Text us at <a href="sms:+14014020052" style="color:#1e3a5f;font-weight:600;">401-402-0052</a>. We look forward to seeing you at the pool!</p>
    <p style="margin:24px 0 0;font-size:16px;color:#475569;">Warmly,<br><strong style="color:#1e293b;">Prime Swim Academy Team</strong></p>
  `);
}

export function buildAdminTryoutEmail(data: TryoutFormData, age: string): string {
  const { duration, team, lessons } = getTryoutExperienceDetails(data);
  const contact = Number(age) < 18 ? "Parent or Guardian" : "Swimmer";
  const sections: Array<{ title: string; rows: Array<[string, string]> }> = [
    { title: "Swimmer", rows: [["Name", `${data.firstName} ${data.lastName}`], ["Age", age], ["Interested program", data.program]] },
    { title: `${contact} Contact`, rows: [["Email", data.email], ["Phone", data.phone]] },
    { title: "Swimming Experience", rows: [["Experience", duration], ["Previous swim team", team], ["Previous lessons", lessons]] },
    { title: "Health and Notes", rows: [["Health information", data.healthIssues], ["Additional notes", data.notes]] },
  ];

  return wrapBrandedEmail(adminTryoutEmailSubject, `
    <h2 style="margin:0 0 8px;font-size:26px;line-height:1.3;color:#1e293b;">New Tryout Submission</h2>
    <p style="margin:0 0 24px;color:#475569;">Contact the swimmer or their parent or guardian to arrange a tryout.</p>
    ${sections.map(({ title, rows }) => `
      <div style="margin:0 0 16px;padding:16px 18px;background:#f1f5f9;border-radius:8px;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#1e293b;">${title}</h3>
        ${rows.filter(([, value]) => value).map(([label, value]) => `
          <p style="margin:4px 0;color:#475569;overflow-wrap:anywhere;"><strong style="color:#1e293b;">${label}</strong><br>${escapeEmailHtml(value).replace(/\r?\n/g, "<br>")}</p>
        `).join("") || '<p style="margin:0;color:#475569;">None provided</p>'}
      </div>
    `).join("")}
    <a href="https://www.primeswimacademy.com/admin/tryout-swimmers" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:8px;background:#1e3a5f;color:#fff;font-weight:600;text-decoration:none;">Open Tryout Manager</a>
  `);
}
