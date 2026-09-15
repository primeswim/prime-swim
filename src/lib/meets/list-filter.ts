import { pacificYmd } from "./deadlines";
import type { Meet } from "./types";
import { isPrePublishStatus } from "./workflow";

export type AdminMeetListFilter = "needs_review" | "has_updates" | "upcoming" | "in_process" | "past";

export function meetStartYmd(meet: Pick<Meet, "startDate" | "endDate">): string {
  return (meet.startDate || meet.endDate || "").slice(0, 10);
}

export function meetEndYmd(meet: Pick<Meet, "startDate" | "endDate">): string {
  return (meet.endDate || meet.startDate || "").slice(0, 10);
}

/** Exclusive buckets: review queue, upcoming, in process, past archive. */
export function classifyAdminMeetList(
  meet: Pick<Meet, "startDate" | "endDate" | "status">,
  todayYmd: string
): AdminMeetListFilter {
  if (meet.status === "cancelled" || meet.status === "completed") return "past";
  if (isPrePublishStatus(meet.status)) return "needs_review";
  const start = meetStartYmd(meet);
  const end = meetEndYmd(meet);
  if (end && end < todayYmd) return "past";
  if (start && start <= todayYmd && (!end || end >= todayYmd)) return "in_process";
  return "upcoming";
}

type DatedMeet = Pick<Meet, "startDate" | "endDate" | "status" | "name"> &
  Partial<Pick<Meet, "pendingSourceReview" | "pendingSourceDiffs">>;

export function meetHasPnsUpdate(meet: Partial<Pick<Meet, "pendingSourceReview">>): boolean {
  return meet.pendingSourceReview === true;
}

export function filterAdminMeetList<T extends DatedMeet>(
  meets: T[],
  filter: AdminMeetListFilter,
  todayYmd = pacificYmd()
): T[] {
  const rows =
    filter === "has_updates"
      ? meets.filter((meet) => meetHasPnsUpdate(meet))
      : meets.filter((meet) => classifyAdminMeetList(meet, todayYmd) === filter);
  rows.sort((a, b) => {
    const sa = meetStartYmd(a) || "9999-99-99";
    const sb = meetStartYmd(b) || "9999-99-99";
    if (filter === "past") return `${sb}${b.name}`.localeCompare(`${sa}${a.name}`);
    return `${sa}${a.name}`.localeCompare(`${sb}${b.name}`);
  });
  return rows;
}

export function countAdminMeetList(meets: DatedMeet[], todayYmd = pacificYmd()) {
  return {
    needs_review: filterAdminMeetList(meets, "needs_review", todayYmd).length,
    has_updates: filterAdminMeetList(meets, "has_updates", todayYmd).length,
    upcoming: filterAdminMeetList(meets, "upcoming", todayYmd).length,
    in_process: filterAdminMeetList(meets, "in_process", todayYmd).length,
    past: filterAdminMeetList(meets, "past", todayYmd).length,
  };
}
