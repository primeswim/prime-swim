import assert from "node:assert/strict";
import Module from "node:module";
import { emptyTryoutForm } from "./tryout-form";

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
  const data = { ...emptyTryoutForm, firstName: "<Test>", lastName: "Swimmer", email: "test@example.com", phone: "555-0100", age: "20", program: "bronze", experience: "none", liabilityAccepted: true };
  try {
    for (let i = 0; i < 3; i++) assert.equal((await POST(request(data))).status, 200);
    assert.equal(writes.length, 3, "Identical program requests must all be accepted");
    assert.equal(emails.length, 6);
    const receipt = emails.find(email => email.to === "test@example.com")!;
    assert.match(receipt.html, /has not been scheduled yet/);
    assert.match(receipt.html, /&lt;Test&gt;/);
    assert.doesNotMatch(receipt.html, /Health Issues|Notes:/);
    assert.match(emails[0].html, /&lt;Test&gt;/);
    assert.doesNotMatch(emails[0].html, /Preferred Date|Preferred Time|Preferred Location/);
    const before = writes.length;
    for (const invalid of [{ ...data, age: 21 }, { ...data, liabilityAccepted: false }, { ...data, experience: "1-2-years" }, { ...data, experience: "1-2-years", teamExperience: "no" }, null, []]) {
      assert.equal((await POST(request(invalid))).status, 400);
    }
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
