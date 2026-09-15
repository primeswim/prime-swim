import {
  loadTestTacHyv,
  mockPnsCalendarItems,
  PROD_PARENT,
  TEST_OMR_URL,
  TEST_PARENT_NO_ID,
  TEST_PARENT_WITH_ID,
  testSwimmers,
} from "./fixtures";
import { assertSendableHostEmail, MeetService, MeetServiceError } from "./service";
import { MemoryMeetStore } from "./store";
import { canViewerSeeMeet } from "./test-data";
import { meetMatchesSource } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Frozen clock before TAC Prime Deadline (2026-09-08) so tests do not depend on "today". */
const TEST_NOW = "2026-09-01T12:00:00";

async function seedWorld() {
  const store = new MemoryMeetStore();
  store.settings.usaSwimmingOmrUrl = TEST_OMR_URL;
  await store.markTestAccount(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  await store.markTestAccount(TEST_PARENT_NO_ID.uid, TEST_PARENT_NO_ID.email);
  for (const swimmer of testSwimmers()) {
    await store.saveSwimmer(swimmer);
  }
  const service = new MeetService(store);
  return { store, service };
}

async function testPnsIngestAndMeetTypes() {
  const { service } = await seedWorld();
  const ingested = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  assert(ingested.length === 5, "five mock PNS meets");
  const invitational = ingested.find((m) => meetMatchesSource(m, "tac"))!;
  const open = ingested.find((m) => meetMatchesSource(m, "open-challenge"))!;
  assert(/^[0-9a-f-]{36}$/i.test(invitational.id), "ingested meet uses a GUID id");
  assert(invitational.sourceKey === "test-pns-tac-pentathlon", "source key is not the URL");
  const again = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  assert(again.find((m) => m.sourceKey === invitational.sourceKey)?.id === invitational.id, "re-ingest keeps the same GUID");
  assert(invitational.isTestData && invitational.name.startsWith("[TEST]"), "invitational marked test");
  assert(open.isTestData && open.name.startsWith("[TEST]"), "open marked test");
  assert(invitational.invitationStatus === "not_requested", "invitational needs invite");
  assert(open.invitationStatus === "not_required", "open does not");
  assert(invitational.eligibilityNotes.some((n) => /Invitational/i.test(n)), "eligibility shown from announcement");
  assert(Boolean(invitational.announcementUrl?.endsWith(".pdf")), "announcement file attached");
  assert(open.eligibilityNotes.some((n) => /USA Swimming/i.test(n)), "open still shows membership rule");
  const blankDraft = await service.composeEntryEmail(invitational.id);
  assert(blankDraft.to === "gminkel@fidalgopool.com", "host To is filled before anyone Attends");
  assert(/Hello Thunderbird/i.test(blankDraft.body), "greeting uses host club");
  assert(blankDraft.mailto.includes("subject="), "Open in Mail link has title and body");
  const inviteAsk = await service.composeInvitationInquiryEmail(invitational.id);
  assert(/consider inviting Prime Swim Academy/i.test(inviteAsk.body), "invitation letter asks to participate");
  assert(!/submitting entries/i.test(inviteAsk.body), "invitation letter is not the entry list");
  assert(/Event File/i.test(inviteAsk.body), "invitation letter also asks for the event file");
  const asked = await service.markInvitationRequested(invitational.id, inviteAsk.to);
  assert(asked.invitationStatus === "requested", "I asked the host marks requested");

  await service.approveMeet(invitational.id);
  try {
    await service.publishToFamilies(invitational.id);
    throw new Error("should not publish uninvited invitational");
  } catch (e) {
    assert(e instanceof MeetServiceError, "blocked as service error");
  }

  await service.setInvitationStatus(invitational.id, "invited");
  await service.approveMeet(invitational.id);
  const publishedInv = await service.publishToFamilies(invitational.id);
  assert(publishedInv.status === "commitment_open", "invitational publishes after invited");

  const publishedOpen = await service.publishToFamilies(open.id);
  assert(publishedOpen.status === "commitment_open", "open publishes from draft without a separate Approve");
}

async function testUsaIdGateUsesClubOmrLink() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.setInvitationStatus(open.id, "not_required");
  await service.approveMeet(open.id);
  await service.publishToFamilies(open.id);

  const leoDetail = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    email: TEST_PARENT_NO_ID.email,
  });
  assert(leoDetail.usaGate.canAttend === false, "Leo cannot Attend without USA ID");
  assert(leoDetail.usaGate.registerUrl === TEST_OMR_URL, "CTA uses admin-stored OMR URL");
  assert(leoDetail.announcementUrl === "https://example.test/open-challenge.pdf", "announcement file shown");

  try {
    await service.saveParentCommitment({
      meetId: open.id,
      swimmerId: "test-swimmer-leo",
      parentUID: TEST_PARENT_NO_ID.uid,
      attendance: "attend",
      availableSessionIds: ["saturday"],
      selectedEventIds: [],
      parentNotes: "",
      acceptFeePolicy: true,
      nowIso: TEST_NOW,
    });
    throw new Error("attend without USA ID should fail");
  } catch (e) {
    assert(e instanceof MeetServiceError, "USA ID gate enforced");
  }

  await service.saveUsaSwimmingId({
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    usaSwimmingId: "TESTLEO8USAID",
  });
  const after = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    email: TEST_PARENT_NO_ID.email,
  });
  assert(after.usaGate.canAttend === true, "Attend unlocks after ID is saved");
}

