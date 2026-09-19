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
import { meetDayOptions } from "./sessions";
import { filterAdminMeetList } from "./list-filter";
import { isSwimmerUpcomingMeetCard } from "./parent-view";
import { canViewerSeeMeet } from "./test-data";
import { meetMatchesSource, type MeetSwimmer } from "./types";

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
  assert(invitational.surcharge === 25 && invitational.individualEventFee === 4.5, "TAC fees come from the announcement");
  assert(open.surcharge === 15 && open.individualEventFee === 6, "open meet fees come from the announcement");
  const pdfOnly = await service.ingestPns(
    [
      {
        sourceId: "test-pns-pdf-fees",
        name: "[TEST] PDF Fee Meet",
        hostClub: "PASC",
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        location: "King County Aquatics",
        announcementText: "Hosted by PASC. No dollar amounts in the calendar notes.",
        surcharge: 25,
        individualEventFee: 4.5,
      },
    ],
    { isTestData: true }
  );
  assert(pdfOnly[0].surcharge === 25 && pdfOnly[0].individualEventFee === 4.5, "PDF-extracted fees land on the draft");
  const corrected = await service.updateMeet(pdfOnly[0].id, { surcharge: 20, individualEventFee: 4.5 });
  assert(corrected.surcharge === 20, "admin can correct extracted host fees");
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
  const tac = (await service.listAdminMeets(TEST_NOW)).find((m) => meetMatchesSource(m, "tac"))!;
  await service.setInvitationStatus(tac.id, "invited");
  await service.approveMeet(tac.id);
  await service.publishToFamilies(tac.id);

  const beforeFile = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
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
    nowIso: TEST_NOW,
  });
  assert(withFile.review.requiresEventReview === true, "Event File import requires Attend again");
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
  const closedParent = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(closedParent.canRespond === false, "parent cannot change RSVP after close");
  const reopened = await service.reopenCommitments(tac.id, TEST_NOW);
  assert(reopened.status === "commitment_open", "admin can reopen RSVP");
  assert(!reopened.commitmentClosedAt, "closed timestamp clears");
  const openAgain = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(openAgain.canRespond === true, "parent can change RSVP after reopen");
  await service.closeCommitments(tac.id);
  await service.markSubmitted(tac.id);
  try {
    await service.reopenCommitments(tac.id, TEST_NOW);
    throw new Error("should not reopen after send");
  } catch (e) {
    assert(e instanceof MeetServiceError && /sent to the host/i.test(e.message), "cannot reopen after submit");
  }
  const pending = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
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
    nowIso: TEST_NOW,
  });
  assert(stillPending.eventLabel === "pending_for_review", "cuts not shown before publish confirmed");
  assert(stillPending.displayedEvents.length === selected.length, "parent still sees original request");

  await service.publishConfirmed(tac.id);
  const confirmed = await service.getParentDetail({
    meetId: tac.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
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
  assert(/SD3/i.test(draft.subject), "subject mentions SD3 once events exist");
  assert(draft.mailto.startsWith("mailto:gminkel@fidalgopool.com"), "mailto opens local mail with host");
  assert(/Import → Entries/i.test(draft.body), "letter tells the host to import SD3");

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
    parentNotes: "Saturday 50 free and 50 fly until the event file is posted.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  const dayOnly = await service.composeEntryEmail(open.id);
  assert(/Leo/i.test(dayOnly.body), "day-only Attend still names the swimmer");
  assert(/Saturday/i.test(dayOnly.body), "letter lists the days the family checked");
  assert(/event file not posted/i.test(dayOnly.subject + dayOnly.body), "before EV3 the letter is a roster, not an import file");
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
  const elenaCard = dash.meetsBySwimmer["test-swimmer-elena"].find((card) => card.meetId === tac.id);
  assert(elenaCard?.attendance === "attend", "confirmed Attend stays on the swimmer dashboard payload");
  assert((elenaCard?.finalFee || 0) > 0, "dashboard card shows a non-zero final fee");
  const upcoming = await service.listUpcomingSwimmerMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email, { nowIso: TEST_NOW });
  const elenaMeet = upcoming.find((row) => row.meetId === tac.id && row.swimmerId === "test-swimmer-elena");
  assert(Boolean(elenaMeet), "upcoming API includes Elena’s TAC meet");
  assert((elenaMeet?.events.length || 0) > 0, "upcoming API returns the events she selected");
  assert(dash.upcoming.some((row) => row.meetId === tac.id && row.events.length > 0), "dashboard payload includes the same upcoming events");
}

