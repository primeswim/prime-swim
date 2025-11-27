// app/admin/sendemail/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { Mail, Users, CheckCircle2, AlertCircle, FileText, Eye, Filter } from "lucide-react";
import { type SwimmerLevel, LEVEL_GROUPS } from "@/lib/swimmer-levels";

type SwimmerDoc = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail: string;
  level?: SwimmerLevel;
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
  level?: SwimmerLevel;
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

/** 轻量邮箱校验（避免过度严格） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** 拆分输入文本为邮箱数组，支持逗号/分号/换行/空白分隔，并做去重与基本校验 */
function parseEmails(input: string): { emails: string[]; invalid: string[] } {
  const raw = input
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const token of raw) {
    const t = token.toLowerCase();
    if (!EMAIL_RE.test(t)) {
      invalid.push(token);
      continue;
    }
    if (!seen.has(t)) {
      seen.add(t);
      emails.push(t);
    }
  }
  return { emails, invalid };
}

// Convert plain text to HTML with rich formatting support
function textToHtml(text: string): string {
  if (!text.trim()) return "<p>(empty)</p>";
  
  // Split by double newlines to create paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length === 0) return "<p>(empty)</p>";
  
  return paragraphs
    .map(para => {
      const trimmed = para.trim();
      
      // Check for headings (lines starting with # or all caps)
      if (/^#{1,3}\s+/.test(trimmed)) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const content = trimmed.replace(/^#+\s+/, "");
        const size = level === 1 ? "24px" : level === 2 ? "20px" : "18px";
        const formatted = formatInlineText(content);
        return `<h${Math.min(level, 3)} style="font-size: ${size}; font-weight: 700; color: #1e293b; margin: 24px 0 16px; line-height: 1.3;">${formatted}</h${Math.min(level, 3)}>`;
      }
      
      // Check for list items (starting with -, *, or numbers)
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        const formatted = formatInlineText(content);
        return `<li style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 8px; padding-left: 8px;">${formatted}</li>`;
      }
      
      // Check if it's a list block (multiple list items)
      const lines = trimmed.split(/\n/);
      if (lines.length > 1 && lines.every(line => /^[-*•]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim()))) {
        const listItems = lines
          .map(line => {
            const content = line.trim().replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
            const formatted = formatInlineText(content);
            return `<li style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 8px; padding-left: 8px;">${formatted}</li>`;
          })
          .join("");
        return `<ul style="margin: 16px 0; padding-left: 24px; list-style: none;">${listItems}</ul>`;
      }
      
      // Regular paragraph with inline formatting
      const formatted = formatInlineText(trimmed);
      return `<p style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 16px;">${formatted}</p>`;
    })
    .join("");
}

// Format inline text (bold, italic, links, etc.)
function formatInlineText(text: string): string {
  let result = escapeHtml(text);
  
  // Convert **bold** or __bold__ to <strong>
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 700; color: #1e293b;">$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong style="font-weight: 700; color: #1e293b;">$1</strong>');
  
  // Convert *italic* or _italic_ to <em>
  result = result.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');
  result = result.replace(/_(.+?)_/g, '<em style="font-style: italic;">$1</em>');
  
  // Convert [text](url) to links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4338ca; text-decoration: underline;">$1</a>');
  
  // Auto-detect URLs and convert to links
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  result = result.replace(urlRegex, '<a href="$1" style="color: #4338ca; text-decoration: underline;">$1</a>');
  
  // Convert single newlines to <br/>
  result = result.replace(/\n/g, "<br/>");
  
  return result;
}

