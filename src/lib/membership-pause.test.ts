/**
 * Membership pause/resume logic tests.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' src/lib/membership-pause.test.ts
 */
import {
  computePauseExtensionDays,
  computeStatus,
  computeStatusWithPause,
  buildMembershipResumeDates,
  extendDateByDays,
  toMidnightLocal,
} from "./membership";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

function daysFromToday(offset: number): Date {
  const d = toMidnightLocal(new Date());
  d.setDate(d.getDate() + offset);
  return d;
}

function runTests() {
  test("computePauseExtensionDays counts whole days", () => {
    const pausedAt = new Date("2025-06-01T12:00:00");
    const resume = new Date("2025-06-11T08:00:00");
    assert(computePauseExtensionDays(pausedAt, resume) === 10, "10 days between Jun 1 and Jun 11");
  });

  test("computePauseExtensionDays same day is zero", () => {
    const d = new Date("2025-07-15T09:00:00");
    assert(computePauseExtensionDays(d, d) === 0, "same day = 0 extension");
  });

  test("while paused, status does not advance past due date", () => {
    const nextDue = daysFromToday(60);
    const pausedAt = daysFromToday(-10);
    const status = computeStatusWithPause(
      { nextDueDate: nextDue },
      { membershipPaused: true, membershipPausedAt: pausedAt },
      new Date()
    );
    assert(status === "active", "should still be active while paused before renewal window");
  });

  test("while paused in grace, status stays grace not inactive", () => {
    const nextDue = daysFromToday(-20);
    const pausedAt = daysFromToday(-18);
    const status = computeStatusWithPause(
      { nextDueDate: nextDue },
      { membershipPaused: true, membershipPausedAt: pausedAt },
      new Date()
    );
    assert(status === "grace", "grace frozen at pause time");
  });

  test("resume extends nextDue and period end by pause duration", () => {
    const nextDue = toMidnightLocal(new Date("2026-01-01"));
    const periodEnd = toMidnightLocal(new Date("2025-12-31"));
    const pausedAt = toMidnightLocal(new Date("2025-06-01"));
    const resumeAt = toMidnightLocal(new Date("2025-09-01"));
    const { nextDueDate, currentPeriodEnd, extensionDays } = buildMembershipResumeDates(
      nextDue,
      periodEnd,
      pausedAt,
      resumeAt
    );
    assert(extensionDays === 92, "Jun 1 → Sep 1 = 92 days");
    assert(
      nextDueDate.getTime() === extendDateByDays(nextDue, 92).getTime(),
      "nextDue extended"
    );
    assert(
      currentPeriodEnd.getTime() === extendDateByDays(periodEnd, 92).getTime(),
      "period end extended"
    );
  });

  test("after resume, status uses real now with extended dates", () => {
    const nextDue = toMidnightLocal(new Date("2026-04-01"));
    const pausedAt = toMidnightLocal(new Date("2025-06-01"));
    const statusWhilePaused = computeStatusWithPause(
      { nextDueDate: toMidnightLocal(new Date("2026-01-01")) },
      { membershipPaused: true, membershipPausedAt: pausedAt },
      new Date("2026-02-15")
    );
    assert(statusWhilePaused === "active", "paused clock frozen");

    const statusAfterResume = computeStatus(
      { nextDueDate: nextDue },
      new Date("2026-02-15")
    );
    assert(statusAfterResume === "active", "extended due keeps active in Feb");
  });

  console.log("\nAll membership pause tests passed.");
}

runTests();
