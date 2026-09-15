"use client";

import { pnsEventNumericId, pnsEventPageUrl } from "@/lib/meets/pns-url";

export function PnsMeetLink({
  sourceKey,
  className = "text-sm text-blue-700 underline",
}: {
  sourceKey?: string;
  className?: string;
}) {
  return (
    <a
      href={pnsEventPageUrl(sourceKey)}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(event) => event.stopPropagation()}
    >
      {pnsEventNumericId(sourceKey) ? "View on PNS" : "View PNS calendar"}
    </a>
  );
}