async function testFinalInvoiceUsesEventFeesAndAdminRates() {
  const { store, service } = await seedWorld();
  const meet = {
    id: "test-fee-event42",
    sourceKey: "test-fee-event42",
    name: "[TEST] Boys 8&U Breast Invite",
    hostClub: "Host",
    meetType: "open" as const,
    course: "scy" as const,
    startDate: "2026-10-17",
    endDate: "2026-10-18",
    location: "Pool",
    eligibilityStatus: "likely_eligible" as const,
    invitationStatus: "not_required" as const,
    eligibilityNotes: [],
    deadlineTimezone: "America/Los_Angeles",
    primeCommitmentDeadline: "2026-09-20T23:59:00",
    status: "commitment_open" as const,
    sessions: [{ id: "2026-10-18", name: "Sunday" }],
    events: [
      {
        id: "e42",
        eventNumber: 42,
        sessionName: "Sunday",
        gender: "male" as const,
        minAge: 0,
        maxAge: 8,
        distance: 25,
        stroke: "breast" as const,
        course: "scy" as const,
        eventFee: 8,
      },
    ],
    publishedToFamiliesAt: TEST_NOW,
    eventFileAcceptedAt: TEST_NOW,
    isTestData: true,
  };
  await store.saveMeet(meet);

  await service.saveUsaSwimmingId({
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    usaSwimmingId: "TESTLEO8USAID",
  });
  await service.saveParentCommitment({
    meetId: meet.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    attendance: "attend",
    availableSessionIds: ["2026-10-18"],
    selectedEventIds: ["e42"],
    parentNotes: "",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  const estimate = await store.getCommitment(meet.id, "test-swimmer-leo");
  assert(estimate?.estimatedFee === 8, "estimate uses Event File fee when meet rates are blank");

  await service.closeCommitments(meet.id);
  await service.markSubmitted(meet.id);
  await service.recordHostReply(meet.id, "[TEST] no cuts");
  await service.publishConfirmed(meet.id);
  const confirmed = await service.getParentDetail({
    meetId: meet.id,
    swimmerId: "test-swimmer-leo",
    parentUID: TEST_PARENT_NO_ID.uid,
    email: TEST_PARENT_NO_ID.email,
  });
  assert(confirmed.fee.total === 8, "final fee uses Event File eventFee");
  assert(confirmed.commitment?.finalFee === 8, "stored invoice is not zero");
  assert(confirmed.displayedEvents.some((event) => /#42/.test(event.label)), "parent sees event 42");

  await store.saveMeet({
    ...meet,
    id: "test-fee-repair",
    sourceKey: "test-fee-repair",
    events: [{ ...meet.events[0], eventFee: undefined }],
    status: "entries_confirmed",
    entriesConfirmedAt: TEST_NOW,
  });
  await store.saveCommitment({
    id: "test-fee-repair__test-swimmer-elena",
    meetId: "test-fee-repair",
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["2026-10-18"],
    selectedEventIds: ["e42"],
    confirmedEventIds: ["e42"],
    parentNotes: "",
    finalFee: 0,
    paymentStatus: "none",
    isTestData: true,
  });
  await service.updateMeet("test-fee-repair", { surcharge: 15, individualEventFee: 6 });
  const repaired = await service.getParentDetail({
    meetId: "test-fee-repair",
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
  });
  assert(repaired.fee.total === 21, "admin rates recalculate a $0 confirmed invoice");
  assert(repaired.commitment?.paymentStatus === "invoice_ready", "repaired invoice is payable");
  const dash = await service.listParentDashboard(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  const card = dash.meetsBySwimmer["test-swimmer-elena"].find((row) => row.meetId === "test-fee-repair");
  assert(card?.attendance === "attend", "repaired confirmed meet stays on the swimmer card");
  assert(card?.finalFee === 21, "dashboard card has the repaired fee");
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
  const queued = filterAdminMeetList([waiting!], "has_updates");
  assert(queued.length === 1, "Has updates list includes this meet");
  const accepted = await service.acceptSourceUpdate(open.id, "Updated Sep 14 — announcement replaced.");
  assert(accepted.announcementUrl === "https://example.test/open-challenge-v2.pdf", "Accept applies the new PDF");
  assert(Boolean(accepted.parentUpdateBanner?.includes("Updated Sep 14")), "optional parent banner is stored");
}

async function testHasUpdatesDateChangeParentRsvp() {
  const { service, store } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets()).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.publishToFamilies(open.id);
  const originalDays = meetDayOptions(open).map((day) => day.id);
  assert(originalDays.join(",") === "2026-10-17,2026-10-18", "open challenge is a two-day meet");
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: originalDays,
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });

  const v2Url = "https://example.test/open-challenge-v2.pdf";
  const updatedText = `${mockPnsCalendarItems().find((item) => item.sourceId === open.sourceKey)?.announcementText}\nUpdated.`;
  const withPdf = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey
      ? {
          ...item,
          announcementUrl: v2Url,
          announcementText: updatedText,
          sourceFiles: [{ name: "open-challenge-v2.pdf", url: v2Url, kind: "announcement" as const }],
        }
      : item
  );
  await service.ingestPns(withPdf, { isTestData: true });
  const waitingPdf = await service.getAdminMeet(open.id);
  assert(waitingPdf?.pendingSourceReview === true, "PDF change flags Has updates");
  const parentWhileWaiting = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(parentWhileWaiting.meet.startDate === "2026-10-17", "family still sees the old dates before Accept");
  assert(parentWhileWaiting.canRespond === true, "Attend stays available while Has updates is pending");
  const pdfAccepted = await service.acceptSourceUpdate(open.id);
  assert((pdfAccepted.meetVersion || 1) === 1, "PDF-only Accept does not increment meetVersion");
  assert(!pdfAccepted.parentUpdateBanner, "same days do not show a re-pick prompt");
  const afterPdf = await store.getCommitment(open.id, "test-swimmer-elena");
  assert(afterPdf?.availableSessionIds.join(",") === originalDays.join(","), "selected days stay when dates did not move");
  const stillOpen = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(stillOpen.canRespond === true && stillOpen.canEdit === true, "parent can still tap Attend after a PDF update");
  const savedAgain = await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: originalDays,
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  assert(savedAgain.attendance === "attend", "Attend still saves after Has updates");

  const withExtraDay = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey
      ? { ...item, announcementUrl: v2Url, announcementText: updatedText, endDate: "2026-10-19" }
      : item
  );
  await service.ingestPns(withExtraDay, { isTestData: true });
  assert((await service.getAdminMeet(open.id))?.pendingSourceReview === true, "endDate change flags Has updates");
  const extendAccepted = await service.acceptSourceUpdate(open.id);
  assert(extendAccepted.endDate === "2026-10-19", "Accept applies the extra day");
  assert((extendAccepted.meetVersion || 1) === 2, "adding a day increments meetVersion");
  assert(Boolean(extendAccepted.parentUpdateBanner), "families must confirm Attend after a date change");
  const afterExtend = await store.getCommitment(open.id, "test-swimmer-elena");
  assert(afterExtend?.availableSessionIds.join(",") === originalDays.join(","), "Oct 17–18 stay selected on a longer meet");
  const reviewExtend = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(reviewExtend.review.requiresEventReview === true, "API flags event review from meetVersion, not banner text");
  assert(reviewExtend.review.updateReason.includes("dates_changed"), "updateReason tells the app why");
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: originalDays,
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  const afterConfirmExtend = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(afterConfirmExtend.review.requiresEventReview === false, "re-Attend stores responseVersion");

  const movedWeekend = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey
      ? { ...item, announcementUrl: v2Url, announcementText: updatedText, startDate: "2026-10-24", endDate: "2026-10-25" }
      : item
  );
  await service.ingestPns(movedWeekend, { isTestData: true });
  const waitingMove = await service.getAdminMeet(open.id);
  assert(waitingMove?.pendingSourceReview === true, "moved dates flag Has updates");
  const parentOldDates = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(parentOldDates.meet.startDate === "2026-10-17", "family still sees Oct 17 until Accept");
  const moved = await service.acceptSourceUpdate(open.id);
  assert(moved.startDate === "2026-10-24", "Accept writes the new weekend");
  assert(Boolean(moved.parentUpdateBanner), "parents are asked to re-pick days");
  const pruned = await store.getCommitment(open.id, "test-swimmer-elena");
  assert((pruned?.availableSessionIds || []).length === 0, "old days are cleared");
  assert(pruned?.attendance === "attend", "they stay marked Attending until they update");
  const afterMove = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(afterMove.canRespond === true && afterMove.canEdit === true, "Attend stays available after the date change");
  assert(Boolean(afterMove.meet.parentUpdateBanner), "parent page shows the re-pick prompt");
  assert(afterMove.review.requiresEventReview === true, "moved dates require a new Attend save");
  assert((moved.meetVersion || 1) >= 3, "each accepted date change increments meetVersion");
  const updated = await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: ["2026-10-24", "2026-10-25"],
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  assert(updated.attendance === "attend", "parent can tap Attend with the new days");
  const cleared = await service.getAdminMeet(open.id);
  assert(!cleared?.parentUpdateBanner, "prompt clears after they save new days");
  const confirmed = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(confirmed.review.requiresEventReview === false, "responseVersion matches meetVersion after Attend");
  try {
    await service.getParentDetail({
      meetId: open.id,
      swimmerId: "test-swimmer-leo",
      parentUID: TEST_PARENT_WITH_ID.uid,
      email: TEST_PARENT_WITH_ID.email,
      nowIso: TEST_NOW,
    });
    throw new Error("should hide another family's swimmer");
  } catch (e) {
    assert(e instanceof MeetServiceError && e.status === 404, "non-household swimmerId is 404");
  }
}

