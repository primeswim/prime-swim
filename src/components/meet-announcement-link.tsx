"use client";

export function MeetAnnouncementLink({
  url,
  className = "text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900",
  children = "Open meet announcement",
}: {
  url?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}
