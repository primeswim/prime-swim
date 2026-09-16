import { inferEligibilityStatus, inferInvitationStatus, extractEligibilityNotes } from "./eligibility";
import { effectiveHostDeadline, pacificYmd, suggestPrimeDeadline } from "./deadlines";
import { extractFeeHints } from "./fees";
import { enrichCalendarItemWithAnnouncementFees } from "./announcement-pdf";
import { markTestName } from "./test-data";
import { isPrePublishStatus } from "./workflow";
import { newMeetId, type Meet, type PendingSourcePatch, type PnsSourceFile } from "./types";
import { PNS_CALENDAR_URL, PNS_TEAM_ALIAS, pnsEventPageUrl } from "./pns-url";

export { PNS_CALENDAR_URL, PNS_TEAM_ALIAS, pnsEventPageUrl } from "./pns-url";

export interface PnsCalendarItem {
  sourceId: string;
  name: string;
  hostClub: string;
  startDate: string;
  endDate: string;
  location: string;
  announcementUrl?: string;
  announcementText?: string;
  registrationDeadline?: string;
  hostEntryEmail?: string;
  sanctionNumber?: string;
  sourceFiles?: PnsSourceFile[];
  eventFileUrl?: string;
  surcharge?: number;
  individualEventFee?: number;
}

const TITLE_RE = /<h[23][^>]*>([^<]+)<\/h[23]>/gi;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/g;
const PNS_HEADERS = {
  "user-agent": "PrimeSwimMeetBot/1.0",
  "x-tu-team": PNS_TEAM_ALIAS,
  accept: "application/json, text/plain, */*",
  "content-type": "application/json;charset=utf-8",
  referer: `${PNS_CALENDAR_URL}#/team-events/upcoming`,
};

type TuField = { value?: unknown; displayValue?: unknown; displayValueISO?: string } | unknown;

function tuValue(field: TuField): unknown {
  if (field && typeof field === "object" && "value" in field) return (field as { value?: unknown }).value;
  return field;
}

function tuIsoDate(field: TuField): string {
  if (field && typeof field === "object") {
    const row = field as { displayValueISO?: string; value?: unknown };
    if (row.displayValueISO) return String(row.displayValueISO).slice(0, 10);
    if (typeof row.value === "string") return row.value.slice(0, 10);
  }
  if (typeof field === "string") return field.slice(0, 10);
  return "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&bull;/gi, "•")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function inferHostClubFromTitle(name: string): string {
  const cleaned = name.replace(/^\d{4}\s+/, "").trim();
  const match = /^PN\s+([A-Z]{2,6})\b/.exec(cleaned) || /^(?!PN\b)([A-Z]{2,6})\b/.exec(cleaned);
  return match?.[1] || "";
}

export function extractSanctionNumber(name: string): string | undefined {
  const match = /#\s*([0-9]{4}-[A-Z]{2}[0-9]+)/i.exec(name);
  return match?.[1]?.toUpperCase();
}

export function firstHostEmail(text: string): string | undefined {
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0]);
  return emails.find((email) => !/office@pns\.org/i.test(email)) || emails[0];
}

function absolutePnsUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `https://www.pns.org${path.startsWith("/") ? "" : "/"}${path}`;
}

export function classifyPnsFile(name: string, url: string): PnsSourceFile["kind"] {
  const n = `${name} ${url}`.toLowerCase();
  if (/\.(hyv|ev3|zip)(\b|$)/i.test(n)) return "event_file";
  if (/\.pdf(\b|$)/i.test(n) || /announcement/i.test(n)) return "announcement";
  return "other";
}

export function mapPnsDocuments(docs: Array<{ name?: string; url?: string }>): PnsSourceFile[] {
  const files: PnsSourceFile[] = [];
  for (const doc of docs) {
    if (!doc.url) continue;
    const url = absolutePnsUrl(doc.url);
    const name = (doc.name || url.split("/").pop() || "PNS file").trim();
    files.push({ name, url, kind: classifyPnsFile(name, url) });
  }
  return files;
}

