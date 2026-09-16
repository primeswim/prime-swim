import { ageOnDate, detectInvitationRequired, eventMatchesSwimmer, extractEligibilityNotes, inferInvitationStatus, eventsForSwimmer } from "./eligibility";
import { effectiveHostDeadline, isMeetPaymentOverdue, isPrimeDeadlinePassed, meetPaymentDueAt, addCalendarDays, suggestPrimeDeadline } from "./deadlines";
import { computeHostFee, computeMeetEntryFee, exceedsEventLimits, extractFeeHints, typicalIndividualEventFee } from "./fees";
import { loadComHalloweenHyv, loadMexicoSprintEv3, loadTestTacHyv, mockDraftMeets, TAC_ANNOUNCEMENT_TEXT, TEST_OMR_URL } from "./fixtures";
import { applyPendingSourcePatch, applyTeamUnifyDetail, calendarItemToDraftMeet, inferHostClubFromTitle, mapTeamUnifyListRow, mergePnsUpdates, parentBannerForDayReselection, parentBannerForPnsDiffs, parsePnsCalendarHtml } from "./pns-calendar";
import { enrichCalendarItemWithAnnouncementFees, extractTextFromPdfBytes, sampleEntryFeeAnnouncementPdf } from "./announcement-pdf";
import { pnsEventPageUrl, meetAnnouncementUrl } from "./pns-url";
import { meetDayOptions, keepValidMeetDayIds, attendingNeedsNewDays, meetDateStamp, sessionNameForMeetDay } from "./sessions";
import { parentAttendanceLabel, parentRsvpNotice, swimmerMeetActionClass, listParentMeetCards, listPublicMeetCards, listUpcomingSwimmerMeets, isSwimmerUpcomingMeetCard, buildPublicMeetDetail } from "./parent-view";
import { eventLabel, eventName, ageGroupLabel, parseHytekEventFile, shortEventLabel } from "./hytek-events";
import { canViewerSeeMeet, isTestEmail, isTestNamed, markTestName } from "./test-data";
import { isOmrWelcomeUrl, isValidUsaSwimmingId, usaSwimmingAttendGate } from "./usa-swimming";
import { parseAnnouncementBlocks } from "./announcement-format";
import { displayMeetName } from "./display-name";
import { adminMeetGuide, canExportHostPacket, canParentEditCommitment, canPublishToFamilies, canReopenRsvp, displayedEventIds, finalSwimEventIds, isMeetLineupFinalized, parentEventLabel, shouldAutoCloseRsvp, statusAfterApprove } from "./workflow";
import { hostEntryCsv, hostEntryReportText, hostPacketFilename, serializeMeetEntry, canBuildHostSd3 } from "./entries";
import { hostEntrySd3 } from "./sd3";
import { PRIME_SWIM_OMR_URL, resolveClubMeetSettings, type Meet, type MeetCommitment, type MeetEvent, type MeetSwimmer } from "./types";
import { classifyAdminMeetList, countAdminMeetList, filterAdminMeetList } from "./list-filter";
import { classifyCalendarWhen } from "../calendar-when";
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
  assert(canParentEditCommitment("commitment_closed", "2026-09-08T12:00:00", "2026-09-08T23:59:00") === false, "closed RSVP cannot edit");
  assert(canReopenRsvp("commitment_closed") === true, "closed RSVP can reopen");
  assert(canReopenRsvp("commitment_open") === false, "open RSVP does not need reopen");
  assert(canReopenRsvp("submitted") === false, "do not reopen after sending to host");
  assert(shouldAutoCloseRsvp({ status: "commitment_open", primeCommitmentDeadline: "2026-09-08T23:59:00" }, "2026-09-09T08:00:00"), "auto-close next day");
  assert(!shouldAutoCloseRsvp({ status: "commitment_open", primeCommitmentDeadline: "2026-09-08T23:59:00" }, "2026-09-08T20:00:00"), "not yet on deadline day");
  const hints = extractFeeHints(TAC_ANNOUNCEMENT_TEXT);
  assert(hints.surcharge === 25 && hints.individualEventFee === 4.5, "TAC fees from announcement");
  const spaced = extractFeeHints("ENTRY FEES: Surcharge: $ 25.00 Individual event: $ 4.50");
  assert(spaced.surcharge === 25 && spaced.individualEventFee === 4.5, "fees still parse with a space after $");
  const pascPdf = extractFeeHints("ENTRY FEES: • Surcharge: $ 25.00 • Individual event: $ 4.50");
  assert(pascPdf.surcharge === 25 && pascPdf.individualEventFee === 4.5, "PASC announcement PDF ENTRY FEES");
  assert(hints.maxEventsMeet === 8 && hints.maxEventsBySession?.Saturday === 5, "TAC limits from announcement");
  const fee = computeHostFee({ surcharge: 25, individualEventFee: 4.5, eventCount: 5 });
  assert(fee.total === 47.5, "25 + 4.50×5");
  const byEvent = computeMeetEntryFee({
    surcharge: 15,
    individualEventFee: 6,
    events: [{ eventFee: 8 }, { eventFee: 8 }],
  });
  assert(byEvent.total === 31, "Event File fees win over the meet rate");
  const fallback = computeMeetEntryFee({
    surcharge: 25,
    individualEventFee: 4.5,
    events: [{}, {}],
  });
  assert(fallback.total === 34, "blank Event File fees use the meet rate");
  assert(typicalIndividualEventFee([{ eventFee: 8 }, { eventFee: 8 }, { eventFee: 16, isRelay: true }]) === 8, "typical fee ignores relays");
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
  const livePublic = {
    id: "live",
    name: "2026 PN Public Open",
    hostClub: "Host",
    meetType: "open",
    course: "scy",
    startDate: "2026-10-17",
    endDate: "2026-10-18",
    location: "Pool",
    eligibilityStatus: "likely_eligible",
    invitationStatus: "not_required",
    eligibilityNotes: ["USA Swimming + PNS membership required before the first day of the meet."],
    deadlineTimezone: "America/Los_Angeles",
    status: "commitment_open",
    sessions: [],
    events: [],
    announcementUrl: "https://example.test/public.pdf",
    isTestData: false,
  } as Meet;
  const publicCards = listPublicMeetCards([
    livePublic,
    { ...livePublic, id: "test", name: "[TEST] Hidden", isTestData: true },
  ]);
  assert(publicCards.length === 1 && publicCards[0].meetId === "live", "public catalog is production meets only");
  assert((publicCards[0].swimmerResponses || []).length === 0, "public cards have no family RSVP");
  const pub = buildPublicMeetDetail(livePublic);
  assert(!("error" in pub) && pub.announcementUrl === "https://example.test/public.pdf", "public detail keeps the announcement");
  assert(!("error" in pub) && pub.rsvpOpen === true, "public detail says RSVP is open");
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
  assert(parentAttendanceLabel("no_response", "pending_for_review") === "Open", "families do not see pending for review");
  assert(parentAttendanceLabel("attend", "pending_for_review") === "Attending", "attend stays attending until confirmed");
  assert(parentAttendanceLabel("incomplete", "pending_for_review") === "Attending", "incomplete days still read as attending");
  assert(parentAttendanceLabel("decline", "pending_for_review") === "Declined", "decline is declined");
  assert(swimmerMeetActionClass("attend").includes("amber-500"), "attending uses homepage gold");
  assert(swimmerMeetActionClass("decline").includes("red-600"), "declined uses homepage red");
  assert(swimmerMeetActionClass("no_response").includes("slate-800"), "open RSVP stays slate");
  assert(parentAttendanceLabel("attend", "confirmed") === "Confirmed", "confirmed lineup");
  assert(parentRsvpNotice("commitment_open") === undefined, "open RSVP has no closed notice");
  assert(/closed/i.test(parentRsvpNotice("commitment_closed") || ""), "closed RSVP tells families it is closed");
  assert(/cancelled/i.test(parentRsvpNotice("cancelled") || ""), "cancelled meet tells families it is cancelled");
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
  const staff = parseAnnouncementBlocks(`
MEET DIRECTOR:
Keely Ridle
MEET REFEREE:
Shellie Hunter
ADMINISTRATIVE OFFICIAL:
Jennifer Hapoff
****************************************
9/8/26 Meet announcement posted
`);
  assert(staff.filter((b) => b.kind === "contact").length === 3, "PNS staff lines become contact cards");
  assert(staff.some((b) => b.kind === "contact" && b.name === "Keely Ridle"), "director name");
  assert(staff.some((b) => b.kind === "update" && /announcement posted/i.test(b.text)), "PNS posted line is an update");
  assert(!staff.some((b) => "text" in b && /^\*+$/.test(b.text)), "asterisk separators are dropped");
  assert(displayMeetName("2026 PASC Riptide’s Seasonal Open Approval #2609-SP02") === "2026 PASC Riptide’s Seasonal Open", "strips Approval #");
  assert(displayMeetName("2026 PN TAC Fall Pentathlon and Distance Open – Approval #2609-SP05").includes("Pentathlon"), "keeps title");
  assert(!/#/.test(displayMeetName("2026 PN OCA John Walker Invitational - Sanction #2610-SP09")), "strips Sanction #");
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
  assert(eventLabel(ev1!) === "#1 Girls 13 & Over 200 IM", "EV3 label is USA Swimming style");
  assert(eventName(ev3.events.find((e) => e.eventNumber === 3)!) === "Girls 8 & Under 50 Free", "0-8 becomes 8 & Under");
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

function testCalendarWhen() {
  const today = "2026-09-15";
  assert(classifyCalendarWhen("2026-10-17", "2026-10-18", today) === "upcoming", "future meet is upcoming");
  assert(classifyCalendarWhen("2026-09-15", "2026-09-16", today) === "now", "meet starting today is happening now");
  assert(classifyCalendarWhen("2026-09-14", "2026-09-15", today) === "now", "meet ending today is happening now");
  assert(classifyCalendarWhen("2026-09-05", "2026-09-06", today) === "past", "ended meet is past");
  assert(classifyCalendarWhen("2026-09-15", undefined, today) === "now", "single-day today is happening now");
  assert(classifyCalendarWhen("2026-12-01", undefined, today) === "upcoming", "single-day future is upcoming");
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
  const fromHtml = applyTeamUnifyDetail(item, {
    eventTitle: item.name,
    eventDescription: '<p>See the <a href="/pnws2/__eventform__/announce.pdf">Meet Announcement</a></p>',
    eventDocuments: [],
  });
  assert(Boolean(fromHtml.announcementUrl?.endsWith("announce.pdf")), "PDF href in the PNS description becomes the announcement link");
  assert(meetAnnouncementUrl({ announcementUrl: "https://example.test/tac.pdf" }) === "https://example.test/tac.pdf", "family PDF link is kept");
  assert(
    meetAnnouncementUrl({ announcementUrl: "https://www.pns.org/page/calendar#/team-events/upcoming" }) === undefined,
    "calendar page is not shown as the announcement"
  );
  assert(
    meetAnnouncementUrl({
      announcementUrl: "https://www.pns.org/page/calendar#/team-events/upcoming",
      sourceFiles: [{ name: "announce.pdf", url: "https://www.pns.org/tac.pdf", kind: "announcement" }],
    }) === "https://www.pns.org/tac.pdf",
    "source PDF wins over a calendar placeholder"
  );
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
  const dateMove = mergePnsUpdates(
    { ...published, startDate: "2026-09-26", endDate: "2026-09-27", location: "Fidalgo Pool", hostClub: "TAC" },
    { ...incoming, startDate: "2026-10-03", endDate: "2026-10-04", location: "King County Aquatics", hostClub: "BC" }
  );
  assert(dateMove.next.startDate === "2026-09-26", "published dates stay until Accept");
  assert(dateMove.next.pendingSourcePatch?.startDate === "2026-10-03", "new startDate is stashed");
  assert(dateMove.diffs.some((d) => /location/i.test(d)), "location change is listed");
  assert(dateMove.diffs.some((d) => /host /i.test(d)), "host club change is listed");
  assert(parentBannerForPnsDiffs(["announcement PDF changed"]) === undefined, "PDF-only change does not ask parents to re-pick days");
  assert(parentBannerForPnsDiffs(dateMove.diffs) === parentBannerForDayReselection(), "date change copy asks them to tap Attend again");
  assert(attendingNeedsNewDays({ startDate: "2026-10-03", endDate: "2026-10-04" }, { attendance: "attend", availableSessionIds: ["2026-09-26", "2026-09-27"] }) === true, "old days need a new choice");
  assert(attendingNeedsNewDays({ startDate: "2026-09-26", endDate: "2026-09-27" }, { attendance: "attend", availableSessionIds: ["2026-09-26", "2026-09-27"] }) === false, "same days do not need a new choice");
  assert(attendingNeedsNewDays({ startDate: "2026-10-03", endDate: "2026-10-04" }, { attendance: "attend", availableSessionIds: [] }) === true, "Attend with no remaining days must re-pick");
  const stale = keepValidMeetDayIds({ startDate: "2026-10-03", endDate: "2026-10-04" }, ["2026-09-26", "2026-10-03"]);
  assert(stale.join(",") === "2026-10-03", "old selected days drop after the meet moves");
  assert(pnsScanNeedsAdminAlert({ created: 0, updated: 0 }) === false, "quiet day does not email admin");
  assert(pnsScanNeedsAdminAlert({ created: 1, updated: 0 }) === true, "new draft emails admin");
  const filled = mergePnsUpdates(draft, { ...incoming, surcharge: 25, individualEventFee: 4.5 });
  assert(filled.next.surcharge === 25 && filled.next.individualEventFee === 4.5, "empty draft fills announcement fees immediately");
  const adminCorrected = mergePnsUpdates(
    { ...draft, surcharge: 20, individualEventFee: 4.5, status: "admin_review" },
    { ...incoming, surcharge: 25, individualEventFee: 4.5 }
  );
  assert(adminCorrected.next.surcharge === 20, "admin Host fees correction is kept");
  assert(adminCorrected.next.pendingSourcePatch?.surcharge === 25, "PDF surcharge is stashed for review");
  const publishedFees = mergePnsUpdates(
    { ...published, surcharge: 25, individualEventFee: 4.5 },
    { ...incoming, surcharge: 30, individualEventFee: 5 }
  );
  assert(publishedFees.next.surcharge === 25 && publishedFees.next.individualEventFee === 4.5, "published invoices keep current rates until Accept");
  assert(publishedFees.next.pendingSourcePatch?.surcharge === 30, "new surcharge is stashed");
  const acceptedFees = applyPendingSourcePatch({
    ...publishedFees.next,
    pendingSourceReview: true,
    pendingSourceDiffs: publishedFees.diffs,
  });
  assert(acceptedFees.surcharge === 30 && acceptedFees.individualEventFee === 5, "Accept applies announcement fee changes");
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

function testMeetDaysFromCalendarNotWeekendOnly() {
  const midweek = meetDayOptions({ startDate: "2026-10-16", endDate: "2026-10-18", sessions: [], events: [] });
  assert(midweek.length === 3, "three-day meet shows Friday, Saturday, and Sunday");
  assert(midweek[0].label.startsWith("Friday") && midweek[2].label.startsWith("Sunday"), "labels follow the calendar");
  const evenWithSessions = meetDayOptions({
    startDate: "2026-10-16",
    endDate: "2026-10-18",
    sessions: [
      { id: "saturday", name: "Saturday" },
      { id: "sunday", name: "Sunday" },
    ],
    events: [],
  });
  assert(evenWithSessions.length === 3, "calendar days win so a 3-day meet is not collapsed to two Hy-Tek sessions");
  const stamp = meetDateStamp("2026-10-17", "2026-10-18");
  assert(stamp.month === "Oct" && stamp.day === "17" && stamp.endDay === "18", "date stamp uses start day with range");
  assert(stamp.rangeLabel === "Oct 17–18, 2026", "readable range sits next to the stamp");
  const one = meetDateStamp("2026-11-01", "2026-11-01");
  assert(one.day === "01" && !one.endDay && one.rangeLabel === "Nov 1, 2026", "single-day stamp has no end day");
  const span = meetDateStamp("2026-09-30", "2026-10-02");
  assert(span.rangeLabel === "Sep 30 – Oct 2, 2026", "cross-month range stays readable");
  assert(sessionNameForMeetDay(1, "2026-10-17", "2026-10-18") === "Saturday", "EV3 session 1 is Saturday");
  assert(sessionNameForMeetDay(2, "2026-10-17", "2026-10-18") === "Sunday", "EV3 session 2 is Sunday");
  assert(ageGroupLabel(0, 10) === "10 & Under", "Hy-Tek 0-10 is 10 & Under");
  assert(ageGroupLabel(11, 12) === "11-12", "closed age group stays 11-12");
  assert(ageGroupLabel(13, 109) === "13 & Over", "109 is Open/Over");
  assert(ageGroupLabel(0, 109) === "Open", "0-109 is Open");
}

function testHostPacketAndParentEvents() {
  assert(canExportHostPacket("commitment_closed") === true, "closed RSVP can export");
  assert(canExportHostPacket("submitted") === true, "submitted can export");
  assert(canExportHostPacket("host_reply_received") === true, "host reply can export");
  assert(canExportHostPacket("entries_confirmed") === true, "confirmed can export");
  assert(canExportHostPacket("commitment_open") === false, "open RSVP cannot export");
  assert(canExportHostPacket("draft") === false, "draft cannot export");
  assert(shortEventLabel({ distance: 50, stroke: "fly" }) === "50 Fly", "short fly label");
  assert(shortEventLabel({ distance: 50, stroke: "free" }) === "50 Free", "short free label");
  const meet = {
    id: "m-host",
    name: "[TEST] Autumn Open",
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
    status: "commitment_open",
    sessions: [],
    events: [
      ev({ id: "e-fly", eventNumber: 3, minAge: 8, maxAge: 18, stroke: "fly" }),
      ev({ id: "e-free", eventNumber: 5, minAge: 8, maxAge: 18, stroke: "free" }),
    ],
    isTestData: true,
  } as Meet;
  const attending = {
    id: "c-attend",
    meetId: "m-host",
    swimmerId: "s1",
    parentUID: "p1",
    attendance: "attend",
    availableSessionIds: ["2026-10-17"],
    selectedEventIds: ["e-fly", "e-free"],
    parentNotes: "lane 4 if possible",
    isTestData: true,
  } as MeetCommitment;
  const declined = {
    ...attending,
    id: "c-decline",
    swimmerId: "s2",
    attendance: "decline",
    selectedEventIds: ["e-fly"],
  } as MeetCommitment;
  const cards = listParentMeetCards({
    meets: [meet],
    commitments: [attending, declined],
    viewerIsTestAccount: true,
  });
  assert(cards[0].selectedEvents.map((event) => event.label).join(",") === "50 Fly,50 Free", "stored events stay on the card payload");
  assert(cards[0].swimmerResponses.find((r) => r.swimmerId === "s1")?.events.map((event) => event.label).join(",") === "50 Fly,50 Free", "attending swimmer lists events");
  assert((cards[0].swimmerResponses.find((r) => r.swimmerId === "s2")?.events || []).length === 0, "declined swimmer hides events");
  const confirmedCards = listParentMeetCards({
    meets: [{ ...meet, status: "entries_confirmed" }],
    commitments: [{ ...attending, confirmedEventIds: ["e-fly"], hostCutNote: "Host cut 50 Free" }],
    viewerIsTestAccount: true,
    swimmerId: "s1",
  });
  assert(isSwimmerUpcomingMeetCard(confirmedCards[0], "2026-09-15") === true, "confirmed Attend stays on the swimmer card");
  assert(confirmedCards[0].selectedEvents.map((event) => event.label).join(",") === "50 Fly", "confirmed card keeps remaining events");
  assert(confirmedCards[0].cutEvents.map((event) => event.label).join(",") === "50 Free", "cut events are listed for families");
  assert(confirmedCards[0].hostCutNote === "Host cut 50 Free", "host cut note is on the card");
  const upcoming = listUpcomingSwimmerMeets({
    meets: [meet, { ...meet, id: "m-past", startDate: "2026-08-01", endDate: "2026-08-02" }],
    commitments: [attending, declined, { ...attending, id: "c-past", meetId: "m-past" }],
    swimmers: [
      { id: "s1", childFirstName: "Elena", childLastName: "Chen", childDateOfBirth: "2015-03-12", parentUID: "p1" } as MeetSwimmer,
      { id: "s2", childFirstName: "Leo", childLastName: "Chen", childDateOfBirth: "2018-06-20", parentUID: "p1" } as MeetSwimmer,
    ],
    viewerIsTestAccount: true,
    todayYmd: "2026-09-15",
  });
  assert(upcoming.length === 1 && upcoming[0].swimmerId === "s1", "upcoming API is Attend only and skips past meets");
  assert(upcoming[0].events.map((event) => event.label).join(",") === "50 Fly,50 Free", "upcoming API returns selected events");
  const oneKid = listUpcomingSwimmerMeets({
    meets: [meet],
    commitments: [attending, declined],
    swimmers: [
      { id: "s1", childFirstName: "Elena", childLastName: "Chen", childDateOfBirth: "2015-03-12", parentUID: "p1" } as MeetSwimmer,
      { id: "s2", childFirstName: "Leo", childLastName: "Chen", childDateOfBirth: "2018-06-20", parentUID: "p1" } as MeetSwimmer,
    ],
    viewerIsTestAccount: true,
    todayYmd: "2026-09-15",
    swimmerIds: ["s1"],
  });
  assert(oneKid.length === 1 && oneKid[0].swimmerId === "s1", "swimmerId query returns only that child");
  const otherKid = listUpcomingSwimmerMeets({
    meets: [meet],
    commitments: [attending, declined],
    swimmers: [
      { id: "s1", childFirstName: "Elena", childLastName: "Chen", childDateOfBirth: "2015-03-12", parentUID: "p1" } as MeetSwimmer,
      { id: "s2", childFirstName: "Leo", childLastName: "Chen", childDateOfBirth: "2018-06-20", parentUID: "p1" } as MeetSwimmer,
    ],
    viewerIsTestAccount: true,
    todayYmd: "2026-09-15",
    swimmerIds: ["s2"],
  });
  assert(otherKid.length === 0, "child who declined has no upcoming row");
  const bothKids = listUpcomingSwimmerMeets({
    meets: [meet],
    commitments: [attending, declined],
    swimmers: [
      { id: "s1", childFirstName: "Elena", childLastName: "Chen", childDateOfBirth: "2015-03-12", parentUID: "p1" } as MeetSwimmer,
      { id: "s2", childFirstName: "Leo", childLastName: "Chen", childDateOfBirth: "2018-06-20", parentUID: "p1" } as MeetSwimmer,
    ],
    viewerIsTestAccount: true,
    todayYmd: "2026-09-15",
    swimmerIds: ["s1", "s2"],
  });
  assert(bothKids.length === 1 && bothKids[0].swimmerId === "s1", "one call with two IDs still skips Decline");
  const payload = {
    meet: {
      id: meet.id,
      name: meet.name,
      hostClub: meet.hostClub,
      meetType: meet.meetType,
      startDate: meet.startDate,
      endDate: meet.endDate,
      location: meet.location,
      course: meet.course,
      status: "commitment_closed" as const,
      isTestData: true,
    },
    catalog: [],
    entries: [
      serializeMeetEntry({ ...meet, status: "commitment_closed" }, attending, {
        id: "s1",
        childFirstName: "Elena",
        childLastName: "Test",
        childDateOfBirth: "2015-03-12",
        parentUID: "p1",
      }),
      serializeMeetEntry({ ...meet, status: "commitment_closed" }, declined, {
        id: "s2",
        childFirstName: "Leo",
        childLastName: "Test",
        childDateOfBirth: "2018-06-20",
        parentUID: "p1",
      }),
    ],
  };
  const csv = hostEntryCsv(payload);
  assert(csv.includes("First name"), "csv has header");
  assert(/Elena/.test(csv) && !/Leo/.test(csv), "csv is attending swimmers only");
  assert(/50/.test(csv) && /Fly/.test(csv), "csv includes selected events");
  const txt = hostEntryReportText(payload);
  assert(/PRIME SWIM ACADEMY/.test(txt), "report title");
  assert(/Elena Test/.test(txt) && !/Leo Test/.test(txt), "report is attending only");
  assert(hostPacketFilename({ name: meet.name, startDate: meet.startDate }, "csv") === "prime-entries-2026-10-17-autumn-open.csv", "csv filename");
  assert(canBuildHostSd3(payload) === true, "SD3 is ready when Attend swimmers have official events");
  const sd3 = hostEntrySd3(payload);
  assert(sd3.startsWith("A0"), "SD3 starts with file description");
  assert(/\r\nB1/.test(sd3) && /\r\nC1/.test(sd3) && /\r\nD0/.test(sd3) && /\r\nZ0/.test(sd3), "SD3 has meet, team, splash, and terminator records");
  assert(/CHEN, ELENA|TEST, ELENA|ELENA/i.test(sd3), "SD3 names the attending swimmer");
  assert(!/LEO/i.test(sd3), "SD3 omits declined swimmers");
  assert(sd3.split("\r\n").filter((line) => line.startsWith("D0")).length === 2, "one D0 per selected event");
}

async function testAnnouncementPdfFees() {
  const bytes = sampleEntryFeeAnnouncementPdf();
  const text = await extractTextFromPdfBytes(bytes);
  const fromPdf = extractFeeHints(text);
  assert(fromPdf.surcharge === 25 && fromPdf.individualEventFee === 4.5, "unpdf reads ENTRY FEES from a sample announcement PDF");
  const skipped = await enrichCalendarItemWithAnnouncementFees({
    announcementUrl: "https://example.test/announce.pdf",
    announcementText: "no fees here",
    surcharge: undefined as number | undefined,
    individualEventFee: undefined as number | undefined,
  });
  assert(skipped.surcharge == null && skipped.individualEventFee == null, "does not fetch fake example.test PDFs");
  const fromItem = calendarItemToDraftMeet(
    {
      sourceId: "pns-pasc",
      name: "2026 PN PASC Korman",
      hostClub: "PASC",
      startDate: "2026-10-17",
      endDate: "2026-10-18",
      location: "King County Aquatics",
      surcharge: 25,
      individualEventFee: 4.5,
    },
    { isTestData: true }
  );
  assert(fromItem.surcharge === 25 && fromItem.individualEventFee === 4.5, "draft keeps PDF-extracted fees");
}

async function run() {
  testEligibility();
  testDeadlinesAndFees();
  testUsaSwimmingAndIsolation();
  testWorkflow();
  testFinalEntriesAndPaymentDue();
  testHostPacketAndParentEvents();
  testAdminGuide();
  testCalendarWhen();
  testAdminMeetListFilter();
  testPnsHtmlParse();
  testPnsTeamUnifyMap();
  testPnsUpdateMerge();
  await testAnnouncementPdfFees();
  testMeetIdsAreGuids();
  testAnnouncementReadability();
  testHyvImport();
  testLiveEventFiles();
  testMeetDaysFromCalendarNotWeekendOnly();
  console.log("meets.unit.test.ts passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
