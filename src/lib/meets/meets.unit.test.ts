import { ageOnDate, detectInvitationRequired, eventMatchesSwimmer, extractEligibilityNotes, inferInvitationStatus, eventsForSwimmer } from "./eligibility";
import { effectiveHostDeadline, isMeetPaymentOverdue, isPrimeDeadlinePassed, meetPaymentDueAt, addCalendarDays, suggestPrimeDeadline } from "./deadlines";
import { computeHostFee, exceedsEventLimits, extractFeeHints } from "./fees";
import { loadComHalloweenHyv, loadMexicoSprintEv3, loadTestTacHyv, mockDraftMeets, TAC_ANNOUNCEMENT_TEXT, TEST_OMR_URL } from "./fixtures";
import { applyPendingSourcePatch, applyTeamUnifyDetail, calendarItemToDraftMeet, inferHostClubFromTitle, mapTeamUnifyListRow, mergePnsUpdates, parsePnsCalendarHtml } from "./pns-calendar";
import { pnsEventPageUrl } from "./pns-url";
import { eventLabel, parseHytekEventFile } from "./hytek-events";
import { canViewerSeeMeet, isTestEmail, isTestNamed, markTestName } from "./test-data";
import { isOmrWelcomeUrl, isValidUsaSwimmingId, usaSwimmingAttendGate } from "./usa-swimming";
import { parseAnnouncementBlocks } from "./announcement-format";
import { adminMeetGuide, canParentEditCommitment, canPublishToFamilies, displayedEventIds, finalSwimEventIds, isMeetLineupFinalized, parentEventLabel, shouldAutoCloseRsvp, statusAfterApprove } from "./workflow";
import { serializeMeetEntry } from "./entries";
import { PRIME_SWIM_OMR_URL, resolveClubMeetSettings, type Meet, type MeetCommitment, type MeetEvent } from "./types";
import { classifyAdminMeetList, countAdminMeetList, filterAdminMeetList } from "./list-filter";
import { composePnsAdminAlert, pnsScanNeedsAdminAlert } from "./pns-notify";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function ev(partial: Partial<MeetEvent> & Pick<MeetEvent, "id" | "eventNumber" | "minAge" | "maxAge">): MeetEvent {
  return {
    sessionName: "Saturday",
    gender: "mixed",
    distance: 50,
    stroke: "free",
    course: "scy",
    ...partial,
  };
}

function testEligibility() {
  assert(ageOnDate("2015-03-12", "2026-09-26") === 11, "Elena is 11 on meet day");
  assert(ageOnDate("2018-06-20", "2026-09-26") === 8, "Leo is 8 on meet day");
  assert(eventMatchesSwimmer(ev({ id: "e3", eventNumber: 3, minAge: 11, maxAge: 12 }), 11, "female"), "11yo matches 11-12");
  assert(!eventMatchesSwimmer(ev({ id: "e3", eventNumber: 3, minAge: 11, maxAge: 12 }), 8, "male"), "8yo does not match 11-12");
  assert(detectInvitationRequired("THIS MEET IS AN INVITATIONAL."), "invitational text");
  assert(!detectInvitationRequired("Competition will be open to all swimmers domiciled within PNS."), "open text");
  const notes = extractEligibilityNotes(
    "THIS MEET IS AN INVITATIONAL. All swimmers must be registered with USA Swimming and Pacific Northwest Swimming in compliance with Article 302. Age groups are based on the age of the swimmer as of the first day of the meet."
  );
  assert(notes.some((n) => /invitational/i.test(n)), "shows invitational note");
  assert(notes.some((n) => /USA Swimming/i.test(n)), "shows membership note");
  assert(notes.some((n) => /first day/i.test(n)), "shows age-up note");
  assert(inferInvitationStatus("THIS MEET IS AN INVITATIONAL.") === "not_requested", "invitational starts unrequested");
  assert(inferInvitationStatus("open to all swimmers") === "not_required", "open skips invitation");
  assert(inferInvitationStatus("2026 PN SSCD Autumn Open Approval #2610-SP08") === "not_required", "title Open without invitational language is open");
  assert(
    inferInvitationStatus("2026 PN TAC Fall Pentathlon and Distance Open\nTHIS MEET IS AN INVITATIONAL.") === "not_requested",
    "announcement invitational wins over Open in the title"
  );
}

