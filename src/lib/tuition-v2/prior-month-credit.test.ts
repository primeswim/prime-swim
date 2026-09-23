import {
  applyPriorMonthSessionCredit,
  isAutoPriorMonthCreditNote,
  priorMonthCreditNote,
  toPriorMonthCredit,
} from "./prior-month-credit";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function testFullRateOneSessionCredit() {
  const applied = applyPriorMonthSessionCredit({
    sessionCount: 9,
    ratePerHour: 60,
    creditSessions: 1,
  });
  assert(applied.billedSessions === 8, "bill 8");
  assert(applied.baseAmount === 480, "60 * 8");
  assert(applied.amount === 480, "no sibling");
  assert(applied.creditAmount === 60, "$60 credit");
  assert(applied.note === priorMonthCreditNote(60), "auto note");
}

function testSiblingKeepsDiscountedRate() {
  const applied = applyPriorMonthSessionCredit({
    sessionCount: 9,
    ratePerHour: 60,
    siblingDiscountApplied: true,
    siblingDiscountPercent: 10,
    creditSessions: 1,
  });
  assert(applied.billedSessions === 8, "bill 8");
  assert(applied.baseAmount === 480, "standard after fewer sessions");
  assert(applied.amount === 432, "60 * 8 * 90%");
  assert(applied.creditAmount === 54, "486 - 432");
  assert(applied.note.includes("$54"), "note uses discounted credit");
}

function testZeroCreditUnchanged() {
  const applied = applyPriorMonthSessionCredit({
    sessionCount: 9,
    ratePerHour: 60,
    siblingDiscountApplied: true,
    siblingDiscountPercent: 10,
    creditSessions: 0,
  });
  assert(applied.amount === 486, "full sibling tuition");
  assert(applied.creditAmount === 0, "no credit");
  assert(applied.note === "", "no note");
  assert(toPriorMonthCredit(applied) === null, "nothing to persist");
}

function testCreditCannotExceedSessions() {
  const applied = applyPriorMonthSessionCredit({
    sessionCount: 9,
    ratePerHour: 60,
    creditSessions: 20,
  });
  assert(applied.billedSessions === 0, "floor at 0");
  assert(applied.amount === 0, "nothing due");
  assert(applied.creditAmount === 540, "full month credited");
}

function testAutoNoteMatch() {
  const note = priorMonthCreditNote(54);
  assert(
    isAutoPriorMonthCreditNote(note, { sessions: 1, creditAmount: 54, note }),
    "same note is auto"
  );
  assert(
    isAutoPriorMonthCreditNote("Please pay by the 1st.", { sessions: 1, creditAmount: 54, note }) ===
      false,
    "custom note kept"
  );
}

function run() {
  testFullRateOneSessionCredit();
  testSiblingKeepsDiscountedRate();
  testZeroCreditUnchanged();
  testCreditCannotExceedSessions();
  testAutoNoteMatch();
  console.log("tuition-v2 prior-month-credit tests passed");
}

run();
