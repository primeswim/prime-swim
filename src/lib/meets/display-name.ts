export function displayMeetName(name: string): string {
  return (name || "")
    .replace(/\s*[–\-—,]*\s*(Approval|Sanction)\s*#\s*[0-9]{4}-[A-Z]{2}[0-9]+\s*$/i, "")
    .trim();
}