function testDeadlinesAndFees() {
  assert(effectiveHostDeadline({ pnsPublishedDeadline: "2026-09-15" }) === "2026-09-15", "pns fallback");
  assert(
    effectiveHostDeadline({
      hostConfirmedDeadline: "2026-09-12",
      announcementEntryDeadline: "2026-09-15",
    }) === "2026-09-12",
    "host confirmed wins"
  );
  assert(suggestPrimeDeadline("2026-09-15T23:59:00") === "2026-09-08T23:59:00", "prime is host − 7 days 11:59");
  assert(isPrimeDeadlinePassed("2026-09-08T23:59:00", "2026-09-08T23:59:00") === false, "deadline day stays open");
  assert(isPrimeDeadlinePassed("2026-09-08T23:59:00", "2026-09-09T00:00:00") === true, "closes the next Pacific day");
  assert(canParentEditCommitment("commitment_open", "2026-09-08T12:00:00", "2026-09-08T23:59:00") === true, "edit on deadline day");
  assert(canParentEditCommitment("commitment_open", "2026-09-09T00:05:00", "2026-09-08T23:59:00") === false, "no edit next day");
  assert(shouldAutoCloseRsvp({ status: "commitment_open", primeCommitmentDeadline: "2026-09-08T23:59:00" }, "2026-09-09T08:00:00"), "auto-close next day");
  assert(!shouldAutoCloseRsvp({ status: "commitment_open", primeCommitmentDeadline: "2026-09-08T23:59:00" }, "2026-09-08T20:00:00"), "not yet on deadline day");
  const hints = extractFeeHints(TAC_ANNOUNCEMENT_TEXT);
  assert(hints.surcharge === 25 && hints.individualEventFee === 4.5, "TAC fees from announcement");
  assert(hints.maxEventsMeet === 8 && hints.maxEventsBySession?.Saturday === 5, "TAC limits from announcement");
  const fee = computeHostFee({ surcharge: 25, individualEventFee: 4.5, eventCount: 5 });
  assert(fee.total === 47.5, "25 + 4.50×5");
  assert(exceedsEventLimits({ selectedCount: 9, maxEventsMeet: 8, sessionCounts: {} }).ok === false, "meet cap");
  assert(
    exceedsEventLimits({
      selectedCount: 6,
      maxEventsMeet: 8,
      sessionCounts: { Saturday: 6 },
      maxEventsBySession: { Saturday: 5, Sunday: 3 },
    }).ok === false,
    "Saturday cap"
  );
}

function testUsaSwimmingAndIsolation() {
  assert(isValidUsaSwimmingId("TESTUSA11ELENA"), "valid fake USA ID");
  assert(!isValidUsaSwimmingId(""), "empty ID blocked");
  const blocked = usaSwimmingAttendGate({
    usaSwimmingId: "",
    omrUrl: TEST_OMR_URL,
  });
  assert(blocked.canAttend === false, "no ID cannot attend");
  assert(blocked.registerUrl === TEST_OMR_URL, "test CTA stays on the fake OMR URL");
  assert(isOmrWelcomeUrl(blocked.registerUrl), "OMR host/path check");
  assert(isOmrWelcomeUrl(PRIME_SWIM_OMR_URL), "club OMR link is a USA Swimming welcome URL");
  assert(PRIME_SWIM_OMR_URL === "https://omr.usaswimming.org/omr/welcome/7E8545DBBFD70C", "club OMR is the Prime link");
  assert(!PRIME_SWIM_OMR_URL.includes("TEST-PRIME-SWIM-FAKE"), "production OMR is not the [TEST] fixture URL");
  assert(usaSwimmingAttendGate({ usaSwimmingId: "", omrUrl: PRIME_SWIM_OMR_URL }).registerUrl === PRIME_SWIM_OMR_URL, "parents get the club OMR");
  assert(resolveClubMeetSettings({ usaSwimmingOmrUrl: "" }).usaSwimmingOmrUrl === PRIME_SWIM_OMR_URL, "empty setting falls back to club OMR");
  assert(canViewerSeeMeet({ meetIsTestData: true, viewerIsTestAccount: false }) === false, "real parent hidden from test meet");
  assert(canViewerSeeMeet({ meetIsTestData: false, viewerIsTestAccount: true }) === false, "test parent hidden from prod meet");
  assert(isTestNamed("[TEST] 2026 PN TAC Fall Pentathlon"), "name prefix");
  assert(markTestName("Open Challenge") === "[TEST] Open Challenge", "auto prefix");
  assert(isTestEmail("parent.withid+meetstest@prime-swim.test"), "test email marker");
  assert(!isTestEmail("real.parent@example.com"), "prod email not test");
}

