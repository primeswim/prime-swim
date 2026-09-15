import { readFileSync } from "fs";
import { join } from "path";
import { extractEligibilityNotes, inferEligibilityStatus, inferInvitationStatus } from "./eligibility";
import { parseHytekEventFile } from "./hytek-events";
import { calendarItemToDraftMeet, type PnsCalendarItem } from "./pns-calendar";
import { markTestName } from "./test-data";
import type { Meet, MeetSwimmer } from "./types";

export const TEST_OMR_URL = "https://omr.usaswimming.org/omr/welcome/TEST-PRIME-SWIM-FAKE";

export const TAC_ANNOUNCEMENT_TEXT = `
Pacific Northwest Swimming
2026 PN TAC Fall Pentathlon and Distance Open – Approval #2609-SP05
Fidalgo Pool and Fitness Center
Hosted by Thunderbird Aquatic Club
MEET ENTRY DEADLINE: TUESDAY, SEPTEMBER 15, 2026
THIS MEET IS AN INVITATIONAL.
ENTRIES RECEIVED WITHOUT AN INVITATION WILL BE REJECTED WITHOUT NOTICE.
All swimmers must be registered with USA Swimming and Pacific Northwest Swimming
in compliance with Article 302 prior to the first day of the meet.
Age groups are based on the age of the swimmer as of the first day of the meet.
Each swimmer may enter up to eight (8) events but no more than five (5) on Saturday
and/or three (3) events on Sunday.
ENTRY FEES: Surcharge: $25.00 Individual Event: $4.50
Email entries to gminkel@fidalgopool.com
`.trim();

export const OPEN_MEET_ANNOUNCEMENT_TEXT = `
2026 PN Open Age Group Challenge
Hosted by Example Aquatic Club
Competition will be open to all swimmers domiciled within Pacific Northwest Swimming.
All swimmers must be registered with USA Swimming and Pacific Northwest Swimming
in compliance with Article 302 prior to the first day of the meet.
Age groups are based on the age of the swimmer as of the first day of the meet.
MEET ENTRY DEADLINE: FRIDAY, OCTOBER 10, 2026
Surcharge $15.00 Individual Event $6.00
`.trim();

export const UPAC_OPEN_ANNOUNCEMENT_TEXT = `
Pacific Northwest Swimming
2026 PN UPAC Fall Open – Approval #2609-SP06
Curtis High School Pool, University Place
Hosted by University Place Aquatic Club
MEET DIRECTORS: Mark Neely and Rebecca Chin
MEET ENTRY DEADLINE: TUESDAY, SEPTEMBER 15, 2026
Competition will be open to all swimmers domiciled within Pacific Northwest Swimming.
All swimmers must be registered with USA Swimming and Pacific Northwest Swimming
in compliance with Article 302 prior to the first day of the meet.
Age groups are based on the age of the swimmer as of the first day of the meet.
ENTRY FEES: Surcharge: $20.00 Individual Event: $5.00
Email entries to entries@upacswim.test
`.trim();

export const SOCKEYE_INVITATIONAL_ANNOUNCEMENT_TEXT = `
Pacific Northwest Swimming
2026 PN IST Sockeye Sprints Invitational – Approval #2609-SP04
Hosted by Issaquah Swim Team
MEET ENTRY DEADLINE: TUESDAY, SEPTEMBER 15, 2026
THIS MEET IS AN INVITATIONAL.
ENTRIES RECEIVED WITHOUT AN INVITATION WILL BE REJECTED WITHOUT NOTICE.
All swimmers must be registered with USA Swimming and Pacific Northwest Swimming
in compliance with Article 302 prior to the first day of the meet.
Age groups are based on the age of the swimmer as of the first day of the meet.
ENTRY FEES: Surcharge: $25.00 Individual Event: $5.00
Email entries to entries@istsockeye.test
`.trim();

export const DEADLINE_CLOSE_ANNOUNCEMENT_TEXT = `
Pacific Northwest Swimming
2026 PN Deadline Close Drill
Hosted by Example Aquatic Club
Competition will be open to all swimmers domiciled within Pacific Northwest Swimming.
All swimmers must be registered with USA Swimming and Pacific Northwest Swimming
in compliance with Article 302 prior to the first day of the meet.
MEET ENTRY DEADLINE: FRIDAY, SEPTEMBER 12, 2026
ENTRY FEES: Surcharge: $15.00 Individual Event: $5.00
Email entries to entries@deadlineclose.test
`.trim();

