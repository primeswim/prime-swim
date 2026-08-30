"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/tuition-v2/plan", label: "Monthly Plan" },
  { href: "/admin/tuition-v2/review", label: "Tuition Review" },
  { href: "/admin/tuition-v2/email", label: "Email" },
] as const;

export function TuitionV2HubNav({ month }: { month: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        const q = `${href}?month=${encodeURIComponent(month)}`;
        return (
          <Link
            key={href}
            href={q}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
      <span className="text-xs text-muted-foreground self-center ml-auto">V2 Beta — V1 unchanged</span>
    </nav>
  );
}

export function useV2MonthFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("month") || "";
}
