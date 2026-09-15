/**
 * Writes [TEST]-marked meet fixtures into Firestore.
 * Requires ALLOW_MEET_TEST_SEED=1 so this cannot run against production by accident.
 *
 * Optional:
 *   TEST_PARENT_UID=...  attach [TEST] swimmers to an existing Firebase Auth user
 *   TEST_PARENT_EMAIL=parent.withid+meetstest@prime-swim.test
 *
 * Does not create Firebase Auth users.
 */
import { adminDb } from "../src/lib/firebaseAdmin";
import { FirestoreMeetStore } from "../src/lib/meets/firestore-store";
import { loadTestTacHyv, mockPnsCalendarItems, TEST_PARENT_NO_ID, TEST_PARENT_WITH_ID, testSwimmers } from "../src/lib/meets/fixtures";
import { MeetService } from "../src/lib/meets/service";
import { markTestName } from "../src/lib/meets/test-data";

async function main() {
  if (process.env.ALLOW_MEET_TEST_SEED !== "1") {
    throw new Error("Refusing to seed. Set ALLOW_MEET_TEST_SEED=1 if you really want [TEST] docs in this database.");
  }

  const store = new FirestoreMeetStore(adminDb);
  const service = new MeetService(store);

  const meets = await service.ingestPns(mockPnsCalendarItems(), { isTestData: true });
  const tac = meets.find((m) => (m.sourceKey || m.id).includes("tac") || /Pentathlon/i.test(m.name));
  if (tac) {
    await service.importEventFile(tac.id, loadTestTacHyv(), { accept: true });
  }

  const parentUid = process.env.TEST_PARENT_UID || TEST_PARENT_WITH_ID.uid;
  const parentEmail = process.env.TEST_PARENT_EMAIL || TEST_PARENT_WITH_ID.email;
  await store.markTestAccount(parentUid, parentEmail);
  await store.markTestAccount(TEST_PARENT_NO_ID.uid, TEST_PARENT_NO_ID.email);

  if (process.env.TEST_PARENT_UID) {
    for (const swimmer of testSwimmers().filter((s) => s.isTestData)) {
      const id = swimmer.id;
      await adminDb.collection("swimmers").doc(id).set(
        {
          childFirstName: markTestName(swimmer.childFirstName.replace("[TEST] ", "")),
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

  console.log(`Seeded ${meets.length} [TEST] meets. Real parents cannot see them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