function testWorkflow() {
  assert(statusAfterApprove("not_requested") === "invitation_pending", "invitational stays pending");
  assert(statusAfterApprove("not_required") === "ready_to_publish", "open can approve");
  assert(statusAfterApprove("invited") === "ready_to_publish", "invited can approve");
  assert(canPublishToFamilies({ invitationStatus: "not_requested", status: "ready_to_publish" }).ok === false, "lock publish");
  assert(canPublishToFamilies({ invitationStatus: "invited", status: "ready_to_publish" }).ok === true, "invited publish");
  assert(canPublishToFamilies({ invitationStatus: "invited", status: "draft" }).ok === true, "publish from draft after invite");
  assert(canPublishToFamilies({ invitationStatus: "not_required", status: "draft" }).ok === true, "open publish from draft");
  assert(canPublishToFamilies({ invitationStatus: "not_required", status: "ready_to_publish" }).ok === true, "open publish");
  assert(parentEventLabel("cancelled") === "hidden", "rejected/cancelled stays off family pages");
  assert(parentEventLabel("submitted") === "pending_for_review", "submitted is still pending");
  assert(parentEventLabel("host_reply_received") === "pending_for_review", "cuts not visible yet");
  assert(parentEventLabel("entries_confirmed") === "confirmed", "publish confirmed unlocks");
  assert(
    displayedEventIds({
      status: "submitted",
      selectedEventIds: ["e1", "e2"],
      confirmedEventIds: ["e1"],
    }).join(",") === "e1,e2",
    "pending shows requested, not cuts"
  );
  assert(
    displayedEventIds({
      status: "entries_confirmed",
      selectedEventIds: ["e1", "e2"],
      confirmedEventIds: ["e1"],
    }).join(",") === "e1",
    "confirmed shows remaining events"
  );
}

function testFinalEntriesAndPaymentDue() {
  assert(finalSwimEventIds({ attendance: "decline", status: "entries_confirmed", selectedEventIds: ["e1"] }).length === 0, "decline has no final events");
  assert(
    finalSwimEventIds({
      attendance: "attend",
      status: "entries_confirmed",
      selectedEventIds: ["e1", "e2"],
      confirmedEventIds: ["e2"],
    }).join(",") === "e2",
    "final events are confirmed after host cuts"
  );
  assert(isMeetLineupFinalized("entries_confirmed"), "confirmed is finalized");
  assert(!isMeetLineupFinalized("submitted"), "submitted is not finalized");
  assert(addCalendarDays("2026-10-03", 7) === "2026-10-10", "due date is +7 calendar days");
  assert(meetPaymentDueAt("2026-10-03T18:00:00") === "2026-10-10T23:59:00", "invoice due one week after confirm");
  assert(isMeetPaymentOverdue("2026-10-10T23:59:00", "2026-10-11T08:00:00"), "overdue the next Pacific day");
  const meet = {
    id: "m1",
    name: "Open",
    hostClub: "Host",
    meetType: "open",
    course: "scy",
    startDate: "2026-10-17",
    endDate: "2026-10-18",
    location: "Pool",
    eligibilityStatus: "likely_eligible",
    invitationStatus: "not_required",
    eligibilityNotes: [],
    deadlineTimezone: "America/Los_Angeles",
    status: "entries_confirmed",
    sessions: [],
    events: [ev({ id: "e2", eventNumber: 3, minAge: 11, maxAge: 12, stroke: "fly" })],
    isTestData: true,
    entriesConfirmedAt: "2026-10-03T18:00:00",
  } as Meet;
  const commitment = {
    id: "c1",
    meetId: "m1",
    swimmerId: "s1",
    parentUID: "p1",
    attendance: "attend",
    availableSessionIds: ["saturday"],
    selectedEventIds: ["e1", "e2"],
    confirmedEventIds: ["e2"],
    parentNotes: "",
    finalFee: 21,
    paymentStatus: "invoice_ready",
    isTestData: true,
  } as MeetCommitment;
  const entry = serializeMeetEntry(meet, commitment, {
    id: "s1",
    childFirstName: "Elena",
    childLastName: "Test",
    childDateOfBirth: "2015-03-12",
    parentUID: "p1",
  });
  assert(entry.finalEventIds.join(",") === "e2", "export uses confirmed events");
  assert(entry.requestedEventIds.join(",") === "e1,e2", "export keeps the parent request");
  assert(entry.finalEvents[0]?.label.includes("50"), "export includes labels");
}