function firstFileUrl(files: PnsSourceFile[] | undefined, kind: PnsSourceFile["kind"]): string | undefined {
  return files?.find((f) => f.kind === kind)?.url;
}

function firstPdfHref(html: string): string | undefined {
  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((match) => match[1]);
  const hit = hrefs.find((href) => /\.pdf(\b|$)/i.test(href) || /announcement/i.test(href));
  return hit ? absolutePnsUrl(hit) : undefined;
}

export function mapTeamUnifyListRow(row: Record<string, unknown>): PnsCalendarItem {
  const id = String(tuValue(row.id) ?? "").trim();
  const name = String(tuValue(row.title) ?? "").replace(/\s+/g, " ").trim();
  const startDate = tuIsoDate(row.startDate);
  const endDate = tuIsoDate(row.endDate) || startDate;
  return {
    sourceId: id ? `pns-${id}` : `pns-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${startDate}`,
    name,
    hostClub: inferHostClubFromTitle(name),
    startDate,
    endDate,
    location: String(tuValue(row.location) ?? "").replace(/\s+/g, " ").trim(),
    announcementText: htmlToText(String(tuValue(row.meetDescription) ?? "")),
    sanctionNumber: extractSanctionNumber(name),
  };
}

export function applyTeamUnifyDetail(item: PnsCalendarItem, detail: Record<string, unknown>): PnsCalendarItem {
  const docs = Array.isArray(detail.eventDocuments) ? (detail.eventDocuments as Array<{ name?: string; url?: string }>) : [];
  const sourceFiles = mapPnsDocuments(docs);
  const descriptionHtml = String(detail.eventDescription || "");
  const announcementText = htmlToText(descriptionHtml) || item.announcementText;
  const deadline = typeof detail.registrationDeadline === "string" ? detail.registrationDeadline.slice(0, 10) : item.registrationDeadline;
  const startDate = typeof detail.startDateTime === "string" ? detail.startDateTime.slice(0, 10) : item.startDate;
  const endDate = typeof detail.endDateTime === "string" ? detail.endDateTime.slice(0, 10) : item.endDate;
  return {
    ...item,
    name: String(detail.eventTitle || item.name).replace(/\s+/g, " ").trim(),
    startDate: startDate || item.startDate,
    endDate: endDate || item.endDate,
    location: String(detail.location || item.location).replace(/\s+/g, " ").trim(),
    announcementText,
    announcementUrl: firstFileUrl(sourceFiles, "announcement") || firstPdfHref(descriptionHtml) || item.announcementUrl,
    eventFileUrl: firstFileUrl(sourceFiles, "event_file") || item.eventFileUrl,
    sourceFiles: sourceFiles.length ? sourceFiles : item.sourceFiles,
    registrationDeadline: deadline,
    hostEntryEmail: firstHostEmail(descriptionHtml) || firstHostEmail(announcementText || "") || item.hostEntryEmail,
    sanctionNumber: item.sanctionNumber || extractSanctionNumber(String(detail.eventTitle || item.name)),
    hostClub: item.hostClub || inferHostClubFromTitle(String(detail.eventTitle || item.name)),
  };
}

