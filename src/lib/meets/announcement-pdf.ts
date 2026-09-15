import { extractFeeHints } from "./fees";

const SKIP_PDF_HOSTS = /(^|\.)example\.test$|^localhost$|^127\.0\.0\.1$/i;

export async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const data = bytes instanceof Buffer ? new Uint8Array(bytes) : bytes;
  const result = await extractText(data, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text || "");
  return text.replace(/\u0000/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

export async function fetchAnnouncementPdfText(url: string, opts?: { timeoutMs?: number }): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "PrimeSwimMeetBot/1.0",
        accept: "application/pdf,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Announcement PDF HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 5 || buf[0] !== 0x25 || buf[1] !== 0x50) {
      throw new Error("Announcement file is not a PDF.");
    }
    return extractTextFromPdfBytes(buf);
  } finally {
    clearTimeout(timer);
  }
}

function shouldFetchAnnouncementPdf(url?: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    return !SKIP_PDF_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function enrichCalendarItemWithAnnouncementFees<
  T extends {
    announcementText?: string;
    announcementUrl?: string;
    surcharge?: number;
    individualEventFee?: number;
  },
>(item: T): Promise<T> {
  const fromNotes = extractFeeHints(item.announcementText || "");
  let surcharge = item.surcharge ?? fromNotes.surcharge;
  let individualEventFee = item.individualEventFee ?? fromNotes.individualEventFee;
  if ((surcharge == null || individualEventFee == null) && shouldFetchAnnouncementPdf(item.announcementUrl)) {
    try {
      const pdfText = await fetchAnnouncementPdfText(item.announcementUrl!);
      const fromPdf = extractFeeHints(pdfText);
      surcharge = surcharge ?? fromPdf.surcharge;
      individualEventFee = individualEventFee ?? fromPdf.individualEventFee;
    } catch {
      // Calendar notes stay; admin can type fees on review.
    }
  }
  return { ...item, surcharge, individualEventFee };
}

/** Tiny uncompressed PDF for tests. */
export function sampleEntryFeeAnnouncementPdf(): Uint8Array {
  const line = "ENTRY FEES: Surcharge: $25.00 Individual Event: $4.50";
  const stream = `BT /F1 12 Tf 50 700 Td (${line}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `${xref}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, "latin1");
}