function testAdminGuide() {
  const openDraft = adminMeetGuide({
    status: "draft",
    meetType: "open",
    invitationStatus: "not_required",
  });
  assert(openDraft.current === "publish", "open meet skips invitation and starts at publish");
  assert(openDraft.steps[0].state === "skipped", "ask-host is skipped for open meets");
  assert(openDraft.steps[1].state === "current", "publish is the current step");
  assert(openDraft.steps[2].state === "locked", "RSVP tools stay locked until publish");

  const invitational = adminMeetGuide({
    status: "invitation_pending",
    meetType: "invitational",
    invitationStatus: "not_requested",
  });
  assert(invitational.current === "ask_host", "invitational starts by asking the host");
  assert(invitational.steps[1].state === "locked", "publish is hidden until invited");

  const waiting = adminMeetGuide({
    status: "invitation_pending",
    meetType: "invitational",
    invitationStatus: "requested",
  });
  assert(waiting.current === "ask_host", "still waiting after asking");
  assert(/Waiting/.test(waiting.nextTitle), "copy says waiting for the host");

  const invited = adminMeetGuide({
    status: "ready_to_publish",
    meetType: "invitational",
    invitationStatus: "invited",
    primeCommitmentDeadline: "2026-09-25T23:59:00",
  });
  assert(invited.current === "publish", "invited invitational can publish");
  assert(invited.steps[0].state === "done", "ask-host is complete after invite");

  const rsvp = adminMeetGuide({
    status: "commitment_open",
    meetType: "open",
    invitationStatus: "not_required",
    primeCommitmentDeadline: "2026-09-25T23:59:00",
  });
  assert(rsvp.current === "collect_rsvp", "published meet is collecting RSVPs");
  assert(rsvp.steps.find((s) => s.id === "send_entries")?.state === "locked", "entry email stays locked while RSVP is open");

  const send = adminMeetGuide({
    status: "commitment_closed",
    meetType: "open",
    invitationStatus: "not_required",
  });
  assert(send.current === "send_entries", "closed RSVP unlocks the entry letter");

  const reply = adminMeetGuide({
    status: "submitted",
    meetType: "open",
    invitationStatus: "not_required",
  });
  assert(reply.current === "host_reply", "after send, record the host reply");

  const confirm = adminMeetGuide({
    status: "host_reply_received",
    meetType: "open",
    invitationStatus: "not_required",
  });
  assert(confirm.current === "confirm_families", "cuts then show confirmed");

  const done = adminMeetGuide({
    status: "entries_confirmed",
    meetType: "open",
    invitationStatus: "not_required",
  });
  assert(done.current === "done", "confirmed meet is finished");
  assert(done.steps.every((s) => s.state === "done" || s.state === "skipped"), "all action steps complete");
}

function testPnsHtmlParse() {
  const html = `
    <article class="event"><h3 class="event-name">2026 PN Open Age Group Challenge</h3>
    <div>2026-10-17 2026-10-18</div><div class="location">Mary Wayte Pool</div>
    <a href="https://example.test/open.pdf">PDF</a></article>
    <article class="event"><h3 class="event-name">2026 PN TAC Fall Pentathlon</h3>
    <div>2026-09-26 2026-09-27</div><a href="https://example.test/tac.pdf">PDF</a></article>
  `;
  const items = parsePnsCalendarHtml(html);
  assert(items.length >= 2, "parses two PNS events");
  assert(items.some((i) => /Pentathlon/i.test(i.name) && Boolean(i.announcementUrl?.endsWith(".pdf"))), "keeps announcement PDF");
}

