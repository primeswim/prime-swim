export function mailtoHref(to: string, subject: string, body: string): string {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : "",
    body ? `body=${encodeURIComponent(body)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return `mailto:${to}${params ? `?${params}` : ""}`;
}