async function testLocationNoticeAndClosedReview() {
  const { service } = await seedWorld();
  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets(TEST_NOW)).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.publishToFamilies(open.id);
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: meetDayOptions(open).map((day) => day.id),
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });

  const movedPool = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey ? { ...item, location: "Bellevue Aquatic Center" } : item
  );
  await service.ingestPns(movedPool, { isTestData: true });
  const accepted = await service.acceptSourceUpdate(open.id);
  assert(accepted.location === "Bellevue Aquatic Center", "Accept writes the new venue");
  assert((accepted.meetVersion || 1) === 1, "location change does not increment meetVersion");
  assert((accepted.noticeVersion || 0) === 1, "location change increments noticeVersion");
  const afterMove = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(afterMove.review.requiresEventReview === false, "location change is not an event review");
  assert(afterMove.review.requiresMeetAcknowledgement === true, "attending family sees a location notice");
  assert(afterMove.review.noticeReason === "location_changed", "noticeReason is location_changed");
  const cards = await service.listParentMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email, "test-swimmer-elena", {
    nowIso: TEST_NOW,
  });
  assert(cards.find((card) => card.meetId === open.id)?.requiresMeetAcknowledgement === true, "dashboard card carries the location notice");
  const upcoming = await service.listUpcomingSwimmerMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email, {
    nowIso: TEST_NOW,
  });
  assert(upcoming.find((row) => row.meetId === open.id)?.canRespond === true, "upcoming includes canRespond while RSVP is open");
  await service.acknowledgeParentMeet({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    acknowledge: ["notice"],
    nowIso: TEST_NOW,
  });
  const clearedNotice = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(clearedNotice.review.requiresMeetAcknowledgement === false, "acknowledgement clears the location notice");

  const extraDay = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey ? { ...item, location: "Bellevue Aquatic Center", endDate: "2026-10-19" } : item
  );
  await service.ingestPns(extraDay, { isTestData: true });
  const dateAccepted = await service.acceptSourceUpdate(open.id);
  assert((dateAccepted.meetVersion || 1) === 2, "date change still increments meetVersion");
  try {
    await service.acknowledgeParentMeet({
      meetId: open.id,
      swimmerId: "test-swimmer-elena",
      parentUID: TEST_PARENT_WITH_ID.uid,
      acknowledge: ["closed_review"],
      nowIso: TEST_NOW,
    });
    throw new Error("should not acknowledge a still-open event review");
  } catch (e) {
    assert(e instanceof MeetServiceError, "open RSVP must re-Attend instead of acknowledging");
  }

  const afterDeadline = "2026-10-11T12:00:00";
  const closed = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: afterDeadline,
  });
  assert(closed.review.requiresEventReview === true, "event change after deadline still flags review");
  assert(closed.canRespond === false && closed.canEdit === false, "parents cannot save Attend after deadline");
  assert(closed.review.eventReviewAction === "contact_prime", "closed review tells the app to contact Prime");
  const closedCards = await service.listParentMeets(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email, "test-swimmer-elena", {
    nowIso: afterDeadline,
  });
  const closedCard = closedCards.find((card) => card.meetId === open.id);
  assert(closedCard?.requiresEventReview === true && closedCard.canRespond === false, "dashboard summary carries closed-review flags");
  await service.acknowledgeParentMeet({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    acknowledge: ["closed_review"],
    nowIso: afterDeadline,
  });
  const dismissed = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: afterDeadline,
  });
  assert(dismissed.review.requiresEventReview === false, "closed-review acknowledgement clears Action Required");
}

