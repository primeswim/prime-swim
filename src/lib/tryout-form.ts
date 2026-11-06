export const swimmingDurations = {
  none: "I have not learned to swim before",
  "under-6-months": "Less than 6 months",
  "6-12-months": "6–12 months",
  "1-2-years": "1–2 years",
  "over-2-years": "More than 2 years",
} as const;

export interface TryoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: string;
  program: string;
  experience: string;
  teamExperience: string;
  teamName: string;
  lessonNotes: string;
  healthIssues: string;
  notes: string;
  liabilityAccepted: boolean;
}

export const emptyTryoutForm: TryoutFormData = {
  firstName: "", lastName: "", email: "", phone: "", age: "", program: "",
  experience: "", teamExperience: "", teamName: "", lessonNotes: "",
  healthIssues: "", notes: "", liabilityAccepted: false,
};

export function validateTryout(data: TryoutFormData): string | null {
  if (!data.firstName.trim() || !data.lastName.trim()) return "Please enter first and last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return "Please enter a valid email address.";
  if (!data.phone.trim()) return "Please enter your phone number.";
  const age = Number(data.age);
  if (!data.age.trim() || !Number.isInteger(age) || age < 4 || age > 20) return "Age must be a whole number between 4 and 20.";
  if (!["bronze", "silver", "gold", "platinum", "olympic", "unsure"].includes(data.program)) return "Please select a program.";
  if (!Object.hasOwn(swimmingDurations, data.experience)) return "Please select how long you have been learning to swim.";
  if (data.experience !== "none") {
    if (!["yes", "no"].includes(data.teamExperience)) return "Please tell us whether you have trained with a swim team.";
    if (data.teamExperience === "yes" && !data.teamName.trim()) return "Please enter your swim team's name.";
    if (data.teamExperience === "no" && !data.lessonNotes.trim()) return "Please describe your previous swimming lessons.";
  }
  if (data.liabilityAccepted !== true) return "Please accept the liability waiver.";
  return null;
}

// Only accept the current form fields; obsolete scheduling fields are ignored.
export function normalizeTryout(input: Record<string, unknown>): TryoutFormData {
  const data = { ...emptyTryoutForm };
  for (const key of Object.keys(emptyTryoutForm) as (keyof TryoutFormData)[]) {
    if (key === "liabilityAccepted") data[key] = input[key] === true;
    else data[key] = typeof input[key] === "string" ? input[key].trim() : key === "age" && typeof input[key] === "number" ? String(input[key]) : "";
  }
  if (data.experience === "none") {
    data.teamExperience = ""; data.teamName = ""; data.lessonNotes = "";
  } else if (data.teamExperience === "yes") data.lessonNotes = "";
  else if (data.teamExperience === "no") data.teamName = "";
  return data;
}

export function describeTryoutExperience(data: Pick<TryoutFormData, "experience" | "teamExperience" | "teamName" | "lessonNotes">): string {
  const duration = swimmingDurations[data.experience as keyof typeof swimmingDurations] ?? data.experience;
  if (data.experience === "none") return duration;
  return [duration, data.teamExperience === "yes" ? `Swim team: ${data.teamName}` : data.lessonNotes].filter(Boolean).join(" — ");
}