async function testInvitationalEventFlowAndCuts() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const tac = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "tac"))!;
  await service.setInvitationStatus(tac.id, "invited");
  await service.approveMeet(tac.id);
  await service.publishToFamilies(tac.id);

  const beforeFile = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(beforeFile.hasEventFile === false, "no checkboxes before event file");
  assert(beforeFile.eligibility.notes.some((n) => /Invitational/i.test(n)), "parent sees invitational eligibility");
  assert(Boolean(beforeFile.announcementUrl?.includes("tac-fall-pentathlon.pdf")), "parent sees announcement file");

  const savedNotes = await service.saveParentCommitment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["saturday", "sunday"],
    selectedEventIds: [],
    parentNotes: "Available Saturday only after 9am. First meet.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  assert(savedNotes.attendance === "attend", "days + notes without an Event File is a valid Attend");
  assert(savedNotes.parentNotes.includes("First meet"), "notes persist from phase 1");

  await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
  const withFile = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(withFile.hasEventFile === true, "event file unlocks checkboxes");
  assert(withFile.commitment?.parentNotes.includes("First meet") === true, "notes survive import");
  assert(withFile.eligibleEvents.some((e) => e.eventNumber === 3), "11yo sees 11-12 50 fly");
  assert(!withFile.eligibleEvents.some((e) => e.eventNumber === 1), "11yo hidden from 8&U");
  assert(withFile.eligibleEvents.some((e) => e.eventNumber === 26), "11yo sees Sunday 500");

  const sat = withFile.eligibleEvents.filter((e) => e.sessionName === "Saturday").slice(0, 5).map((e) => e.id);
  const sun = withFile.eligibleEvents.filter((e) => e.sessionName === "Sunday").slice(0, 2).map((e) => e.id);
  const selected = [...sat, ...sun];
  const attend = await service.saveParentCommitment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["saturday", "sunday"],
    selectedEventIds: selected,
    parentNotes: "Available Saturday only after 9am. First meet.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  assert(attend.attendance === "attend", "full selection is attend");
  assert(attend.estimatedFee === 25 + 4.5 * selected.length, "estimate uses surcharge + event fee");

  try {
    const tooMany = [
      ...withFile.eligibleEvents.filter((e) => e.sessionName === "Saturday").slice(0, 5).map((e) => e.id),
      ...withFile.eligibleEvents.filter((e) => e.sessionName === "Sunday").slice(0, 4).map((e) => e.id),
    ];
    await service.saveParentCommitment({
      meetId: tac.id,
      swimmerId: "test-swimmer-elena",
      parentUID: TEST_PARENT_WITH_ID.uid,
      attendance: "attend",
      availableSessionIds: ["saturday", "sunday"],
      selectedEventIds: tooMany,
      parentNotes: attend.parentNotes,
      acceptFeePolicy: true,
      nowIso: TEST_NOW,
    });
    throw new Error("should block meet over-limit");
  } catch (e) {
    assert(e instanceof MeetServiceError && /limit/i.test(e.message), "event limit enforced");
  }

  await service.closeCommitments(tac.id);
  await service.markSubmitted(tac.id);
  const pending = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(pending.eventLabel === "pending_for_review", "after send still pending");
  assert(pending.displayedEvents.length === selected.length, "requested events still shown");
  assert(pending.fee.isEstimate === true, "fee not final until confirmed");

  await service.recordHostReply(tac.id, "[TEST] Host cut Sunday 500 for timeline.");
  await service.removeCutEvents({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    keepEventIds: sat,
    note: "[TEST] Host cut Sunday distance",
  });
  const stillPending = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(stillPending.eventLabel === "pending_for_review", "cuts not shown before publish confirmed");
  assert(stillPending.displayedEvents.length === selected.length, "parent still sees original request");

  await service.publishConfirmed(tac.id);
  const confirmed = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(confirmed.eventLabel === "confirmed", "publish confirmed unlocks lineup");
  assert(confirmed.displayedEvents.length === sat.length, "Sunday cut removed for parent");
  assert(confirmed.fee.isEstimate === false, "invoice is final");
  assert(confirmed.fee.total === 25 + 4.5 * sat.length, "final invoice uses remaining events");
  assert(confirmed.commitment?.paymentStatus === "invoice_ready", "invoice ready after confirm");
}

