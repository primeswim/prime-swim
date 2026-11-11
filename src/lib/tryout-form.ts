export const swimmingDurations = {
  none: "No previous swimming lessons",
  "under-6-months": "Less than 6 months",
  "6-12-months": "6–12 months",
  "1-2-years": "1–2 years",
  "over-2-years": "More than 2 years",
} as const;

export const tryoutWaiverVersion = "2026-11-11-v1";

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
  signerName: string;
  signerRole: string;
  swimmerRiskAcknowledged: boolean;
  liabilityAccepted: boolean;
}

export const emptyTryoutForm: TryoutFormData = {
  firstName: "", lastName: "", email: "", phone: "", age: "", program: "",
  experience: "", teamExperience: "", teamName: "", lessonNotes: "",
  healthIssues: "", notes: "", signerName: "", signerRole: "",
  swimmerRiskAcknowledged: false, liabilityAccepted: false,
};

export function validateTryout(data: TryoutFormData): string | null {
  if (!data.firstName.trim() || !data.lastName.trim()) return "Please enter the swimmer’s first and last name.";
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
  if (!data.signerName.trim()) return "Please enter the signer’s full name.";
  if (age < 18 && data.signerRole !== "parent" && data.signerRole !== "legal-guardian") {
    return "A parent or legal guardian must sign for a swimmer under 18.";
  }
  if (age >= 18 && data.signerRole !== "swimmer") return "The swimmer must sign for themselves.";
  if (data.liabilityAccepted !== true) return "Please review and agree to the tryout terms.";
  return null;
}

// Only accept the current form fields; obsolete scheduling fields are ignored.
export function normalizeTryout(input: Record<string, unknown>): TryoutFormData {
  const data = { ...emptyTryoutForm };
  for (const key of Object.keys(emptyTryoutForm) as (keyof TryoutFormData)[]) {
    if (key === "liabilityAccepted" || key === "swimmerRiskAcknowledged") data[key] = input[key] === true;
    else data[key] = typeof input[key] === "string" ? input[key].trim() : key === "age" && typeof input[key] === "number" ? String(input[key]) : "";
  }
  if (data.experience === "none") {
    data.teamExperience = ""; data.teamName = ""; data.lessonNotes = "";
  } else if (data.teamExperience === "yes") data.lessonNotes = "";
  else if (data.teamExperience === "no") data.teamName = "";
  if (Number(data.age) >= 18) data.swimmerRiskAcknowledged = false;
  return data;
}

export function describeTryoutExperience(data: Pick<TryoutFormData, "experience" | "teamExperience" | "teamName" | "lessonNotes">): string {
  const duration = swimmingDurations[data.experience as keyof typeof swimmingDurations] ?? data.experience;
  if (data.experience === "none") return duration;
  return [duration, data.teamExperience === "yes" ? `Swim team: ${data.teamName}` : data.lessonNotes].filter(Boolean).join(" — ");
}

// Format local US numbers, including numbers pasted with a +1 country code.
export function formatTryoutPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