function testMeetIdsAreGuids() {
  const a = mockDraftMeets()[0];
  const b = mockDraftMeets()[0];
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a.id), "meet URL id is a GUID");
  assert(a.id !== b.id, "same meet name does not reuse an id");
  assert((a.sourceKey || "").includes("tac"), "PNS source key stays stable for ingest merge");
}

function testAnnouncementReadability() {
  const blocks = parseAnnouncementBlocks(TAC_ANNOUNCEMENT_TEXT);
  assert(blocks.some((b) => b.kind === "hosted" && /Thunderbird/i.test(b.club)), "hosted by club is structured");
  assert(blocks.some((b) => b.kind === "deadline"), "deadline callout");
  assert(blocks.some((b) => b.kind === "warning" && /invitational/i.test(b.text)), "invitational warning");
  assert(blocks.some((b) => b.kind === "fees" && /25/.test(b.text)), "fee callout");
}

function testHyvImport() {
  const parsed = parseHytekEventFile(loadTestTacHyv());
  assert(parsed.meetName.startsWith("[TEST]"), "HYV meet name is marked test data");
  assert(parsed.events.length >= 30, "TAC-like event count");
  assert(parsed.course === "scy", "yards course");
  assert(parsed.events.some((e) => e.eventNumber === 3 && e.minAge === 11 && e.stroke === "fly"), "event 3 is 11-12 fly");
  assert(parsed.events.some((e) => e.eventNumber === 26 && e.sessionName === "Sunday"), "distance session Sunday");
  assert(eventLabel(parsed.events[0]).includes("25"), "label includes distance");
  const elenaEvents = eventsForSwimmer(
    {
      startDate: "2026-09-26",
      events: parsed.events,
    } as never,
    { childDateOfBirth: "2015-03-12", childGender: "female" } as never
  );
  assert(elenaEvents.some((e) => e.eventNumber === 3), "11yo sees Saturday 11-12");
  assert(elenaEvents.some((e) => e.eventNumber === 26), "11yo sees Sunday 500");
  assert(!elenaEvents.some((e) => e.eventNumber === 1), "11yo does not see 8&U 25 fly");
}

function testLiveEventFiles() {
  const ev3 = parseHytekEventFile(loadMexicoSprintEv3());
  assert(ev3.meetName.includes("Sprint Spectacular"), "Mexico EV3 meet name");
  assert(ev3.location.includes("Marshall"), "Mexico EV3 venue");
  assert(ev3.startDate === "2026-06-20" && ev3.endDate === "2026-06-20", "Mexico EV3 date");
  assert(ev3.course === "lcm", "Mexico EV3 is long course");
  assert(ev3.events.length >= 80, "Mexico EV3 event count");
  const ev1 = ev3.events.find((e) => e.eventNumber === 1);
  assert(Boolean(ev1 && ev1.gender === "female" && ev1.distance === 200 && ev1.stroke === "im" && ev1.minAge === 13 && ev1.maxAge >= 109), "EV3 event 1 is girls 13&O 200 IM");
  assert(ev3.events.some((e) => e.eventNumber === 3 && e.distance === 50 && e.stroke === "free" && e.maxAge === 8), "EV3 event 3 is 8&U 50 free");
  assert(ev3.events.every((e) => e.eventFee === 7), "Mexico EV3 individual fee is $7");

  const hyv = parseHytekEventFile(loadComHalloweenHyv());
  assert(hyv.meetName.includes("Halloween Invitational"), "COM HYV meet name");
  assert(hyv.location.includes("FMH"), "COM HYV venue");
  assert(hyv.startDate === "2026-10-31" && hyv.course === "scy", "COM HYV is short course Halloween");
  assert(hyv.events.length === 24, "COM HYV event count");
  assert(hyv.events.some((e) => e.eventNumber === 1 && e.isRelay && e.stroke === "free" && e.distance === 200 && e.eventFee === 16), "COM HYV event 1 is 200 free relay $16");
  assert(hyv.events.some((e) => e.eventNumber === 5 && !e.isRelay && e.stroke === "fly" && e.distance === 50 && e.eventFee === 8), "COM HYV event 5 is 50 fly $8");
  assert(hyv.events.filter((e) => e.maxAge >= 109).length === 24, "COM open-age 0;0 becomes Open");
}