/** Best-effort scrape of a SportsEngine / PNS calendar HTML dump. */
export function parsePnsCalendarHtml(html: string): PnsCalendarItem[] {
  const items: PnsCalendarItem[] = [];
  const blocks = html.includes("<article")
    ? html.split(/<article\b/i)
    : html.split(/class="[^"]*event[^"]*"/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].slice(0, 4000);
    const titleMatch = /(?:title|event-name)[^>]*>([^<]{6,120})</i.exec(block) || /<h[23][^>]*>([^<]{6,120})</i.exec(block);
    const name = (titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const dates = [...block.matchAll(DATE_RE)].map((m) => m[1]);
    const startDate = dates[0] || "";
    const endDate = dates[1] || startDate;
    const loc = /location[^>]*>([^<]+)</i.exec(block)?.[1]?.trim() || "";
    const pdf = /href="([^"]+\.pdf)"/i.exec(block)?.[1];
    items.push({
      sourceId: `pns-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${startDate}`,
      name,
      hostClub: inferHostClubFromTitle(name) || /hosted by ([^.<]+)/i.exec(block)?.[1]?.trim() || "",
      startDate,
      endDate,
      location: loc,
      announcementUrl: pdf,
      announcementText: block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 2000),
    });
  }
  if (!items.length) {
    const titles = [...html.matchAll(TITLE_RE)].map((m) => m[1].trim()).filter((t) => t.length > 8);
    titles.forEach((name, idx) => {
      items.push({
        sourceId: `pns-title-${idx}`,
        name,
        hostClub: inferHostClubFromTitle(name),
        startDate: "",
        endDate: "",
        location: "",
      });
    });
  }
  return items;
}

export function calendarItemToDraftMeet(item: PnsCalendarItem, opts: { isTestData: boolean }): Meet {
  const announcementText = `${item.name}\n${item.announcementText || ""}`.trim();
  const invitationStatus = inferInvitationStatus(announcementText);
  const hostDeadline = item.registrationDeadline;
  const name = opts.isTestData ? markTestName(item.name) : item.name;
  const hints = extractFeeHints(item.announcementText || "");
  return {
    id: newMeetId(),
    sourceKey: item.sourceId,
    name,
    hostClub: item.hostClub,
    meetType: invitationStatus === "not_required" ? "open" : "invitational",
    course: "unknown",
    startDate: item.startDate,
    endDate: item.endDate || item.startDate,
    location: item.location,
    sanctionNumber: item.sanctionNumber,
    announcementUrl: item.announcementUrl,
    announcementText: item.announcementText,
    eventFileUrl: item.eventFileUrl,
    sourceFiles: item.sourceFiles,
    sourceUrl: pnsEventPageUrl(item.sourceId),
    eligibilityStatus: inferEligibilityStatus(announcementText),
    invitationStatus,
    eligibilityNotes: extractEligibilityNotes(announcementText),
    pnsPublishedDeadline: hostDeadline,
    announcementEntryDeadline: hostDeadline,
    effectiveHostDeadline: effectiveHostDeadline({ pnsPublishedDeadline: hostDeadline }),
    primeCommitmentDeadline: suggestPrimeDeadline(hostDeadline),
    deadlineTimezone: "America/Los_Angeles",
    hostEntryEmail: item.hostEntryEmail,
    surcharge: item.surcharge ?? hints.surcharge,
    individualEventFee: item.individualEventFee ?? hints.individualEventFee,
    maxEventsMeet: hints.maxEventsMeet,
    maxEventsBySession: hints.maxEventsBySession,
    status: invitationStatus === "not_required" ? "admin_review" : "invitation_pending",
    sessions: [],
    events: [],
    isTestData: opts.isTestData,
  };
}

async function pnsJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...PNS_HEADERS, ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PNS ${url} HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

export async function fetchLivePnsCalendar(opts?: { todayYmd?: string }): Promise<PnsCalendarItem[]> {
  const today = opts?.todayYmd || pacificYmd();
  const rows = await pnsJson<Record<string, unknown>[]>("https://www.pns.org/rest/teamevent/rawData", {
    method: "POST",
    body: JSON.stringify({ isPastMeet: false, isDeletedMeet: false, timezone: "America/Los_Angeles" }),
  });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("PNS calendar API returned no team events.");
  }
  const listed = rows
    .map((row) => mapTeamUnifyListRow(row))
    .filter((item) => {
      const end = (item.endDate || item.startDate || "").slice(0, 10);
      return !end || end >= today;
    });
  return mapPool(listed, 6, async (item) => {
    const id = item.sourceId.replace(/^pns-/, "");
    if (/^\d+$/.test(id)) {
      try {
        const detail = await pnsJson<Record<string, unknown>>(`https://www.pns.org/rest/ondeck/v2/meet/getInstance/${id}`);
        item = applyTeamUnifyDetail(item, detail);
      } catch {
        // Keep the calendar row if the per-meet detail call fails.
      }
    }
    return enrichCalendarItemWithAnnouncementFees(item);
  });
}

