export type CalendarWhen = "upcoming" | "now" | "past";
export type CalendarKind = "all" | "meet" | "event";

export function classifyCalendarWhen(startDate?: string, endDate?: string, todayYmd = ""): CalendarWhen {
  const start = (startDate || endDate || "").slice(0, 10);
  const end = (endDate || startDate || "").slice(0, 10);
  if (end && todayYmd && end < todayYmd) return "past";
  if (start && todayYmd && start <= todayYmd && (!end || end >= todayYmd)) return "now";
  return "upcoming";
}