function testAdminMeetListFilter() {
  const today = "2026-09-14";
  assert(classifyAdminMeetList({ startDate: "2026-10-17", endDate: "2026-10-18", status: "commitment_open" }, today) === "upcoming", "future meet is upcoming");
  assert(classifyAdminMeetList({ startDate: "2026-10-17", endDate: "2026-10-18", status: "admin_review" }, today) === "needs_review", "unpublished draft stays in review");
  assert(classifyAdminMeetList({ startDate: "2026-09-14", endDate: "2026-09-15", status: "commitment_open" }, today) === "in_process", "meet weekend is in process");
  assert(classifyAdminMeetList({ startDate: "2026-09-05", endDate: "2026-09-06", status: "entries_confirmed" }, today) === "past", "ended meet is past");
  assert(classifyAdminMeetList({ startDate: "2026-09-20", endDate: "2026-09-20", status: "cancelled" }, today) === "past", "cancelled meets go to archive");
  const listed = filterAdminMeetList(
    [
      { startDate: "2026-10-17", endDate: "2026-10-18", status: "entries_confirmed", name: "Open" },
      { startDate: "2026-09-26", endDate: "2026-09-27", status: "commitment_open", name: "UPAC" },
      { startDate: "2026-09-05", endDate: "2026-09-05", status: "commitment_closed", name: "Old" },
    ],
    "upcoming",
    today
  );
  assert(listed.map((m) => m.name).join(",") === "UPAC,Open", "upcoming is soonest first and hides past");
  const counts = countAdminMeetList(
    [
      { startDate: "2026-10-17", endDate: "2026-10-18", status: "entries_confirmed", name: "Open" },
      { startDate: "2026-09-14", endDate: "2026-09-15", status: "commitment_open", name: "Now" },
      { startDate: "2026-09-05", endDate: "2026-09-05", status: "commitment_closed", name: "Old" },
      { startDate: "2026-09-26", endDate: "2026-09-27", status: "admin_review", name: "Draft" },
    ],
    today
  );
  assert(counts.upcoming === 1 && counts.in_process === 1 && counts.past === 1 && counts.needs_review === 1, "counts split exclusive buckets");
  const updates = filterAdminMeetList(
    [
      { startDate: "2026-10-17", endDate: "2026-10-18", status: "commitment_open", name: "Open", pendingSourceReview: true, pendingSourceDiffs: ["announcement PDF changed"] },
      { startDate: "2026-09-26", endDate: "2026-09-27", status: "commitment_open", name: "UPAC" },
    ],
    "has_updates",
    today
  );
  assert(updates.map((m) => m.name).join(",") === "Open", "Has updates only shows pending PNS changes");
}

function testPnsTeamUnifyMap() {
  assert(inferHostClubFromTitle("2026 PN TAC Fall Pentathlon") === "TAC", "host code from title");
  const item = mapTeamUnifyListRow({
    id: { value: 1747079 },
    title: { value: "2026 PN TAC Fall Pentathlon and Distance Open – Approval #2609-SP05" },
    startDate: { displayValueISO: "2026-09-26" },
    endDate: { displayValueISO: "2026-09-27" },
    location: { value: "Fidalgo Pool" },
  });
  assert(item.sourceId === "pns-1747079", "stable PNS source id");
  assert(item.hostClub === "TAC", "TAC host");
  assert(
    pnsEventPageUrl(item.sourceId) === "https://www.pns.org/EventShow.jsp?id=1747079&team=pnws2",
    "per-meet PNS event page"
  );
  const draft = calendarItemToDraftMeet(item, { isTestData: false });
  assert(draft.sourceUrl === pnsEventPageUrl(item.sourceId), "ingest stores the PNS event page");
  assert(pnsEventPageUrl("test-pns-tac-pentathlon").includes("/page/calendar"), "TEST keys fall back to calendar");
  const detailed = applyTeamUnifyDetail(item, {
    eventTitle: item.name,
    eventDescription: "<p>MEET DIRECTOR<br /><a href=\"mailto:gminkel@fidalgopool.com\">George</a></p>",
    registrationDeadline: "2026-09-15T23:59:59-07:00",
    eventDocuments: [{ url: "/pnws2/__eventform__/tac.pdf" }],
  });
  assert(detailed.registrationDeadline === "2026-09-15", "deadline from TeamUnify");
  assert(detailed.hostEntryEmail === "gminkel@fidalgopool.com", "host email from announcement");
  assert(Boolean(detailed.announcementUrl?.endsWith(".pdf")), "announcement PDF");
  assert((detailed.sourceFiles || []).some((f) => f.kind === "announcement"), "stores PNS files");
}

