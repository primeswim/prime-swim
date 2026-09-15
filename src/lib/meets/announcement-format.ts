export type AnnouncementBlock =
  | { kind: "title"; text: string }
  | { kind: "hosted"; club: string }
  | { kind: "deadline"; text: string }
  | { kind: "warning"; text: string }
  | { kind: "fees"; text: string }
  | { kind: "contact"; role: string; name: string; email?: string }
  | { kind: "update"; text: string }
  | { kind: "paragraph"; text: string };

const ROLE_RE =
  /^(MEET DIRECTORS?|MEET REFEREE|ADMINISTRATIVE OFFICIALS?|ADMIN OFFICIAL|MEET ENTRY CHAIR|SAFETY DIRECTOR)\s*:?\s*(.*)$/i;

function prettyRole(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/Directors\b/i, "Director")
    .replace(/Officials\b/i, "Official");
}

function parsePersonLine(raw: string): { name: string; email?: string } {
  const email = raw.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  const name = raw
    .replace(/[<>()]/g, " ")
    .replace(email || "", "")
    .replace(/\s+/g, " ")
    .trim();
  return { name, email };
}

export function parseAnnouncementBlocks(text: string): AnnouncementBlock[] {
  const lines = (text || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\*+$/.test(line));

  const blocks: AnnouncementBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const role = ROLE_RE.exec(line);
    if (role) {
      let rest = (role[2] || "").trim();
      if (!rest && lines[i + 1] && !ROLE_RE.test(lines[i + 1])) {
        i += 1;
        rest = lines[i];
      }
      const person = parsePersonLine(rest);
      if (person.name || person.email) {
        blocks.push({ kind: "contact", role: prettyRole(role[1]), name: person.name, email: person.email });
      }
      continue;
    }
    if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(line) && /posted|updated|file/i.test(line)) {
      blocks.push({ kind: "update", text: line });
      continue;
    }
    blocks.push(classifyAnnouncementLine(line));
  }
  return blocks;
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
