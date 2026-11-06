export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function wrapBrandedEmail(subject: string, htmlContent: string) {
  // logo + footer 模板
  const header = `
    <div style="text-align:center;padding:40px 30px;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;">
      <div style="width:80px;height:80px;background:rgba(255,255,255,.15);border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy Logo" style="width:100%;height:100%;border-radius:50%;" />
      </div>
      <h1 style="margin:0;font-size:28px;font-weight:700;">Prime Swim Academy</h1>
      <p style="margin:8px 0 0;font-size:16px;opacity:.9;">Excellence in Aquatic Education</p>
    </div>
  `;

  const footer = `
    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#fff;text-align:center;padding:35px 30px;">
      <p style="margin:8px 0;font-size:18px;font-weight:700;">Prime Swim Academy</p>
      <p style="margin:8px 0;opacity:.9;">Bellevue, Washington</p>
      <p style="margin:8px 0;opacity:.7;font-size:12px;">© ${new Date().getFullYear()} Prime Swim Academy. All rights reserved.</p>
    </div>
  `;


  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeEmailHtml(subject)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;line-height:1.6;background:linear-gradient(to bottom,#f8fafc 0%,#ffffff 100%);color:#1e293b;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 10px 10px -5px rgba(0,0,0,.04);">
    ${header}
    <div style="padding:40px 30px;">
      ${htmlContent}
    </div>
    ${footer}
  </div>
</body>
</html>`;
}
