/**
 * Normalize legacy spelling "Coach Moe" / "Moe" → "Mo" for UI display
 * (e.g. older Firestore testimonials without re-saving each doc).
 */
export function normalizeCoachMoDisplay(text: string): string {
  if (!text) return text;
  return text
    .replace(/Coach\s+Moe/gi, "Coach Mo")
    .replace(/\b([Mm])oe\b/g, "Mo");
}