async function testIsolationSharedDatabase() {
  const { store, service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  for (const meet of await service.listAdminMeets()) {
    if (meet.invitationStatus !== "not_required") {
      await service.setInvitationStatus(meet.id, "invited");
    }
    await service.approveMeet(meet.id);
    await service.publishToFamilies(meet.id);
  }
  await store.saveMeet({
    id: "prod-pns-real-meet",
    name: "2026 PN Real Championship",
    hostClub: "Real Club",
    meetType: "open",
    course: "scy",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
    location: "King County",
    eligibilityStatus: "likely_eligible",
    invitationStatus: "not_required",
    eligibilityNotes: [],
    deadlineTimezone: "America/Los_Angeles",
    status: "commitment_open",
    sessions: [],
    events: [],
    isTestData: false,
  });

  const testCards = await service.listParentMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  const prodCards = await service.listParentMeets(PROD_PARENT.uid, PROD_PARENT.email);
  assert(testCards.every((c) => c.isTestData && c.name.startsWith("[TEST]")), "test parent only sees [TEST] meets");
  assert(prodCards.every((c) => !c.isTestData && !c.name.startsWith("[TEST]")), "real parent never sees test meets");
  assert(prodCards.some((c) => c.meetId === "prod-pns-real-meet"), "real parent sees production meet");
  assert(!testCards.some((c) => c.meetId === "prod-pns-real-meet"), "test parent does not see production meet");
  assert(
    canViewerSeeMeet({ meetIsTestData: true, viewerIsTestAccount: false }) === false,
    "isolation helper agrees"
  );

  try {
    await service.getParentDetail({
      meetId: "prod-pns-real-meet",
      swimmerId: "test-swimmer-elena",
      parentUID: TEST_PARENT_WITH_ID.uid,
      email: TEST_PARENT_WITH_ID.email,
    });
    throw new Error("test parent should not open prod meet");
  } catch (e) {
    assert(e instanceof MeetServiceError, "cross-world detail blocked");
  }
}

async function testDeadlineAutoCloseAndHostEmail() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const tac = (await service.listAdminMeets(TEST_NOW)).find((m) => meetMatchesSource(m, "tac"))!;
  await service.setInvitationStatus(tac.id, "invited");
  await service.publishToFamilies(tac.id);
  await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
  const elena = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  await service.saveParentCommitment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["saturday"],
    selectedEventIds: elena.eligibleEvents.slice(0, 2).map((e) => e.id),
    parentNotes: "",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });

  const draft = await service.composeEntryEmail(tac.id);
  assert(draft.to === "gminkel@fidalgopool.com", "draft fills the host inbox");
  assert(/Elena/i.test(draft.body), "draft names the swimmer");
  assert(/Prime Swim Academy/i.test(draft.body), "draft is from Prime");
  assert(/entries/i.test(draft.subject), "subject mentions entries");
  assert(draft.mailto.startsWith("mailto:gminkel@fidalgopool.com"), "mailto opens local mail with host");
  assert(draft.body.includes("Please accept"), "letter is written, not a blank box");

  try {
    assertSendableHostEmail(tac, "gminkel@fidalgopool.com");
    throw new Error("should block real host on test meet");
  } catch (e) {
    assert(e instanceof MeetServiceError && /TEST/i.test(e.message), "real host blocked for [TEST] meet");
  }
  assertSendableHostEmail(tac, "prime.swim.us@gmail.com");

  const closed = await service.getAdminMeet(tac.id, "2026-09-19T08:00:00");
  assert(closed?.status === "commitment_closed", "auto-closes the day after Prime Deadline");
  try {
    await service.saveParentCommitment({
      meetId: tac.id,
      swimmerId: "test-swimmer-elena",
      parentUID: TEST_PARENT_WITH_ID.uid,
      attendance: "decline",
      availableSessionIds: [],
      selectedEventIds: [],
      parentNotes: "",
      nowIso: "2026-09-19T08:00:00",
    });
    throw new Error("should not allow RSVP after auto-close");
  } catch (e) {
    assert(e instanceof MeetServiceError, "Attend/Decline blocked after deadline day");
  }
}

