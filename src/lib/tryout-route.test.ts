import assert from "node:assert/strict";
import Module from "node:module";
import { emptyTryoutForm, tryoutWaiverVersion } from "./tryout-form";

async function main() {
  const writes: Record<string, unknown>[] = [];
  const emails: { html: string; to: string }[] = [];
  let failSave = false, failEmail: false | "admin" | "family" = false;
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  loader._load = function(id, ...args) {
    if (id === "@/lib/firebaseAdmin") return { adminDb: { collection: (name: string) => {
      assert.equal(name, "tryouts", "No capacity locks may be accessed");
      return { add: async (value: Record<string, unknown>) => { if (failSave) throw Error("Simulated save failure"); writes.push(value); } };
    } } };
    if (id === "resend") return { Resend: class { emails = { send: async (email: { html: string; to: string }) => { emails.push(email); return { error: (failEmail === "admin" && email.to === "prime.swim.us@gmail.com") || (failEmail === "family" && email.to === "test@example.com") ? { name: "test-failure" } : null }; } }; } };
    return original.call(this, id, ...args);
  };
  const { POST } = await import("../app/api/tryout/route");
  const request = (data: unknown) => new Request("http://localhost/api/tryout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric" }).format());
  const birthDateForAge = (age: number) => `${year - age}-01-01`;
  const data = { ...emptyTryoutForm, firstName: "<Test>", lastName: "Swimmer", email: "test@example.com", phone: "555-0100", birthDate: birthDateForAge(20), program: "bronze", experience: "none", signerName: "Test Swimmer", signerRole: "swimmer", liabilityAccepted: true, waiverVersion: tryoutWaiverVersion };
  try {
    for (let i = 0; i < 3; i++) assert.equal((await POST(request(data))).status, 200);
    assert.equal(writes.length, 3, "Identical program requests must all be accepted");
    assert.equal(emails.length, 6);
    const receipt = emails.find(email => email.to === "test@example.com")!;
    assert.match(receipt.html, /reach out to finalize your tryout date, time, and location/);
    assert.match(receipt.html, /Excellence in Aquatic Education/);
    assert.match(receipt.html, /Swimsuit/);
    assert.match(receipt.html, /Swim goggles/);
    assert.match(receipt.html, /Swim cap, if you have one/);
    assert.match(receipt.html, /sms:\+14014020052/);
    assert.doesNotMatch(receipt.html, /reply to this email/i);
    assert.doesNotMatch(receipt.html, /towel|water bottle|confirmation email shortly/i);
    assert.match(receipt.html, /&lt;Test&gt;/);
    assert.doesNotMatch(receipt.html, /Health Issues|Notes:/);
    assert.match(emails[0].html, /&lt;Test&gt;/);
    assert.doesNotMatch(emails[0].html, /Preferred Date|Preferred Time|Preferred Location/);
    assert.equal(writes[0].signerRole, "swimmer");
    assert.equal(writes[0].waiverVersion, tryoutWaiverVersion);
    assert.ok(writes[0].submittedAt);
    assert.equal((await POST(request({ ...data, birthDate: birthDateForAge(17), age: 26, signerName: " Guardian Name ", signerRole: "legal-guardian", experience: "1-2-years", teamExperience: "yes", teamName: "Team <Example>", swimmerRiskAcknowledged: true }))).status, 200);
    const adminEmail = emails[6].html;
    assert.match(adminEmail, /Parent or Guardian Contact/);
    assert.match(adminEmail, /Previous swim team/);
    assert.match(adminEmail, /Team &lt;Example&gt;/);
    assert.match(adminEmail, /Open Tryout Manager/);
    assert.equal(writes[3].signerName, "Guardian Name");
    assert.equal(writes[3].signerRole, "legal-guardian");
    assert.equal(writes[3].age, "17");
    assert.equal(writes[3].birthDate, birthDateForAge(17));
    assert.equal("swimmerRiskAcknowledged" in writes[3], false);
    const before = writes.length;
    for (const invalid of [{ ...data, birthDate: birthDateForAge(27) }, { ...data, birthDate: birthDateForAge(4), signerRole: "parent" }, { ...data, birthDate: birthDateForAge(17), age: 20, swimmerRiskAcknowledged: true }, { ...data, liabilityAccepted: false }, { ...data, experience: "1-2-years" }, { ...data, experience: "1-2-years", teamExperience: "no" }, null, []]) {
      assert.equal((await POST(request(invalid))).status, 400);
    }
    assert.equal((await POST(request({ ...data, waiverVersion: "old" }))).status, 409);
    assert.equal((await POST(request({ ...data, waiverVersion: undefined }))).status, 409);
    assert.equal(writes.length, before, "Invalid requests must not be saved");
    assert.equal((await POST(new Request("http://localhost/api/tryout", { method: "POST", body: "{" }))).status, 400);
    failEmail = "admin";
    let response = await POST(request(data));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).confirmationEmailSent, true, "Admin failure must not block family receipt");
    failEmail = "family";
    response = await POST(request(data));
    assert.equal(response.status, 200, "Notification errors must not cause resubmission");
    assert.equal((await response.json()).confirmationEmailSent, false);
    failSave = true;
    const sent = emails.length;
    assert.equal((await POST(request(data))).status, 500);
    assert.equal(emails.length, sent, "Do not notify for unsaved requests");
    console.log("Tryout route checks passed: unlimited requests, server validation, escaped email and failure handling.");
  } finally { loader._load = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
