// src/lib/membership.ts
export type MembershipStatus = "active" | "due_soon" | "grace" | "inactive";

export const RENEWAL_WINDOW_DAYS = 30;
export const GRACE_DAYS = 30;
export const DEFAULT_AMOUNT_CENTS = 7500;

export const toMidnightLocal = (d: Date) => {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
};

export const addYearsMinusOneDay = (start: Date, years = 1) => {
  const s = new Date(start);
  const end = new Date(s);
  end.setFullYear(s.getFullYear() + years);
  end.setDate(end.getDate() - 1);
  return end;
};

export interface SwimDates {
  registrationAnchorDate?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextDueDate?: Date | null;
}

export function deriveCoverageFromAnchor(anchor: Date) {
  const currentPeriodStart = toMidnightLocal(anchor);
  const currentPeriodEnd = addYearsMinusOneDay(currentPeriodStart, 1);
  const nextDueDate = new Date(currentPeriodStart);
  nextDueDate.setFullYear(currentPeriodStart.getFullYear() + 1);
  return { registrationAnchorDate: currentPeriodStart, currentPeriodStart, currentPeriodEnd, nextDueDate };
}

/**
 * 基础状态：只依据 due/grace 计算窗口。
 * UI 徽章会区分显示 active, due_soon, grace, inactive 状态。
 */
export function computeStatus(dates: SwimDates, now = new Date()): MembershipStatus {
  const { nextDueDate } = dates;
  if (!nextDueDate) return "inactive";
  const today = toMidnightLocal(now).getTime();
  const due = toMidnightLocal(nextDueDate).getTime();
  const earlyStart = due - RENEWAL_WINDOW_DAYS * 86400000;
  const graceEnd = due + GRACE_DAYS * 86400000;

  if (today < earlyStart) return "active";
  if (today >= earlyStart && today < due) return "due_soon";
  if (today >= due && today <= graceEnd) return "grace";
  return "inactive";
}

/**
 * 续期/重返时段计算
 */
export function computeNewPeriod(
  flow: "renew" | "rejoin",
  nextDueDate?: Date | null,
  now = new Date()
): { newStart: Date; newEnd: Date; newAnchor?: Date } {
  const today = toMidnightLocal(now);
  if (flow === "rejoin" || !nextDueDate) {
    const newStart = today; // 重返=支付日起算
    const newEnd = addYearsMinusOneDay(newStart, 1);
    return { newStart, newEnd, newAnchor: newStart };
  }
  // 续期：从 nextDueDate 起算
  const newStart = toMidnightLocal(nextDueDate);
  const newEnd = addYearsMinusOneDay(newStart, 1);
  return { newStart, newEnd };
}

export function diffInDays(a: Date, b: Date) {
  const A = toMidnightLocal(a).getTime();
  const B = toMidnightLocal(b).getTime();
  return Math.round((A - B) / 86400000);
}

export function fmt(d?: Date | null | { toDate?: () => Date } | { seconds?: number; nanoseconds?: number }) {
  if (!d) return "-";
  
  // Handle Firestore Timestamp (has toDate method)
  if (typeof d === "object" && typeof (d as any).toDate === "function") {
    const date = (d as { toDate: () => Date }).toDate();
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  
  // Handle Firestore Timestamp (seconds/nanoseconds format)
  if (typeof d === "object" && typeof (d as any).seconds === "number") {
    const ts = d as { seconds: number; nanoseconds?: number };
    const date = new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  
  // Handle Date object
  if (d instanceof Date) {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  
  // Fallback: try to parse as string or convert
  try {
    const date = new Date(d as any);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
  } catch {
    // ignore
  }
  
  return "-";
}

/** 
 * UI 徽章状态：区分 active, due_soon, grace, inactive
 */
export type BadgeStatus = "active" | "due_soon" | "grace" | "inactive";
export function computeBadgeStatus(s: MembershipStatus): BadgeStatus {
  return s;
}

/**
 * 是否处于可显示续费按钮的窗口（到期前30天或 grace 期）。
 * 注意：上层还需要叠加 isPaid / isFrozen 等业务条件。
 */
export function inRenewWindow(dates: SwimDates, now = new Date()): boolean {
  const s = computeStatus(dates, now);
  return s === "due_soon" || s === "grace";
}

/** Membership pause: clock stops until admin resumes (separate from isFrozen). */
export interface MembershipPauseState {
  membershipPaused?: boolean;
  membershipPausedAt?: Date | null;
}

export function getEffectiveNowForMembership(
  pause: MembershipPauseState,
  now = new Date()
): Date {
  if (pause.membershipPaused && pause.membershipPausedAt) {
    return toMidnightLocal(pause.membershipPausedAt);
  }
  return toMidnightLocal(now);
}

export function computeStatusWithPause(
  dates: SwimDates,
  pause: MembershipPauseState,
  now = new Date()
): MembershipStatus {
  return computeStatus(dates, getEffectiveNowForMembership(pause, now));
}

export function inRenewWindowWithPause(
  dates: SwimDates,
  pause: MembershipPauseState,
  now = new Date()
): boolean {
  return inRenewWindow(dates, getEffectiveNowForMembership(pause, now));
}

/** Whole days between pause start and resume (resume day not counted as paused). */
export function computePauseExtensionDays(
  pausedAt: Date,
  now = new Date()
): number {
  const paused = toMidnightLocal(pausedAt).getTime();
  const today = toMidnightLocal(now).getTime();
  return Math.max(0, Math.round((today - paused) / 86400000));
}

export function extendDateByDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return toMidnightLocal(out);
}

export function buildMembershipResumeDates(
  nextDueDate: Date,
  currentPeriodEnd: Date,
  pausedAt: Date,
  now = new Date()
): {
  nextDueDate: Date;
  currentPeriodEnd: Date;
  extensionDays: number;
} {
  const extensionDays = computePauseExtensionDays(pausedAt, now);
  return {
    nextDueDate: extendDateByDays(nextDueDate, extensionDays),
    currentPeriodEnd: extendDateByDays(currentPeriodEnd, extensionDays),
    extensionDays,
  };
}

/** Monthly tuition includes all swimmers except those explicitly frozen. */
export function isSwimmerEligibleForMonthlyTuition(data: Record<string, unknown>): boolean {
  return !data.isFrozen;
}