async function testParentCardsAttendDeclineAndHasUpdates() {
  const { store, service } = await seedWorld();
  const mia: MeetSwimmer = {
    id: "test-swimmer-mia",
    childFirstName: "[TEST] Mia",
    childLastName: "Chen",
    childDateOfBirth: "2017-08-01",
    childGender: "female",
    parentUID: TEST_PARENT_WITH_ID.uid,
    isTestData: true,
  };
  await store.saveSwimmer(mia);

  await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const open = (await service.listAdminMeets(TEST_NOW)).find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.publishToFamilies(open.id);
  const days = meetDayOptions(open).map((day) => day.id);

  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: days,
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-mia",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "decline",
    availableSessionIds: [],
    selectedEventIds: [],
    parentNotes: "Cannot make this weekend.",
    nowIso: TEST_NOW,
  });

  const dashAfterRsvp = await service.listParentDashboard(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  const elenaCards = dashAfterRsvp.meetsBySwimmer["test-swimmer-elena"] || [];
  const miaCards = dashAfterRsvp.meetsBySwimmer["test-swimmer-mia"] || [];
  const today = "2026-09-01";
  assert(
    elenaCards.some((card) => card.meetId === open.id && isSwimmerUpcomingMeetCard(card, today)),
    "Attend stays on the swimmer upcoming card"
  );
  assert(
    !miaCards.some((card) => card.meetId === open.id && isSwimmerUpcomingMeetCard(card, today)),
    "Decline does not appear on the swimmer upcoming card"
  );
  assert(
    !dashAfterRsvp.upcoming.some((row) => row.swimmerId === "test-swimmer-mia"),
    "upcoming API omits the child who Declined"
  );

  const hasUpdate = mockPnsCalendarItems().map((item) =>
    item.sourceId === open.sourceKey
      ? {
          ...item,
          startDate: "2026-10-24",
          endDate: "2026-10-25",
          location: "Bellevue Aquatic Center",
          eventFileUrl: "https://example.test/open-challenge.hyv",
          announcementUrl: "https://example.test/open-challenge-v2.pdf",
          announcementText: `${item.announcementText}\nVenue and weekend moved.`,
        }
      : item
  );
  await service.ingestPns(hasUpdate, { isTestData: true });
  const waiting = await service.getAdminMeet(open.id, TEST_NOW);
  assert(waiting?.pendingSourceReview === true, "date + location + event file flag Has updates");
  assert(filterAdminMeetList([waiting!], "has_updates").length === 1, "admin Has updates list includes this meet");
  const parentWhileWaiting = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(parentWhileWaiting.meet.startDate === "2026-10-17", "family still sees the old weekend until Accept");
  assert(parentWhileWaiting.meet.location === "Mary Wayte Pool", "family still sees the old venue until Accept");
  assert(parentWhileWaiting.review.requiresEventReview === false, "Has updates is not live for families until Accept");

  const accepted = await service.acceptSourceUpdate(open.id);
  assert(accepted.startDate === "2026-10-24" && accepted.location === "Bellevue Aquatic Center", "Accept writes the new weekend and venue");
  assert((accepted.meetVersion || 1) === 2, "date change increments meetVersion");
  assert((accepted.noticeVersion || 0) === 1, "location change increments noticeVersion");
  const afterAccept = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(afterAccept.review.requiresEventReview === true, "attending family must reconfirm days after the date change");
  assert(afterAccept.review.requiresMeetAcknowledgement === true, "attending family must see the location notice");
  assert(afterAccept.review.eventReviewAction === "reconfirm", "RSVP is still open so they can save Attend again");
  const declinedAfterAccept = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-mia",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(declinedAfterAccept.review.requiresEventReview === false, "Decline does not get event review");
  assert(declinedAfterAccept.review.requiresMeetAcknowledgement === false, "Decline does not get a location notice");

  const withFile = await service.importEventFile(open.id, loadTestTacHyv(), { accept: true });
  assert((withFile.meetVersion || 1) >= 3, "accepting the Event File increments meetVersion again");
  assert((withFile.updateReason || []).includes("event_file_changed"), "updateReason records the Event File");
  const afterFile = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(afterFile.hasEventFile === true, "Event File unlocks official event checkboxes");
  assert(afterFile.review.requiresEventReview === true, "Event File after Attend still requires a new Attend save");
  const picked = afterFile.eligibleEvents.filter((event) => event.sessionName === "Saturday").slice(0, 2).map((event) => event.id);
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    attendance: "attend",
    availableSessionIds: meetDayOptions(afterFile.meet).filter((day) => /sat/i.test(day.label)).map((day) => day.id),
    selectedEventIds: picked,
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  const confirmed = await service.getParentDetail({
    meetId: open.id,
    swimmerId: "test-swimmer-elena",
    parentUID: TEST_PARENT_WITH_ID.uid,
    email: TEST_PARENT_WITH_ID.email,
    nowIso: TEST_NOW,
  });
  assert(confirmed.review.requiresEventReview === false, "re-Attend clears event review");
  assert(confirmed.review.requiresMeetAcknowledgement === false, "re-Attend also clears the location notice");

  const dashAfter = await service.listParentDashboard(TEST_PARENT_WITH_ID.uid, TEST_PARENT_WITH_ID.email);
  const upcoming = dashAfter.upcoming.filter((row) => row.meetId === open.id);
  assert(upcoming.length === 1 && upcoming[0].swimmerId === "test-swimmer-elena", "after updates, only the attending child stays on upcoming");
  assert((upcoming[0].events.length || 0) === picked.length, "upcoming card lists the events she reconfirmed");
}