function testPnsUpdateMerge() {
  const incoming = {
    sourceId: "pns-1",
    name: "2026 PN TAC Fall Pentathlon",
    hostClub: "TAC",
    startDate: "2026-09-26",
    endDate: "2026-09-27",
    location: "Fidalgo Pool",
    announcementUrl: "https://www.pns.org/new-announcement.pdf",
    announcementText: "updated notes",
    eventFileUrl: "https://www.pns.org/events.hyv",
    sourceFiles: [
      { name: "new-announcement.pdf", url: "https://www.pns.org/new-announcement.pdf", kind: "announcement" as const },
      { name: "events.hyv", url: "https://www.pns.org/events.hyv", kind: "event_file" as const },
    ],
  };
  const draft = calendarItemToDraftMeet(
    { ...incoming, announcementUrl: "https://www.pns.org/old.pdf", eventFileUrl: undefined, sourceFiles: [] },
    { isTestData: true }
  );
  const draftMerge = mergePnsUpdates(draft, incoming);
  assert(draftMerge.changed, "draft sees PNS changes");
  assert(draftMerge.next.announcementUrl === incoming.announcementUrl, "unpublished draft applies announcement immediately");
  assert(draftMerge.next.eventFileUrl === incoming.eventFileUrl, "unpublished draft records event file");

  const published = { ...draft, status: "commitment_open" as const, announcementUrl: "https://www.pns.org/old.pdf" };
  const publishedMerge = mergePnsUpdates(published, incoming);
  assert(publishedMerge.next.announcementUrl === "https://www.pns.org/old.pdf", "published family page stays old until Accept");
  assert(publishedMerge.next.pendingSourcePatch?.announcementUrl === incoming.announcementUrl, "new announcement is stashed");
  assert(publishedMerge.diffs.some((d) => /event file/i.test(d)), "event file change is listed");
  const accepted = applyPendingSourcePatch({ ...publishedMerge.next, pendingSourceReview: true, pendingSourceDiffs: publishedMerge.diffs });
  assert(accepted.announcementUrl === incoming.announcementUrl, "Accept writes the new announcement");
  assert(!accepted.pendingSourceReview, "Accept clears the review flag");
  assert(pnsScanNeedsAdminAlert({ created: 0, updated: 0 }) === false, "quiet day does not email admin");
  assert(pnsScanNeedsAdminAlert({ created: 1, updated: 0 }) === true, "new draft emails admin");
  const alert = composePnsAdminAlert(
    {
      count: 2,
      created: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
      createdMeets: [{ id: "a", name: "2026 PN CSC Shakeout", diffs: [] }],
      updatedMeets: [{ id: "b", name: "2026 PN TAC Fall Pentathlon", diffs: ["announcement PDF changed"] }],
    },
    "https://example.test/admin/meets"
  );
  assert(/new meet/i.test(alert.subject), "alert subject mentions new meets");
  assert(/announcement PDF changed/.test(alert.text), "alert lists announcement updates");
}

function run() {
  testEligibility();
  testDeadlinesAndFees();
  testUsaSwimmingAndIsolation();
  testWorkflow();
  testFinalEntriesAndPaymentDue();
  testAdminGuide();
  testAdminMeetListFilter();
  testPnsHtmlParse();
  testPnsTeamUnifyMap();
  testPnsUpdateMerge();
  testMeetIdsAreGuids();
  testAnnouncementReadability();
  testHyvImport();
  testLiveEventFiles();
  console.log("meets.unit.test.ts passed");
}

run();