export function mockPnsCalendarItems(): PnsCalendarItem[] {
  return [
    {
      sourceId: "test-pns-tac-pentathlon",
      name: markTestName("2026 PN TAC Fall Pentathlon"),
      hostClub: "Thunderbird Aquatic Club",
      startDate: "2026-09-26",
      endDate: "2026-09-27",
      location: "Fidalgo Pool, Anacortes",
      announcementUrl: "https://example.test/tac-fall-pentathlon.pdf",
      announcementText: TAC_ANNOUNCEMENT_TEXT,
      registrationDeadline: "2026-09-25T23:59:00",
      hostEntryEmail: "gminkel@fidalgopool.com",
    },
    {
      sourceId: "test-pns-open-challenge",
      name: markTestName("2026 PN Open Age Group Challenge"),
      hostClub: "Example Aquatic Club",
      startDate: "2026-10-17",
      endDate: "2026-10-18",
      location: "Mary Wayte Pool",
      announcementUrl: "https://example.test/open-challenge.pdf",
      announcementText: OPEN_MEET_ANNOUNCEMENT_TEXT,
      registrationDeadline: "2026-10-17T23:59:00",
      hostEntryEmail: "entries@example.test",
    },
    {
      sourceId: "test-pns-upac-fall",
      name: markTestName("2026 PN UPAC Fall Open"),
      hostClub: "University Place Aquatic Club",
      startDate: "2026-09-26",
      endDate: "2026-09-27",
      location: "Curtis High School Pool, University Place",
      announcementUrl: "https://www.pns.org/page/calendar#/team-events/upcoming",
      announcementText: UPAC_OPEN_ANNOUNCEMENT_TEXT,
      registrationDeadline: "2026-09-15T23:59:00",
      hostEntryEmail: "entries@upacswim.test",
    },
    {
      sourceId: "test-pns-sockeye-sprints",
      name: markTestName("2026 PN IST Sockeye Sprints Invitational"),
      hostClub: "Issaquah Swim Team",
      startDate: "2026-09-26",
      endDate: "2026-09-27",
      location: "Issaquah, WA",
      announcementUrl: "https://www.pns.org/page/calendar#/team-events/upcoming",
      announcementText: SOCKEYE_INVITATIONAL_ANNOUNCEMENT_TEXT,
      registrationDeadline: "2026-09-15T23:59:00",
      hostEntryEmail: "entries@istsockeye.test",
    },
    {
      sourceId: "test-pns-deadline-close",
      name: markTestName("2026 PN Deadline Close Drill"),
      hostClub: "Example Aquatic Club",
      startDate: "2026-09-20",
      endDate: "2026-09-20",
      location: "Test Pool",
      announcementText: DEADLINE_CLOSE_ANNOUNCEMENT_TEXT,
      registrationDeadline: "2026-09-12T23:59:00",
      hostEntryEmail: "entries@deadlineclose.test",
    },
  ];
}

export function mockDraftMeets(): Meet[] {
  return mockPnsCalendarItems().map((item) => {
    const meet = calendarItemToDraftMeet(item, { isTestData: true });
    meet.eligibilityNotes = extractEligibilityNotes(item.announcementText || "");
    meet.eligibilityStatus = inferEligibilityStatus(item.announcementText || "");
    meet.invitationStatus = inferInvitationStatus(item.announcementText || "");
    meet.hostEntryEmail = item.hostEntryEmail;
    meet.surcharge = item.sourceId.includes("tac") ? 25 : 15;
    meet.individualEventFee = item.sourceId.includes("tac") ? 4.5 : 6;
    meet.maxEventsMeet = item.sourceId.includes("tac") ? 8 : undefined;
    meet.maxEventsBySession = item.sourceId.includes("tac")
      ? { Saturday: 5, Sunday: 3 }
      : undefined;
    return meet;
  });
}

export function loadTestTacHyv(): string {
  const path = join(process.cwd(), "src/fixtures/meets/tac-fall-pentathlon.hyv");
  return readFileSync(path, "utf8");
}

export function loadMexicoSprintEv3(): string {
  return readFileSync(join(process.cwd(), "src/fixtures/meets/mexico-sprint-spectacular-2026.ev3"), "utf8");
}

export function loadComHalloweenHyv(): string {
  return readFileSync(join(process.cwd(), "src/fixtures/meets/com-halloween-2026.hyv"), "utf8");
}

export const TEST_PARENT_WITH_ID = {
  uid: "test-parent-usa-id",
  email: "parent.withid+meetstest@prime-swim.test",
};

export const TEST_PARENT_NO_ID = {
  uid: "test-parent-no-usa-id",
  email: "parent.noid+meetstest@prime-swim.test",
};

export const PROD_PARENT = {
  uid: "prod-parent-real",
  email: "real.parent@example.com",
};

export function testSwimmers(): MeetSwimmer[] {
  return [
    {
      id: "test-swimmer-elena",
      childFirstName: "[TEST] Elena",
      childLastName: "Chen",
      childDateOfBirth: "2015-03-12",
      childGender: "female",
      level: "Gold Performance",
      usaSwimmingId: "TESTUSA11ELENA",
      parentUID: TEST_PARENT_WITH_ID.uid,
      isTestData: true,
    },
    {
      id: "test-swimmer-leo",
      childFirstName: "[TEST] Leo",
      childLastName: "Chen",
      childDateOfBirth: "2018-06-20",
      childGender: "male",
      parentUID: TEST_PARENT_NO_ID.uid,
      isTestData: true,
    },
    {
      id: "prod-swimmer-ava",
      childFirstName: "Ava",
      childLastName: "Kim",
      childDateOfBirth: "2014-01-01",
      childGender: "female",
      usaSwimmingId: "REALUSAPROD01",
      parentUID: PROD_PARENT.uid,
      isTestData: false,
    },
  ];
}

export function meetWithImportedEvents(meet: Meet, hyv: string): Meet {
  const parsed = parseHytekEventFile(hyv);
  const sessions = [...new Set(parsed.events.map((e) => e.sessionName))].map((name) => ({
    id: name.toLowerCase(),
    name,
  }));
  return {
    ...meet,
    course: parsed.course,
    events: parsed.events,
    sessions,
  };
}
