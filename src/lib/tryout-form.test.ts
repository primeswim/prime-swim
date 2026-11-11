import assert from "node:assert/strict";
import { getSwimmerBirthDateError } from "./swimmer-age";
import { formatUSPhone } from "./us-phone";
import { describeTryoutExperience, emptyTryoutForm, normalizeTryout, validateTryout } from "./tryout-form";

const valid = { ...emptyTryoutForm, firstName: "Test", lastName: "Swimmer", email: "test@example.com", phone: "555-0100", age: "20", program: "bronze", experience: "none", signerName: "Test Swimmer", signerRole: "swimmer", liabilityAccepted: true };
assert.equal(validateTryout(valid), null);
for (const age of ["27", "99", "4", "", "5.5", "NaN"]) assert.ok(validateTryout({ ...valid, age }), age);
assert.equal(validateTryout({ ...valid, age: "18" }), null);
assert.equal(validateTryout({ ...valid, age: "26" }), null);
assert.equal(validateTryout({ ...valid, age: "5", signerRole: "parent" }), null);
assert.equal(validateTryout({ ...valid, age: "17", signerRole: "legal-guardian" }), null);
for (const age of ["12", "13", "17"]) {
  assert.equal(validateTryout({ ...valid, age, signerRole: "parent" }), null);
  assert.ok(validateTryout({ ...valid, age, signerRole: "swimmer" }));
}
assert.ok(validateTryout({ ...valid, age: "18", signerRole: "parent" }));
assert.ok(validateTryout({ ...valid, signerName: " " }));
for (const field of ["firstName", "lastName", "email", "phone", "program", "experience"] as const) assert.ok(validateTryout({ ...valid, [field]: " " }), field);
assert.ok(validateTryout({ ...valid, email: "not-an-email" }));
assert.ok(validateTryout({ ...valid, liabilityAccepted: false }));
const experienced = { ...valid, experience: "1-2-years" };
assert.ok(validateTryout(experienced));
assert.ok(validateTryout({ ...experienced, teamExperience: "yes" }));
assert.equal(validateTryout({ ...experienced, teamExperience: "yes", teamName: "Example team" }), null);
assert.ok(validateTryout({ ...experienced, teamExperience: "no" }));
assert.equal(validateTryout({ ...experienced, teamExperience: "no", lessonNotes: "Private lessons for one year" }), null);
assert.ok(validateTryout({ ...valid, experience: "made-up" }));
const never = normalizeTryout({ ...valid, teamExperience: "yes", teamName: "Old team", lessonNotes: "Stale", preferredDate: "2026-11-07", location: "Old location", preferredTime: "evening" });
assert.equal(never.teamName, ""); assert.equal(never.teamExperience, ""); assert.equal(never.lessonNotes, "");
assert.equal("preferredDate" in never, false); assert.equal("location" in never, false); assert.equal("preferredTime" in never, false);
assert.equal(normalizeTryout({ ...valid, age: 20 }).age, "20");
assert.ok(validateTryout(normalizeTryout({ ...valid, liabilityAccepted: "true" })));
assert.equal(normalizeTryout({ ...experienced, teamExperience: "yes", teamName: " Example ", lessonNotes: "stale" }).lessonNotes, "");
assert.equal(normalizeTryout({ ...experienced, teamExperience: "no", teamName: "stale", lessonNotes: " Private lessons " }).teamName, "");
assert.match(describeTryoutExperience({ ...experienced, teamExperience: "yes", teamName: "Example" }), /Swim team: Example/);
assert.match(describeTryoutExperience({ ...experienced, teamExperience: "no", lessonNotes: "Private lessons" }), /Private lessons/);
assert.equal(describeTryoutExperience({ ...valid }), "No previous swimming lessons");
const registrationDay = new Date("2026-11-12T00:30:00Z"); // November 11 in Washington
assert.match(getSwimmerBirthDateError("2021-11-12", registrationDay) ?? "", /at least 5/);
assert.equal(getSwimmerBirthDateError("2021-11-11", registrationDay), null);
assert.equal(getSwimmerBirthDateError("1999-11-12", registrationDay), null);
assert.match(getSwimmerBirthDateError("1999-11-11", registrationDay) ?? "", /26 years old or younger/);
assert.match(getSwimmerBirthDateError("2020-02-30", registrationDay) ?? "", /valid date/);
assert.match(getSwimmerBirthDateError("2026-11-12", registrationDay) ?? "", /future/);
assert.equal(formatUSPhone("+1 (206) 555-0123"), "206-555-0123");
console.log("Tryout validation and conditional experience checks passed.");
