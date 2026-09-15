/**
 * Deletes [TEST] meet records from Firestore (meets, commitments, test swimmers, test_accounts).
 * Live PNS meets are left untouched.
 *
 *   DRY_RUN=1 ALLOW_MEET_TEST_DELETE=1 npm run delete:meets-test
 *   ALLOW_MEET_TEST_DELETE=1 npm run delete:meets-test
 */
import { adminDb } from "../src/lib/firebaseAdmin";
import { isTestRecord, isTestSwimmer } from "../src/lib/meets/test-data";

const dryRun = process.env.DRY_RUN === "1";

function isTestMeet(data: FirebaseFirestore.DocumentData, id: string): boolean {
  return (
    isTestRecord({ isTestData: data.isTestData === true, name: String(data.name || "") }) ||
    id.startsWith("test-") ||
    String(data.sourceKey || "").startsWith("test-pns-")
  );
}

async function deleteQueryDocs(
  label: string,
  refs: FirebaseFirestore.DocumentReference[]
): Promise<number> {
  console.log(`${dryRun ? "[dry-run] would delete" : "deleting"} ${refs.length} ${label}`);
  if (dryRun || refs.length === 0) return refs.length;
  const batchSize = 400;
  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = adminDb.batch();
    for (const ref of refs.slice(i, i + batchSize)) batch.delete(ref);
    await batch.commit();
  }
  return refs.length;
}

async function main() {
  if (process.env.ALLOW_MEET_TEST_DELETE !== "1") {
    throw new Error("Refusing to delete. Set ALLOW_MEET_TEST_DELETE=1 to remove [TEST] docs from this database.");
  }

  const meetSnap = await adminDb.collection("meets").get();
  const testMeets = meetSnap.docs.filter((d) => isTestMeet(d.data(), d.id));
  const liveMeets = meetSnap.docs.filter((d) => !isTestMeet(d.data(), d.id));
  const testMeetIds = new Set(testMeets.map((d) => d.id));

  console.log(`Meets: ${testMeets.length} [TEST], ${liveMeets.length} live (kept)`);
  for (const d of testMeets) {
    const data = d.data();
    console.log(`  - ${d.id}  ${data.name}  sourceKey=${data.sourceKey || ""}`);
  }

  const commitSnap = await adminDb.collection("meet_commitments").get();
  const testCommitments = commitSnap.docs.filter((d) => {
    const data = d.data();
    return data.isTestData === true || testMeetIds.has(String(data.meetId || ""));
  });

  const swimmerSnap = await adminDb.collection("swimmers").get();
  const testSwimmers = swimmerSnap.docs.filter((d) => {
    const data = d.data();
    return (
      isTestSwimmer({
        isTestData: data.isTestData === true,
        childFirstName: String(data.childFirstName || ""),
        childLastName: String(data.childLastName || ""),
      }) ||
      d.id.startsWith("e2e-test-swimmer")
    );
  });

  const accountSnap = await adminDb.collection("test_accounts").get();
  const adminSnap = await adminDb.collection("admin").get();
  const testAdmins = adminSnap.docs.filter((d) => {
    const data = d.data();
    const email = String(data.email || d.id || "").toLowerCase();
    return data.e2eTest === true || email.includes("+meetstest") || email.endsWith("@prime-swim.test");
  });

  console.log(`Commitments: ${testCommitments.length} test`);
  console.log(`Swimmers: ${testSwimmers.length} test`);
  for (const d of testSwimmers) {
    const data = d.data();
    console.log(`  - ${d.id}  ${data.childFirstName} ${data.childLastName}`);
  }
  console.log(`test_accounts: ${accountSnap.size}`);
  console.log(`admin e2e docs: ${testAdmins.length}`);
  for (const d of testAdmins) console.log(`  - ${d.id}`);

  await deleteQueryDocs("meets", testMeets.map((d) => d.ref));
  await deleteQueryDocs("meet_commitments", testCommitments.map((d) => d.ref));
  await deleteQueryDocs("swimmers", testSwimmers.map((d) => d.ref));
  await deleteQueryDocs("test_accounts", accountSnap.docs.map((d) => d.ref));
  await deleteQueryDocs("admin e2e", testAdmins.map((d) => d.ref));

  console.log(dryRun ? "Dry run complete. Live PNS meets were not listed for deletion." : "Deleted [TEST] meet data. Live PNS meets kept.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
