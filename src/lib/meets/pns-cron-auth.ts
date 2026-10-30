/** Vercel sends the configured CRON_SECRET as an Authorization bearer token. */
export function allowPnsCron(req: Request, configuredSecret: string | undefined): boolean {
  const secret = configuredSecret?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return bearer === secret || (req.headers.get("x-api-key") || "").trim() === secret;
}
