import { cn } from "@/lib/utils";
import { meetDateStamp } from "@/lib/meets/sessions";

export function MeetDateStamp({
  startDate,
  endDate,
  className,
}: {
  startDate: string;
  endDate?: string;
  className?: string;
}) {
  const stamp = meetDateStamp(startDate, endDate);
  return (
    <div
      className={cn(
        "w-[4.35rem] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm",
        className
      )}
    >
      <div className="bg-slate-800 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
        {stamp.month || "TBD"}
      </div>
      <div className="px-1 py-1.5">
        <div className="text-[1.7rem] font-bold leading-none text-amber-600 tabular-nums">{stamp.day}</div>
        {stamp.endDay && <div className="mt-0.5 text-[11px] font-semibold text-slate-500">–{stamp.endDay}</div>}
        {stamp.year && <div className="mt-0.5 text-[10px] text-slate-400">{stamp.year}</div>}
      </div>
    </div>
  );
}
