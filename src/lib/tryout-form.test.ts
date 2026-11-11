import assert from "node:assert/strict";
import { getSwimmerBirthDateError } from "./swimmer-age";
import { formatUSPhone } from "./us-phone";
import { describeTryoutExperience, emptyTryoutForm, normalizeTryout, validateTryout as validateTryoutOnDate, type TryoutFormData } from "./tryout-form";

const today = new Date("2026-11-11T20:00:00Z");
const validateTryout = (data: TryoutFormData) => validateTryoutOnDate(data, today);
const valid = { ...emptyTryoutForm, firstName: "Test", lastName: "Swimmer", email: "test@example.com", phone: "555-0100", birthDate: "2006-11-11", program: "bronze", experience: "none", signerName: "Test Swimmer", signerRole: "swimmer", liabilityAccepted: true };
assert.equal(validateTryout(valid), null);
for (const birthDate of ["1999-11-11", "2021-11-12", "", "2020-02-30", "2026-11-12"]) {
  assert.ok(validateTryout({ ...valid, birthDate }), birthDate);
}
assert.equal(validateTryout({ ...valid, birthDate: "2008-11-11" }), null);
assert.equal(validateTryout({ ...valid, birthDate: "1999-11-12" }), null);
assert.equal(validateTryout({ ...valid, birthDate: "2021-11-11", signerRole: "parent" }), null);
assert.equal(validateTryout({ ...valid, birthDate: "2008-11-12", signerRole: "legal-guardian" }), null);
assert.ok(validateTryout({ ...valid, birthDate: "2008-11-12", signerRole: "swimmer" }));
assert.ok(validateTryout({ ...valid, birthDate: "2008-11-11", signerRole: "parent" }));
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
assert.equal(normalizeTryout({ ...valid, birthDate: " 2006-11-11 ", age: 12 }).birthDate, "2006-11-11");
assert.equal("age" in normalizeTryout({ ...valid, age: 12 }), false);
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
