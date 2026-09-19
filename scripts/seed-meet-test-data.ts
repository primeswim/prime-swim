/**
 * Writes [TEST]-marked meet fixtures into Firestore and a parent RSVP scenario.
 * Requires ALLOW_MEET_TEST_SEED=1 so this cannot run against production by accident.
 *
 * Optional:
 *   TEST_PARENT_UID=...  attach [TEST] swimmers to an existing Firebase Auth user
 *   TEST_PARENT_EMAIL=parent.withid+meetstest@prime-swim.test
 *
 * Scenario left in the database for clicking through:
 *   - Elena Attends the Open Challenge
 *   - Mia Declines the same meet (must not show on her swimmer card)
 *   - Admin Has updates is waiting: new weekend, new venue, event file posted
 *
 * Does not create Firebase Auth users. Does not Publish live PNS meets.
 */
import { adminDb } from "../src/lib/firebaseAdmin";
import { FirestoreMeetStore } from "../src/lib/meets/firestore-store";
import { loadTestTacHyv, mockPnsCalendarItems, TEST_PARENT_NO_ID, TEST_PARENT_WITH_ID, testSwimmers } from "../src/lib/meets/fixtures";
import { MeetService } from "../src/lib/meets/service";
import { markTestName } from "../src/lib/meets/test-data";
import { meetDayOptions } from "../src/lib/meets/sessions";
import type { MeetSwimmer } from "../src/lib/meets/types";

const TEST_NOW = "2026-09-01T12:00:00";

async function main() {
  if (process.env.ALLOW_MEET_TEST_SEED !== "1") {
    throw new Error("Refusing to seed. Set ALLOW_MEET_TEST_SEED=1 if you really want [TEST] docs in this database.");
  }

  const store = new FirestoreMeetStore(adminDb);
  const service = new MeetService(store);

  const parentUid = process.env.TEST_PARENT_UID || TEST_PARENT_WITH_ID.uid;
  const parentEmail = process.env.TEST_PARENT_EMAIL || TEST_PARENT_WITH_ID.email;
  await store.markTestAccount(parentUid, parentEmail);
  await store.markTestAccount(TEST_PARENT_NO_ID.uid, TEST_PARENT_NO_ID.email);

  const attendId = process.env.TEST_SWIMMER_ATTEND || "test-swimmer-elena";
  const declineId = process.env.TEST_SWIMMER_DECLINE || "test-swimmer-mia";
  const household = testSwimmers()
    .filter((swimmer) => swimmer.isTestData)
    .map((swimmer) => ({
      ...swimmer,
      id: swimmer.id === "test-swimmer-elena" ? attendId : swimmer.id,
      parentUID: parentUid,
      childFirstName: markTestName(swimmer.childFirstName.replace("[TEST] ", "")),
    }))
    .filter((swimmer) => swimmer.id === attendId || swimmer.id.startsWith("test-swimmer-leo") === false);
  const mia: MeetSwimmer = {
    id: declineId,
    childFirstName: markTestName("Mia"),
    childLastName: "Chen",
    childDateOfBirth: "2017-08-01",
    childGender: "female",
    parentUID: parentUid,
    isTestData: true,
  };
  const kids = [...household.filter((swimmer) => swimmer.id === attendId), mia];
  for (const swimmer of kids) {
    await store.saveSwimmer(swimmer);
    if (parentUid) {
      await adminDb.collection("swimmers").doc(swimmer.id).set(
        {
          childFirstName: swimmer.childFirstName,
          childLastName: swimmer.childLastName,
          childDateOfBirth: swimmer.childDateOfBirth,
          childGender: swimmer.childGender,
          level: swimmer.level || "",
          usaSwimmingId: swimmer.usaSwimmingId || "",
          parentUID: parentUid,
          parentEmail,
          isTestData: true,
          paymentStatus: "paid",
        },
        { merge: true }
      );
    }
  }

  const meets = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const tac = meets.find((m) => (m.sourceKey || m.id).includes("tac") || /Pentathlon/i.test(m.name));
  const open = meets.find((m) => (m.sourceKey || "").includes("open-challenge"));
  if (!open) throw new Error("Open Challenge fixture missing");

  if (tac) {
    await service.setInvitationStatus(tac.id, "invited");
    await service.approveMeet(tac.id);
    await service.publishToFamilies(tac.id);
    await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
  }

  await service.publishToFamilies(open.id);
  const days = meetDayOptions(open).map((day) => day.id);
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: attendId,
    parentUID: parentUid,
    attendance: "attend",
    availableSessionIds: days,
    selectedEventIds: [],
    parentNotes: "Saturday 50 fly, 50 free.",
    acceptFeePolicy: true,
    nowIso: TEST_NOW,
  });
  await service.saveParentCommitment({
    meetId: open.id,
    swimmerId: declineId,
    parentUID: parentUid,
    attendance: "decline",
    availableSessionIds: [],
    selectedEventIds: [],
    parentNotes: "Cannot make this weekend.",
    nowIso: TEST_NOW,
  });

  await service.ingestPns(
    mockPnsCalendarItems().map((item) =>
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
    ),
    { isTestData: true }
  );

  const waiting = await service.getAdminMeet(open.id, TEST_NOW);
  console.log(`Seeded ${meets.length} [TEST] meets. Real parents cannot see them.`);
  console.log(`Open Challenge ${open.id}: Elena Attending, Mia Declined, Has updates pending=${waiting?.pendingSourceReview === true}`);
  console.log("Has updates includes new weekend (Oct 24–25), Bellevue Aquatic Center, and an Event File URL.");
  console.log("Accept the update in Admin → Has updates, then import the TAC HYV as the Event File to continue the parent review flow.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
