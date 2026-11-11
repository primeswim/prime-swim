export const minSwimmerAge = 5;
export const maxSwimmerAge = 26;

const registrationDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function checkSwimmerBirthDate(value: unknown, today = new Date()):
  { age: number; error: null } | { age: null; error: string } {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { age: null, error: "Enter the swimmer’s date of birth." };
  }

  const birthDate = new Date(value + "T00:00:00Z");
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== value) {
    return { age: null, error: "Enter a valid date of birth." };
  }

  const parts = registrationDateFormatter.formatToParts(today);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const todayDate = `${year}-${month}-${day}`;
  if (value > todayDate) return { age: null, error: "The swimmer’s date of birth cannot be in the future." };

  const birthdayHasPassed = value.slice(5) <= todayDate.slice(5);
  const age = Number(year) - Number(value.slice(0, 4)) - (birthdayHasPassed ? 0 : 1);
  if (age < minSwimmerAge) return { age: null, error: `The swimmer must be at least ${minSwimmerAge} years old to register.` };
  if (age > maxSwimmerAge) return { age: null, error: `The swimmer must be ${maxSwimmerAge} years old or younger to register.` };
  return { age, error: null };
}

export function getSwimmerBirthDateError(value: unknown, today?: Date): string | null {
  return checkSwimmerBirthDate(value, today).error;
}
