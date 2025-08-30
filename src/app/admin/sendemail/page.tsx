// app/admin/sendemail/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";

type SwimmerDoc = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail: string;
};

type SwimmerFS = {
  childFirstName?: string;
  childLastName?: string;
  swimmerName?: string;
  name?: string;

  parentFirstName?: string;
  parentLastName?: string;
  parentName?: string;
  parentEmail?: string;
  parentEmails?: string[];
};

type SendResp = { ok: boolean; data?: unknown; error?: string };

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 与后端保持一致的简版模板（仅用于预览；以服务端为准）
function renderBrandedHTML(subject: string, innerHtml: string) {
  return `<!doctype html>
<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#f8fafc}
  .container{max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 20px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;text-align:center;padding:28px 20px}
  .logo{width:72px;height:72px;border-radius:50%;margin:0 auto 12px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center}
  .logo img{width:100%;height:100%;border-radius:50%}
  .title{font-weight:700;font-size:22px}
  .content{padding:28px 22px}
  .footer{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:#e2e8f0;text-align:center;padding:20px 16px;font-size:12px}
</style></head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://www.primeswimacademy.com/_next/image?url=%2Fimages%2Fpsa-logo.png&w=128&q=75" alt="Prime Swim Academy" />
      </div>
      <div class="title">Prime Swim Academy</div>
    </div>
    <div class="content">${innerHtml}</div>
    <div class="footer">© ${new Date().getFullYear()} Prime Swim Academy</div>
  </div>
</body></html>`;
}

export default function SendEmailAdminPage() {
  const isAdmin = useIsAdminFromDB();

  const [swimmers, setSwimmers] = useState<SwimmerDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"text" | "html">("text");
  const [bccAdmin, setBccAdmin] = useState(true);
  const [useTemplate, setUseTemplate] = useState(true);

  const [status, setStatus] = useState("");

  // Load swimmers
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "swimmers"));
      const arr: SwimmerDoc[] = [];
      snap.forEach((d) => {
        const x = d.data() as SwimmerFS;
        const sName =
          [x.childFirstName, x.childLastName].filter(Boolean).join(" ").trim() ||
          x.swimmerName ||
          x.name ||
          d.id;
        const pName =
          [x.parentFirstName, x.parentLastName].filter(Boolean).join(" ").trim() ||
          x.parentName ||
          "";
        const pEmail =
          x.parentEmail || (Array.isArray(x.parentEmails) ? x.parentEmails[0] : "") || "";
        if (sName) {
          arr.push({ id: d.id, swimmerName: sName, parentName: pName, parentEmail: pEmail });
        }
      });
      setSwimmers(arr.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName)));
    })();
  }, []);

  // Derived recipients
  const recipients = useMemo(() => {
    return selectedIds
      .map((id) => swimmers.find((s) => s.id === id))
      .filter((s): s is SwimmerDoc => !!s && !!s.parentEmail)
      .map((s) => s.parentEmail)
      .filter((email, idx, self) => self.indexOf(email) === idx);
  }, [selectedIds, swimmers]);

  const subjectPreview = useMemo(() => {
    return subject || `Prime Swim Academy — Announcement`;
  }, [subject]);

  const previewHtml = useMemo(() => {
    const inner =
      contentType === "html"
        ? content || "<p>(empty)</p>"
        : `<pre style="font: 14px/1.7 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Ubuntu,Cantarell,sans-serif; white-space: pre-wrap;">${escapeHtml(
            content || "(empty)"
          )}</pre>`;
    return useTemplate ? renderBrandedHTML(subjectPreview, inner) : inner;
  }, [content, contentType, useTemplate, subjectPreview]);

  if (isAdmin === null) return <div className="p-6">Checking permission…</div>;
  if (!isAdmin) return <div className="p-6 text-red-600 font-semibold">Not authorized (admin only).</div>;

  const handleSend = async () => {
    try {
      if (!recipients.length) throw new Error("Please select at least one student.");
      if (!subject.trim()) throw new Error("Subject is required.");
      if (!content.trim()) throw new Error("Content cannot be empty.");

      setStatus("Sending…");
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);

      const res = await fetch("/api/sendemail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          toEmails: recipients,
          subject,
          content,
          contentType,
          bccAdmin,
          useTemplate, // 关键：让后端套模板
        }),
      });

      const j: SendResp = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Send failed");
      setStatus(`✅ Sent to ${recipients.length} recipient(s).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("❌ " + msg);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Send Custom Email</h1>

      <div className="grid gap-6">
        {/* Multi-select students */}
        <div className="grid gap-2">
          <label className="text-sm font-medium">Students (multi-select)</label>
          <select
            multiple
            className="border rounded-lg p-2 h-56"
            value={selectedIds}
            onChange={(e) =>
              setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {swimmers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.swimmerName}
                {s.parentName ? ` — ${s.parentName}` : ""}
                {s.parentEmail ? `  <${s.parentEmail}>` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Hold Cmd/Ctrl to select multiple</span>
        </div>

        {/* Recipients preview */}
        <div className="grid gap-1">
          <span className="text-sm font-medium">Recipients ({recipients.length})</span>
          <div className="border rounded-lg p-2 bg-slate-50 text-sm break-words min-h-10">
            {recipients.join(", ")}
          </div>
        </div>

        {/* Subject */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Subject</span>
          <input
            className="border rounded-lg p-2"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Schedule Update for This Week"
          />
        </label>

        {/* Content type + toggles */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Content type:</span>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="ctype"
                checked={contentType === "text"}
                onChange={() => setContentType("text")}
              />
              <span>Plain text</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="ctype"
                checked={contentType === "html"}
                onChange={() => setContentType("html")}
              />
              <span>HTML</span>
            </label>
          </div>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} />
            <span className="text-sm">Use PSA template</span>
          </label>

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={bccAdmin} onChange={(e) => setBccAdmin(e.target.checked)} />
            <span className="text-sm">BCC admin (default)</span>
          </label>
        </div>

        {/* Editor */}
        <label className="grid gap-1">
          <span className="text-sm font-medium">Content ({contentType.toUpperCase()})</span>
          <textarea
            className="border rounded-lg p-2 min-h-48 font-mono"
            placeholder={contentType === "text" ? "Type your message…" : "<p>Type your HTML email…</p>"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <span className="text-xs text-slate-500">Tip: HTML supports inline CSS and basic tags.</span>
        </label>

        {/* Preview (with or without template) */}
        <div className="grid gap-1">
          <span className="text-sm font-medium">
            Preview {useTemplate ? "(with PSA template)" : "(raw)"}
          </span>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe title="preview" className="w-full h-96" srcDoc={previewHtml}></iframe>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={handleSend}
          className="rounded-2xl px-5 py-3 font-semibold shadow bg-black text-white hover:opacity-90"
        >
          Send Email
        </button>

        <div className="text-sm">{status}</div>
      </div>
    </div>
  );
}
