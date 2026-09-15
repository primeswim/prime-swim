import type { PnsScanResult } from "./service";

export function pnsScanNeedsAdminAlert(stats: Pick<PnsScanResult, "created" | "updated">): boolean {
  return stats.created > 0 || stats.updated > 0;
}

export function composePnsAdminAlert(stats: PnsScanResult, adminMeetsUrl: string) {
  const subject =
    stats.created && stats.updated
      ? `PNS update: ${stats.created} new meet(s), ${stats.updated} changed`
      : stats.created
        ? `PNS update: ${stats.created} new meet(s) to review`
        : `PNS update: ${stats.updated} existing meet(s) changed`;

  const lines: string[] = [
    "The daily PNS calendar scan found something that needs admin review.",
    "Families do not see these changes until you Accept / Publish.",
    "",
  ];
  if (stats.createdMeets.length) {
    lines.push("New drafts:");
    for (const meet of stats.createdMeets.slice(0, 20)) {
      lines.push(`- ${meet.name}`);
    }
    if (stats.createdMeets.length > 20) lines.push(`- …and ${stats.createdMeets.length - 20} more`);
    lines.push("");
  }
  if (stats.updatedMeets.length) {
    lines.push("Updates on meets we already have:");
    for (const meet of stats.updatedMeets.slice(0, 20)) {
      const detail = meet.diffs.length ? ` (${meet.diffs.slice(0, 3).join("; ")})` : "";
      lines.push(`- ${meet.name}${detail}`);
    }
    if (stats.updatedMeets.length > 20) lines.push(`- …and ${stats.updatedMeets.length - 20} more`);
    lines.push("");
  }
  lines.push(`Open Admin Meets: ${adminMeetsUrl}`);
  return { subject, text: lines.join("\n") };
}

export function adminAlertRecipients(): string[] {
  const extra = (process.env.ADMIN_ALLOW_EMAILS || "prime.swim.us@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(["prime.swim.us@gmail.com", ...extra])];
}
