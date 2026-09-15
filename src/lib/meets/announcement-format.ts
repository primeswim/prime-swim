export type AnnouncementBlock =
  | { kind: "title"; text: string }
  | { kind: "hosted"; club: string }
  | { kind: "deadline"; text: string }
  | { kind: "warning"; text: string }
  | { kind: "fees"; text: string }
  | { kind: "paragraph"; text: string };

export function parseAnnouncementBlocks(text: string): AnnouncementBlock[] {
  return (text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => classifyAnnouncementLine(line));
}

export function classifyAnnouncementLine(line: string): AnnouncementBlock {
  const hosted = line.match(/^hosted by\s+(.+)/i);
  if (hosted) return { kind: "hosted", club: hosted[1].replace(/\.$/, "").trim() };

  if (/deadline/i.test(line)) return { kind: "deadline", text: line };
  if (/invitational|without an invitation/i.test(line)) return { kind: "warning", text: line };
  if (/surcharge|entry fees?|individual event/i.test(line) && /\$/.test(line)) {
    return { kind: "fees", text: line };
  }
  if (/approval\s*#|pentathlon|championship|open age/i.test(line) && line.length < 120) {
    return { kind: "title", text: line };
  }
  return { kind: "paragraph", text: line };
}