export default function SendEmailAdminPage() {
  const isAdmin = useIsAdminFromDB();

  const [swimmers, setSwimmers] = useState<SwimmerDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<SwimmerLevel[]>([]);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<"text" | "html">("text");
  const [bccAdmin, setBccAdmin] = useState(true);

  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);

  // 新增：可编辑的收件人文本与"是否手动修改"标记
  const [recipientsText, setRecipientsText] = useState("");
  const [recipientsDirty, setRecipientsDirty] = useState(false);

  // Update status handler to set success state
  const updateStatus = (message: string, isSuccess: boolean) => {
    setStatus(message);
    setSuccess(isSuccess);
  };

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
        const level = x.level as SwimmerLevel | undefined;
        if (sName) {
          arr.push({ id: d.id, swimmerName: sName, parentName: pName, parentEmail: pEmail, level });
        }
      });
      setSwimmers(arr.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName)));
    })();
  }, []);

  /** 基于选择推导出的默认邮箱集合（去重） */
  const recipientsDefault = useMemo(() => {
    // Get emails from selected IDs
    const fromIds = selectedIds
      .map((id) => swimmers.find((s) => s.id === id))
      .filter((s): s is SwimmerDoc => !!s && !!s.parentEmail)
      .map((s) => s.parentEmail.toLowerCase());
    
    // Get emails from selected levels
    const fromLevels = selectedLevels.length > 0
      ? swimmers
          .filter((s) => s.level && selectedLevels.includes(s.level) && s.parentEmail)
          .map((s) => s.parentEmail.toLowerCase())
      : [];
    
    // Combine and deduplicate
    const allEmails = [...fromIds, ...fromLevels];
    return allEmails.filter((email, idx, self) => self.indexOf(email) === idx);
  }, [selectedIds, selectedLevels, swimmers]);

  /** 当选择变化时，如果用户尚未手动改动过收件人，就同步默认值到可编辑文本 */
  useEffect(() => {
    if (!recipientsDirty) {
      setRecipientsText(recipientsDefault.join(", "));
    }
    // 仅在 default 变化时尝试同步；一旦 dirty，就不再覆盖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientsDefault.join("|"), recipientsDirty]);

  const subjectPreview = useMemo(() => {
    return subject || `Prime Swim Academy — Announcement`;
  }, [subject]);

  const previewHtml = useMemo(() => {
    const innerHtml = contentType === "html" 
      ? content || "<p>(empty)</p>"
      : textToHtml(content);
    return renderBrandedHTML(subjectPreview, innerHtml);
  }, [content, contentType, subjectPreview]);

  // 解析当前可编辑文本为 emails
  const { emails: recipientsParsed, invalid: invalidEmails } = useMemo(
    () => parseEmails(recipientsText),
    [recipientsText]
  );

  const handleSend = async () => {
    try {
      if (!recipientsParsed.length) throw new Error("Please provide at least one recipient email.");
      if (invalidEmails.length) {
        throw new Error(
          `Invalid email(s): ${invalidEmails.join(", ")}`
        );
      }
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
          toEmails: recipientsParsed, // ← 使用可编辑后的解析结果
          subject,
          content,
          contentType, // Use selected content type
          bccAdmin,
          useTemplate: true, // Always use template
        }),
      });

      const j: SendResp = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Send failed");
      updateStatus(`✅ Sent to ${recipientsParsed.length} recipient(s).`, true);
      
      // Reset form after successful send
      setTimeout(() => {
        setStatus("");
        setSuccess(false);
        setSelectedIds([]);
        setRecipientsText("");
        setRecipientsDirty(false);
        setSubject("");
        setContent("");
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStatus("❌ " + msg, false);
    }
  };

  const resetRecipientsToSelection = () => {
    setRecipientsText(recipientsDefault.join(", "));
    setRecipientsDirty(false);
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking permission…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Not authorized (admin only).</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Send Custom Email
          </h1>
          <p className="text-slate-600">Send branded emails to parents - just type your message, we&apos;ll handle the formatting</p>
        </div>

        {status && (
          <Alert 
            variant={success ? "default" : "destructive"}
            className={`mb-6 ${success ? "border-green-200 bg-green-50" : ""}`}
          >
            {success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={success ? "text-green-800" : ""}>
              {status}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Recipients & Subject */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Select Recipients
                </CardTitle>
                <CardDescription>Choose students or enter email addresses directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter by Level */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Level (multi-select)
                  </Label>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="space-y-2">
                      {Object.entries(LEVEL_GROUPS).map(([group, levels]) => (
                        <div key={group} className="space-y-1">
                          <p className="text-xs font-semibold text-slate-700 uppercase">{group}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {levels.map((level) => {
                              const isSelected = selectedLevels.includes(level);
                              return (
                                <div key={level} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`level-${level}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedLevels([...selectedLevels, level]);
                                      } else {
                                        setSelectedLevels(selectedLevels.filter((l) => l !== level));
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`level-${level}`}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    {level.replace(`${group} `, "")}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{selectedLevels.length} level(s) selected</span>
                    {selectedLevels.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedLevels([])}
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-select students */}
                <div className="space-y-2">
                  <Label>Students (multi-select)</Label>
                  <select
                    multiple
                    className="border rounded-lg p-2 h-56 w-full bg-white"
                    value={selectedIds}
                    onChange={(e) =>
                      setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                  >
                    {swimmers
                      .filter((s) => {
                        // If levels are selected, only show swimmers matching those levels
                        if (selectedLevels.length > 0) {
                          return s.level && selectedLevels.includes(s.level);
                        }
                        return true;
                      })
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.swimmerName}
                          {s.level ? ` [${s.level}]` : ""}
                          {s.parentName ? ` — ${s.parentName}` : ""}
                          {s.parentEmail ? `  <${s.parentEmail}>` : ""}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-500">Hold Cmd/Ctrl to select multiple</p>
                  {selectedLevels.length > 0 && (
                    <p className="text-xs text-blue-600">
                      Showing only {selectedLevels.join(", ")} swimmers
                    </p>
                  )}
                </div>

                {/* Recipients (editable) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Recipients ({recipientsParsed.length}
                      {invalidEmails.length ? ` • ${invalidEmails.length} invalid` : ""})
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetRecipientsToSelection}
                      className="text-xs h-auto py-1"
                    >
                      Reset to selection
                    </Button>
                  </div>
                  <Textarea
                    className={invalidEmails.length ? "border-amber-400 bg-amber-50" : ""}
                    placeholder="email1@example.com, email2@example.com (comma/semicolon/newline separated)"
                    value={recipientsText}
                    onChange={(e) => {
                      setRecipientsText(e.target.value);
                      setRecipientsDirty(true);
                    }}
                    rows={4}
                  />
                  {!!invalidEmails.length && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Invalid: {invalidEmails.join(", ")}
                      </AlertDescription>
                    </Alert>
                  )}
                  <p className="text-xs text-slate-500">
                    Tip: You can edit addresses directly. Use commas, semicolons, spaces, or new lines as separators.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Email Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Schedule Update for This Week"
                  />
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Content Type</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contentType"
                          checked={contentType === "text"}
                          onChange={() => setContentType("text")}
                        />
                        <span className="text-sm">Plain Text (with formatting)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contentType"
                          checked={contentType === "html"}
                          onChange={() => setContentType("html")}
                        />
                        <span className="text-sm">HTML</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="bcc-admin"
                      checked={bccAdmin}
                      onCheckedChange={(checked) => setBccAdmin(checked === true)}
                    />
                    <Label htmlFor="bcc-admin" className="text-sm font-normal cursor-pointer">
                      BCC admin (default)
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Content & Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Message Content
                </CardTitle>
                <CardDescription>Type your message in plain text - formatting is automatic</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content">
                    Your Message ({contentType === "text" ? "Plain Text" : "HTML"})
                  </Label>
                  <Textarea
                    id="content"
                    className={`min-h-64 text-base leading-relaxed ${contentType === "html" ? "font-mono" : "font-sans"}`}
                    placeholder={
                      contentType === "text"
                        ? "Type your message here...\n\nYou can use simple formatting:\n• **bold** or __bold__ for bold text\n• *italic* or _italic_ for italic text\n• # Heading for large headings\n• ## Subheading for smaller headings\n• - item or * item for bullet lists\n• URLs are automatically converted to links\n\nDouble line breaks create new paragraphs."
                        : "<p>Type your HTML here...</p>\n<p>Your HTML will be wrapped with PSA template.</p>"
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                  />
                  {contentType === "text" ? (
                    <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg">
                      <p><strong>Formatting Tips:</strong></p>
                      <p>• Double line breaks create new paragraphs</p>
                      <p>• Use <code>**text**</code> for <strong>bold</strong> or <code>__text__</code> for <strong>bold</strong></p>
                      <p>• Use <code>*text*</code> for <em>italic</em> or <code>_text_</code> for <em>italic</em></p>
                      <p>• Use <code># Heading</code> for headings (## for smaller)</p>
                      <p>• Use <code>- item</code> or <code>* item</code> for bullet lists</p>
                      <p>• URLs are automatically converted to links</p>
                      <p>• Your message will be automatically wrapped with PSA branded template</p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 space-y-1 bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p><strong>HTML Mode:</strong></p>
                      <p>• Enter your HTML directly (e.g., &lt;p&gt;Your content&lt;/p&gt;)</p>
                      <p>• Your HTML will be wrapped with PSA branded template</p>
                      <p>• You can use inline CSS styles</p>
                      <p>• Links, images, and other HTML elements are supported</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
                <CardDescription>How your email will look to recipients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe title="preview" className="w-full h-96" srcDoc={previewHtml}></iframe>
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              size="lg"
              className="w-full"
              disabled={!recipientsParsed.length || !subject.trim() || !content.trim() || status.includes("Sending")}
            >
              {status.includes("Sending") ? (
                "Sending..."
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
