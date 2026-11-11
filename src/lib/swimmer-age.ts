export const minSwimmerAge = 5;
export const maxSwimmerAge = 26;

const registrationDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getSwimmerBirthDateError(value: unknown, today = new Date()): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Enter the swimmer’s date of birth.";
  }

  const birthDate = new Date(value + "T00:00:00Z");
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== value) {
    return "Enter a valid date of birth.";
  }

  const parts = registrationDateFormatter.formatToParts(today);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const todayDate = `${year}-${month}-${day}`;
  if (value > todayDate) return "The swimmer’s date of birth cannot be in the future.";

  const birthdayHasPassed = value.slice(5) <= todayDate.slice(5);
  const age = Number(year) - Number(value.slice(0, 4)) - (birthdayHasPassed ? 0 : 1);
  if (age < minSwimmerAge) return `The swimmer must be at least ${minSwimmerAge} years old to register.`;
  if (age > maxSwimmerAge) return `The swimmer must be ${maxSwimmerAge} years old or younger to register.`;
  return null;
}
