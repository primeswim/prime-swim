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
