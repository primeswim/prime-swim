export const PNS_CALENDAR_URL = "https://www.pns.org/page/calendar";
export const PNS_TEAM_ALIAS = "pnws2";

/** TeamUnify source keys look like `pns-1747094`. */
export function pnsEventNumericId(sourceKey?: string): string | null {
  const match = String(sourceKey || "").match(/^pns-(\d+)$/i);
  return match ? match[1] : null;
}

/** Per-event PNS page with announcement + event files; calendar if we only have a title. */
export function pnsEventPageUrl(sourceKey?: string): string {
  const id = pnsEventNumericId(sourceKey);
  if (id) return `https://www.pns.org/EventShow.jsp?id=${id}&team=${PNS_TEAM_ALIAS}`;
  return `${PNS_CALENDAR_URL}#/team-events/upcoming`;
}

/** True PDF / file URL families can open. Calendar and EventShow pages are not the announcement. */
export function isMeetAnnouncementUrl(url?: string): boolean {
  if (!url || !/^https?:\/\//i.test(url.trim())) return false;
  const value = url.trim();
  if (/pns\.org\/page\/calendar/i.test(value)) return false;
  if (/EventShow\.jsp/i.test(value)) return false;
  return true;
}

export function meetAnnouncementUrl(meet: {
  announcementUrl?: string;
  sourceFiles?: Array<{ url: string; kind?: string; name?: string }>;
}): string | undefined {
  const files = meet.sourceFiles || [];
  const fromFiles =
    files.find((file) => file.kind === "announcement") ||
    files.find((file) => /\.pdf(\b|$)/i.test(`${file.name || ""} ${file.url}`));
  for (const url of [fromFiles?.url, meet.announcementUrl]) {
    if (isMeetAnnouncementUrl(url)) return url;
  }
  return undefined;
}