function fileSignature(files?: PnsSourceFile[]): string {
  return (files || [])
    .map((f) => `${f.kind}:${f.url}`)
    .sort()
    .join("|");
}

function applyOrStash<K extends keyof PendingSourcePatch>(
  applyNow: boolean,
  next: Meet,
  patch: PendingSourcePatch,
  key: K,
  value: PendingSourcePatch[K]
) {
  if (applyNow) {
    (next as unknown as Record<string, unknown>)[key] = value;
  } else {
    patch[key] = value;
  }
}

function mergeAnnouncementFee(
  existing: Meet,
  incoming: PnsCalendarItem,
  next: Meet,
  patch: PendingSourcePatch,
  diffs: string[],
  field: "surcharge" | "individualEventFee",
  label: string
) {
  const incomingVal = incoming[field];
  if (incomingVal == null || !Number.isFinite(incomingVal)) return;
  const existingVal = Number(existing[field]);
  if (!(existingVal > 0)) {
    next[field] = incomingVal;
    diffs.push(`${label} from announcement: $${incomingVal}`);
    delete patch[field];
    return;
  }
  if (existingVal !== incomingVal) {
    diffs.push(`${label} $${existingVal} → $${incomingVal}`);
    applyOrStash(false, next, patch, field, incomingVal);
    return;
  }
  delete patch[field];
}

