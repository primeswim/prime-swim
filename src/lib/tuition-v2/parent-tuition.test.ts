import {
  invoiceNeedsAppPublish,
  invoicesNeedingAppPublish,
  invoicesPublishedToApp,
  isInvoicePublishedToApp,
  isTuitionVisibleToParents,
  keepPublishedToAppAfterRecalc,
  parentTuitionCandidateMonths,
  parentTuitionPrepMonth,
  pickParentTuitionForSwimmer,
  toParentTuitionView,
} from "./parent-tuition";
import type { TuitionV2Invoice } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function invoice(overrides: Partial<TuitionV2Invoice> = {}): TuitionV2Invoice {
  return {
    swimmerId: "s1",
    swimmerName: "Alex",
    level: "Bronze Performance",
    parentName: "Parent",
    parentEmail: "p@test.com",
    regularWeekdays: [1],
    ratePerHour: 20,
    rateTier: "normal",
    rateTierReason: "",
    billableSessionCount: 4,
    amount: 320,
    baseAmount: 320,
    practiceText: "Mon 7-8PM",
    lineItems: [],
    dueDate: "2026-10-01",
    months: ["October 2026"],
    afterFeeNote: "",
    paid: false,
    paidOn: null,
    emailStatus: "pending",
    ...overrides,
  };
}

function testPrepMonthCutoff() {
  assert(parentTuitionPrepMonth(new Date(2026, 8, 6)) === "2026-09", "before 15th → current month");
  assert(parentTuitionPrepMonth(new Date(2026, 8, 15)) === "2026-10", "on 15th → next month");
  assert(parentTuitionPrepMonth(new Date(2026, 8, 28)) === "2026-10", "late month → next month");
}

function testCandidateMonths() {
  const months = parentTuitionCandidateMonths(new Date(2026, 8, 6));
  assert(months.join(",") === "2026-08,2026-09,2026-10", "prev, current, next");
}

function testVisibilityIsPerInvoice() {
  assert(isTuitionVisibleToParents("planning", invoice()) === false, "draft hidden");
  assert(isTuitionVisibleToParents("computed", invoice()) === false, "computed hidden");
  assert(
    isTuitionVisibleToParents("approved", invoice()) === false,
    "month approved does not unlock unpublished kids"
  );
  assert(
    isTuitionVisibleToParents("sent", invoice()) === false,
    "month sent does not unlock unpublished kids"
  );
  assert(
    isTuitionVisibleToParents("computed", invoice({ publishedToApp: true, amount: 410 })) === true,
    "invoice publish is enough"
  );
  assert(
    isTuitionVisibleToParents("computed", invoice({ emailStatus: "sent" })) === false,
    "email alone does not publish a new/unflagged invoice"
  );
  assert(
    isTuitionVisibleToParents(
      "computed",
      invoice({ emailStatus: "sent", publishedToApp: false, amount: 999 })
    ) === false,
    "explicit unpublish after schedule change hides even if previously emailed"
  );
  assert(
    isTuitionVisibleToParents("computed", invoice({ firstInvoiceSentAt: "2026-09-01T00:00:00.000Z" })) ===
      false,
    "sent timestamp without publish flag stays 核算中"
  );
  assert(isTuitionVisibleToParents("computed", invoice({ paid: true })) === false, "paid without publish flag stays 核算中");
  assert(isTuitionVisibleToParents("computed", null) === false, "no invoice hidden");
}

function testNewInvoiceStaysUnpublishedUntilExplicitPublish() {
  assert(keepPublishedToAppAfterRecalc(undefined, false) === false, "new swimmer unpublished");
  assert(
    keepPublishedToAppAfterRecalc({ publishedToApp: undefined }, true) === false,
    "missing flag + unchanged billing still unpublished"
  );
  assert(
    keepPublishedToAppAfterRecalc({ publishedToApp: true }, true) === true,
    "already published stays published when billing unchanged"
  );
  assert(
    keepPublishedToAppAfterRecalc({ publishedToApp: true }, false) === false,
    "billing change unpublishes"
  );
  assert(isInvoicePublishedToApp(invoice()) === false, "draft invoice not in app");
  assert(invoiceNeedsAppPublish(invoice()) === true, "new invoice needs publish");
}

