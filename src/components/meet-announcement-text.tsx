import { parseAnnouncementBlocks, type AnnouncementBlock } from "@/lib/meets/announcement-format";
import { displayMeetName } from "@/lib/meets/display-name";

export function MeetAnnouncementText({
  text,
  hostClub,
  meetName,
}: {
  text: string;
  hostClub?: string;
  meetName?: string;
}) {
  const blocks = parseAnnouncementBlocks(text);
  const skipTitle = displayMeetName(meetName || "").toLowerCase();
  const visible = blocks.filter((block) => !shouldHideBlock(block, skipTitle));
  const contacts = visible.filter((block): block is Extract<AnnouncementBlock, { kind: "contact" }> => block.kind === "contact");
  const updates = visible.filter((block): block is Extract<AnnouncementBlock, { kind: "update" }> => block.kind === "update");
  const rest = visible.filter((block) => block.kind !== "contact" && block.kind !== "update");

  return (
    <div className="space-y-4">
      {contacts.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {contacts.map((block, i) => (
            <div key={`${block.role}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{block.role}</div>
              <div className="mt-0.5 text-sm font-medium text-slate-800">{block.name || "—"}</div>
              {block.email && (
                <a href={`mailto:${block.email}`} className="text-xs text-slate-700 underline underline-offset-2 break-all">
                  {block.email}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="text-[13px] leading-6 text-slate-700 space-y-2">
          {rest.map((block, i) => {
            const key = `${block.kind}-${i}`;
            if (block.kind === "hosted") {
              return (
                <p key={key} className="text-slate-600">
                  Hosted by <strong className="text-slate-800">{block.club}</strong>
                </p>
              );
            }
            const raw = "text" in block ? block.text : "";
            const tone =
              block.kind === "warning"
                ? "rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-amber-950"
                : block.kind === "deadline"
                  ? "rounded-lg bg-amber-50/80 border border-amber-100 px-3 py-2 text-amber-950"
                  : block.kind === "fees"
                    ? "rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                    : block.kind === "title"
                      ? "font-medium text-slate-900"
                      : undefined;
            return (
              <p key={key} className={tone}>
                <Emphasized text={raw} hostClub={hostClub} />
              </p>
            );
          })}
        </div>
      )}

      {updates.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Posted on PNS</div>
          <ul className="space-y-1">
            {updates.map((block, i) => (
              <li key={`${block.text}-${i}`} className="text-xs text-slate-500">
                {block.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function shouldHideBlock(block: AnnouncementBlock, skipTitle: string): boolean {
  const raw = "text" in block ? block.text : block.kind === "hosted" ? block.club : "";
  const lower = raw.toLowerCase();
  if (/^pacific northwest swimming\.?$/.test(lower)) return true;
  if (skipTitle && (lower === skipTitle || displayMeetName(raw).toLowerCase() === skipTitle)) return true;
  return false;
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
            <a key={`${part.text}-${i}`} href={part.href} className="text-slate-800 underline underline-offset-2">
              {part.text}
            </a>
          );
        }
        return part.strong ? <strong key={`${part.text}-${i}`}>{part.text}</strong> : <span key={`${part.text}-${i}`}>{part.text}</span>;
      })}
    </>
  );
}