async function testPublicCatalogHidesTestMeets() {
  const { service } = await seedWorld();
  const ingested = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const testOpen = ingested.find((m) => meetMatchesSource(m, "open-challenge"))!;
  await service.publishToFamilies(testOpen.id);
  assert((await service.listPublicMeets()).length === 0, "TEST fixtures stay off the public catalog");
  try {
    await service.getPublicMeet(testOpen.id);
    throw new Error("TEST meet should not be public");
  } catch (e) {
    assert(e instanceof MeetServiceError, "anonymous viewers cannot open a TEST meet");
  }
  const live = await service.ingestPns(
    mockPnsCalendarItems()
      .filter((item) => item.sourceId.includes("open-challenge"))
      .map((item) => ({ ...item, sourceId: "pns-1747001", name: "2026 PN Public Open Challenge" })),
    { isTestData: false }
  );
  const published = await service.publishToFamilies(live[0].id);
  const catalog = await service.listPublicMeets();
  assert(catalog.some((card) => card.meetId === published.id), "published production meet is on the public catalog");
  assert((catalog.find((card) => card.meetId === published.id)?.swimmerResponses || []).length === 0, "public cards have no child RSVP");
  const detail = await service.getPublicMeet(published.id);
  assert(detail.meet.name.includes("Public Open"), "public detail shows the meet title");
  assert(Boolean(detail.announcementUrl), "public detail keeps the announcement link");
}

async function run() {
  await testPnsIngestAndMeetTypes();
  await testRejectKeepsMeetOffFamilyList();
  await testPublishedPnsUpdateWaitsForAccept();
  await testHasUpdatesDateChangeParentRsvp();
  await testLocationNoticeAndClosedReview();
  await testParentCardsAttendDeclineAndHasUpdates();
  await testUsaIdGateUsesClubOmrLink();
  await testInvitationalEventFlowAndCuts();
  await testIsolationSharedDatabase();
  await testDeadlineAutoCloseAndHostEmail();
  await testComposeRequiresSelections();
  await testDeclineWithoutUsaIdAndPayment();
  await testDeadlineCloseDrillAutoCloses();
  await testFinalInvoiceUsesEventFeesAndAdminRates();
  await testPublicCatalogHidesTestMeets();
  console.log("meets.integration.test.ts passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