async function testComposeRequiresSelections() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.approveMeet(open.id);
  await service.publishToFamilies(open.id);
  try {
    await service.markSubmitted(open.id);
    throw new Error("submit without attenders should fail");
  } catch (e) {
    assert(e instanceof MeetServiceError, "cannot mark sent with nobody Attending");
  }

  await service.saveUsaSwimmingId({
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    usaSwimmingId: "TESTLEO8USAID",
  });
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    attendance: "attend",
    availableSessionIds: ["saturday"],
    selectedEventIds: [],
    parentNotes: "",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  const dayOnly = await service.composeEntryEmail(open.id);
  assert(/Leo/i.test(dayOnly.body), "day-only Attend still names the swimmer");
  assert(/Saturday/i.test(dayOnly.body), "letter lists the days the family checked");
  assert(dayOnly.readyToSend, "letter is sendable before an Event File exists");
  const submitted = await service.markSubmitted(open.id);
  assert(submitted.status === "submitted", "I sent it works from days-only Attend");
}

async function testDeclineWithoutUsaIdAndPayment() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.approveMeet(open.id);
  await service.publishToFamilies(open.id);

  const declined = await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    attendance: "decline",
    availableSessionIds: [],
    selectedEventIds: [],
    parentNotes: "Cannot make this weekend.",
    nowIso: TEST_NOW,
  });
  assert(declined.attendance === "decline", "Decline works without a USA Swimming ID");

  try {
    await service.saveUsaSwimmingId({
      swimmerId: "test-swimmer-leo",
      parentUID: TEST_PARENT_NO_ID.uid,
      usaSwimmingId: "bad",
    });
    throw new Error("invalid USA ID should fail");
  } catch (e) {
    assert(e instanceof MeetServiceError, "invalid USA ID rejected");
  }

  const tac = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "tac"))!;
  await service.setInvitationStatus(tac.id, "invited");
  await service.approveMeet(tac.id);
  await service.publishToFamilies(tac.id);
  await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
  const elena = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  const selected = elena.eligibleEvents.slice(0, 2).map((e) => e.id);
  await service.saveParentCommitment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["saturday"],
    selectedEventIds: selected,
    parentNotes: "",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  await service.closeCommitments(tac.id);
  await service.markSubmitted(tac.id);
  await service.recordHostReply(tac.id, "[TEST] accepted");
  await service.removeCutEvents({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    keepEventIds: selected,
  });
  await service.publishConfirmed(tac.id);
  const exported = await service.exportMeetEntries(tac.id);
  assert(exported.entries.some((e) => e.swimmerId === "test-swimmer-elena" && e.finalEventIds.length === selected.length), "export has Elena final events");
  const trimmed = await service.updateAdminCommitment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    attendance: "attend",
    eventIds: [selected[0]],
  });
  assert(trimmed.confirmedEventIds?.join(",") === selected[0], "admin can change the stored final events");
  const invoices = await service.listMeetPayments(TEST_NOW);
  assert(invoices.some((row) => row.meetId === tac.id && row.paymentDueAt), "confirmed meet appears on the payment board");
  const reported = await service.reportPayment({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
  });
  assert(reported.paymentStatus === "payment_reported", "parent can only report payment");
  const paid = await service.markPaid({ meetId: tac.id, swimmerId: "test-swimmer-elena" });
  assert(paid.paymentStatus === "paid", "only admin marks paid");

  const dash = await service.listParentDashboard(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  assert(dash.settings.usaSwimmingOmrUrl === TEST_OMR_URL, "dashboard exposes club OMR URL");
  assert(dash.payments.some((p) => p.meetId === tac.id && p.finalFee && p.finalFee > 0), "confirmed invoice is in Payments to Prime");
}