export function mergePnsUpdates(existing: Meet, incoming: PnsCalendarItem): { changed: boolean; next: Meet; diffs: string[] } {
  const diffs: string[] = [];
  const next = { ...existing };
  const patch: PendingSourcePatch = { ...(existing.pendingSourcePatch || {}) };
  const applyNow = isPrePublishStatus(existing.status);

  if (incoming.startDate && incoming.startDate !== existing.startDate) {
    diffs.push(`startDate ${existing.startDate} → ${incoming.startDate}`);
    applyOrStash(applyNow, next, patch, "startDate", incoming.startDate);
  }
  if (incoming.endDate && incoming.endDate !== existing.endDate) {
    diffs.push(`endDate ${existing.endDate} → ${incoming.endDate}`);
    applyOrStash(applyNow, next, patch, "endDate", incoming.endDate);
  }
  if (incoming.location && incoming.location !== existing.location) {
    diffs.push("location changed");
    applyOrStash(applyNow, next, patch, "location", incoming.location);
  }
  if (incoming.hostClub && incoming.hostClub !== existing.hostClub) {
    diffs.push(`host ${existing.hostClub || "unknown"} → ${incoming.hostClub}`);
    applyOrStash(applyNow, next, patch, "hostClub", incoming.hostClub);
  }
  if (incoming.registrationDeadline && incoming.registrationDeadline !== existing.pnsPublishedDeadline) {
    diffs.push(`pns deadline ${existing.pnsPublishedDeadline || "none"} → ${incoming.registrationDeadline}`);
    applyOrStash(applyNow, next, patch, "pnsPublishedDeadline", incoming.registrationDeadline);
  }
  if (incoming.announcementUrl && incoming.announcementUrl !== existing.announcementUrl) {
    diffs.push(existing.announcementUrl ? "announcement PDF changed" : "announcement PDF posted");
    applyOrStash(applyNow, next, patch, "announcementUrl", incoming.announcementUrl);
  }
  if (incoming.announcementText && incoming.announcementText !== existing.announcementText) {
    diffs.push("announcement notes changed");
    applyOrStash(applyNow, next, patch, "announcementText", incoming.announcementText);
  }
  if (incoming.hostEntryEmail && incoming.hostEntryEmail !== existing.hostEntryEmail) {
    diffs.push("host email changed");
    applyOrStash(applyNow, next, patch, "hostEntryEmail", incoming.hostEntryEmail);
  }
  if (incoming.eventFileUrl && incoming.eventFileUrl !== existing.eventFileUrl) {
    diffs.push(existing.eventFileUrl ? "event file (.hyv / .ev3) changed" : "event file (.hyv / .ev3) posted on PNS");
    applyOrStash(applyNow, next, patch, "eventFileUrl", incoming.eventFileUrl);
  }
  if (incoming.sourceFiles?.length && fileSignature(incoming.sourceFiles) !== fileSignature(existing.sourceFiles)) {
    const known = new Set((existing.sourceFiles || []).map((f) => f.url));
    for (const file of incoming.sourceFiles) {
      if (!known.has(file.url)) diffs.push(`new PNS file: ${file.name}`);
    }
    applyOrStash(applyNow, next, patch, "sourceFiles", incoming.sourceFiles);
  }

  mergeAnnouncementFee(existing, incoming, next, patch, diffs, "surcharge", "surcharge");
  mergeAnnouncementFee(existing, incoming, next, patch, diffs, "individualEventFee", "individual event fee");

  if (applyNow) {
    const feePatch: PendingSourcePatch = {};
    if (patch.surcharge != null) feePatch.surcharge = patch.surcharge;
    if (patch.individualEventFee != null) feePatch.individualEventFee = patch.individualEventFee;
    next.pendingSourcePatch = Object.keys(feePatch).length ? feePatch : undefined;
  } else {
    next.pendingSourcePatch = Object.keys(patch).length ? patch : undefined;
  }
  return { changed: diffs.length > 0, next, diffs };
}

export function pnsDiffsChangeFamilySchedule(diffs: string[]): boolean {
  return diffs.some((d) => /startDate|endDate|location|host /i.test(d));
}

export function pnsDatesChanged(diffs: string[]): boolean {
  return diffs.some((d) => /startDate|endDate/i.test(d));
}

export function parentBannerForDayReselection(): string {
  return "The host changed this meet’s dates. Choose the days you can attend, then tap Attend again.";
}

export function parentBannerForPnsDiffs(diffs: string[]): string | undefined {
  if (!pnsDatesChanged(diffs)) return undefined;
  return parentBannerForDayReselection();
}

export function applyPendingSourcePatch(meet: Meet): Meet {
  const patch = meet.pendingSourcePatch;
  if (!patch) return { ...meet, pendingSourceReview: false, pendingSourceDiffs: [], pendingSourcePatch: undefined };
  return {
    ...meet,
    startDate: patch.startDate || meet.startDate,
    endDate: patch.endDate || meet.endDate,
    location: patch.location || meet.location,
    hostClub: patch.hostClub || meet.hostClub,
    pnsPublishedDeadline: patch.pnsPublishedDeadline || meet.pnsPublishedDeadline,
    announcementUrl: patch.announcementUrl || meet.announcementUrl,
    announcementText: patch.announcementText || meet.announcementText,
    hostEntryEmail: patch.hostEntryEmail || meet.hostEntryEmail,
    eventFileUrl: patch.eventFileUrl || meet.eventFileUrl,
    sourceFiles: patch.sourceFiles || meet.sourceFiles,
    surcharge: patch.surcharge != null ? patch.surcharge : meet.surcharge,
    individualEventFee: patch.individualEventFee != null ? patch.individualEventFee : meet.individualEventFee,
    pendingSourceReview: false,
    pendingSourceDiffs: [],
    pendingSourcePatch: undefined,
  };
}
