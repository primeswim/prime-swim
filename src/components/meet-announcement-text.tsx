import { parseAnnouncementBlocks } from "@/lib/meets/announcement-format";

export function MeetAnnouncementText({ text, hostClub }: { text: string; hostClub?: string }) {
  const blocks = parseAnnouncementBlocks(text);
  return (
    <div className="text-[13px] leading-5 text-slate-700 space-y-1">
      {blocks.map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === "hosted") {
          return (
            <p key={key}>
              Hosted by <strong>{block.club}</strong>
            </p>
          );
        }
        const raw = "text" in block ? block.text : "";
        return (
          <p key={key} className={block.kind === "title" ? "font-medium text-slate-900" : undefined}>
            <Emphasized text={raw} hostClub={hostClub} />
          </p>
        );
      })}
    </div>
  );
}

function Emphasized({ text, hostClub }: { text: string; hostClub?: string }) {
  const pieces: Array<{ text: string; strong?: boolean; href?: string }> = [];
  const club = hostClub ? hostClub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  const re = new RegExp(
    `(hosted by\\s+)([^\\n.]+)|\\b(THIS MEET IS AN INVITATIONAL\\.?)\\b|\\b(USA Swimming)\\b|\\b(Pacific Northwest Swimming)\\b|\\b(Article 302)\\b|(MEET ENTRY DEADLINE:[^\\n]+)|(\\$\\d+(?:\\.\\d{2})?)|([\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,})${club ? `|\\b(${club})\\b` : ""}`,
    "gi"
  );
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) pieces.push({ text: text.slice(last, match.index) });
    if (match[1] && match[2]) {
      pieces.push({ text: match[1] });
      pieces.push({ text: match[2], strong: true });
    } else if (match[9]) {
      pieces.push({ text: match[9], href: `mailto:${match[9]}` });
    } else {
      pieces.push({ text: match[0], strong: true });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last) });
  if (!pieces.length) return <>{text}</>;
  return (
    <>
      {pieces.map((part, i) => {
        if (part.href) {
          return (
            <a key={`${part.text}-${i}`} href={part.href} className="text-blue-700 underline">
              {part.text}
            </a>
          );
        }
        return part.strong ? <strong key={`${part.text}-${i}`}>{part.text}</strong> : <span key={`${part.text}-${i}`}>{part.text}</span>;
      })}
    </>
  );
}