async function testDeadlineCloseDrillAutoCloses() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const drill = (await service.listAdminMeets("2026-09-01T12:00:00")).find((m) => meetMatchesSource(m, "deadline-close"))!;
  await service.publishToFamilies(drill.id);
  const stillOpen = await service.getAdminMeet(drill.id, "2026-09-05T12:00:00");
  assert(stillOpen?.status === "commitment_open", "open on the Prime Deadline day");
  const closed = await service.getAdminMeet(drill.id, "2026-09-06T08:00:00");
  assert(closed?.status === "commitment_closed", "auto-closes the next Pacific day");
}

async function testRejectKeepsMeetOffFamilyList() {
  const { service } = await seedWorld();
  const ingested = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = ingested.find((m) => meetMatchesSource(m, "open-challenge"))!;
  const rejected = await service.rejectMeet(open.id, "Not a good fit this season.");
  assert(rejected.status === "cancelled", "rejected meet is cancelled");
  assert(Boolean(rejected.rejectedAt), "rejected timestamp stored");
  const parentMeets = await service.listParentMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  assert(!parentMeets.some((m) => m.meetId === open.id), "rejected meet stays off the family list");
  const again = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const still = again.find((m) => m.sourceKey === open.sourceKey);
  assert(still?.status === "cancelled", "PNS re-check does not reopen a rejected meet");
  try {
    await service.publishToFamilies(open.id);
    throw new Error("should not publish rejected meet");
  } catch (e) {
    assert(e instanceof MeetServiceError, "publish blocked after reject");
  }
}

async function testPublishedPnsUpdateWaitsForAccept() {
  const { service } = await seedWorld();
  const ingested = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = ingested.find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.publishToFamilies(open.id);
  const items = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey
      ? {
          ...item,
          announcementUrl: "https://example.test/open-challenge-v2.pdf",
          announcementText: `${item.announcementText}\nUpdated Sep 14.`,
          sourceFiles: [{ name: "open-challenge-v2.pdf", url: "https://example.test/open-challenge-v2.pdf", kind: "announcement" as const }],
        }
      : item
  );
  await service.ingestPns(items, { isTestData: true });
  const waiting = await service.getAdminMeet(open.id);
  assert(waiting?.pendingSourceReview === true, "published meet flags a PNS update");
  assert(waiting?.announcementUrl !== "https://example.test/open-challenge-v2.pdf", "family page keeps the old announcement until Accept");
  const accepted = await service.acceptSourceUpdate(open.id, "Updated Sep 14 — announcement replaced.");
  assert(accepted.announcementUrl === "https://example.test/open-challenge-v2.pdf", "Accept applies the new PDF");
  assert(Boolean(accepted.parentUpdateBanner?.includes("Updated Sep 14")), "optional parent banner is stored");
}

async function run() {
  await testPnsIngestAndMeetTypes();
  await testRejectKeepsMeetOffFamilyList();
  await testPublishedPnsUpdateWaitsForAccept();
  await testUsaIdGateUsesClubOmrLink();
  await testInvitationalEventFlowAndCuts();
  await testIsolationSharedDatabase();
  await testDeadlineAutoCloseAndHostEmail();
  await testComposeRequiresSelections();
  await testDeclineWithoutUsaIdAndPayment();
  await testDeadlineCloseDrillAutoCloses();
  console.log("meets.integration.test.ts passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