function testParentViewHidesDraftAmount() {
  const hidden = toParentTuitionView("2026-10", "computed", invoice({ amount: 999 }));
  assert(hidden.status === "calculating", "status calculating");
  assert(hidden.statusLabel === "核算中", "label 核算中");
  assert(hidden.amount === null, "amount stripped");

  const ready = toParentTuitionView(
    "2026-10",
    "computed",
    invoice({ amount: 420, publishedToApp: true })
  );
  assert(ready.status === "ready", "published ready");
  assert(ready.amount === 420, "amount shown");
}

function testPickLatestPublishedElsePrep() {
  const now = new Date(2026, 8, 20);
  const months = [
    { month: "2026-08", monthStatus: "sent", invoice: invoice({ amount: 200, publishedToApp: true }) },
    { month: "2026-09", monthStatus: "sent", invoice: invoice({ amount: 300, publishedToApp: true }) },
    { month: "2026-10", monthStatus: "computed", invoice: invoice({ amount: 999 }) },
  ];
  const picked = pickParentTuitionForSwimmer(months, now);
  assert(picked.month === "2026-09", "prefer latest published over draft next month");
  assert(toParentTuitionView(picked.month, picked.monthStatus, picked.invoice).amount === 300, "Sept");

  const publishedNext = pickParentTuitionForSwimmer(
    [
      { month: "2026-08", monthStatus: "sent", invoice: invoice({ publishedToApp: true }) },
      { month: "2026-09", monthStatus: "sent", invoice: invoice({ publishedToApp: true }) },
      { month: "2026-10", monthStatus: "computed", invoice: invoice({ amount: 410, publishedToApp: true }) },
    ],
    now
  );
  assert(publishedNext.month === "2026-10", "published next month wins");

  const nothingPublished = pickParentTuitionForSwimmer(
    [
      { month: "2026-08", monthStatus: "planning", invoice: null },
      { month: "2026-09", monthStatus: "computed", invoice: invoice({ amount: 111 }) },
      { month: "2026-10", monthStatus: "computed", invoice: invoice({ amount: 222 }) },
    ],
    now
  );
  assert(nothingPublished.month === "2026-10", "after 15th, prep month is next");
  assert(
    toParentTuitionView(nothingPublished.month, nothingPublished.monthStatus, nothingPublished.invoice)
      .amount === null,
    "prep draft still 核算中"
  );
}

function testPublishFilterSkipsAlreadyPublished() {
  const rows = [
    invoice({ swimmerId: "a", level: "Bronze Performance", publishedToApp: true }),
    invoice({ swimmerId: "b", level: "Bronze Performance" }),
    invoice({ swimmerId: "c", level: "Gold Performance" }),
  ];
  assert(invoiceNeedsAppPublish(rows[0]) === false, "already published");
  assert(invoiceNeedsAppPublish(rows[1]) === true, "draft needs publish");
  const bronze = invoicesNeedingAppPublish(rows, { levels: ["Bronze Performance"] });
  assert(bronze.map((r) => r.swimmerId).join(",") === "b", "only unpublished bronze");
  const one = invoicesNeedingAppPublish(rows, { swimmerIds: ["c"] });
  assert(one.length === 1 && one[0].swimmerId === "c", "single swimmer");
  assert(isInvoicePublishedToApp(rows[0]) === true, "published flag");
  const publishedBronze = invoicesPublishedToApp(rows, { levels: ["Bronze Performance"] });
  assert(publishedBronze.map((r) => r.swimmerId).join(",") === "a", "unpublish targets only In app");
}

testPrepMonthCutoff();
testCandidateMonths();
testVisibilityIsPerInvoice();
testNewInvoiceStaysUnpublishedUntilExplicitPublish();
testParentViewHidesDraftAmount();
testPickLatestPublishedElsePrep();
testPublishFilterSkipsAlreadyPublished();
console.log("parent-tuition tests passed");
