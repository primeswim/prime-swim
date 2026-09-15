const USA_ID_RE = /^[A-Za-z0-9]{6,14}$/;

export function normalizeUsaSwimmingId(raw?: string | null): string {
  return (raw || "").replace(/\s+/g, "").toUpperCase();
}

export function isValidUsaSwimmingId(raw?: string | null): boolean {
  const id = normalizeUsaSwimmingId(raw);
  return USA_ID_RE.test(id);
}

export function usaSwimmingAttendGate(opts: {
  usaSwimmingId?: string | null;
  omrUrl?: string | null;
}): { canAttend: boolean; reason: string; registerUrl: string | null } {
  if (isValidUsaSwimmingId(opts.usaSwimmingId)) {
    return { canAttend: true, reason: "", registerUrl: null };
  }
  const registerUrl = (opts.omrUrl || "").trim() || null;
  return {
    canAttend: false,
    reason: "A USA Swimming ID is required before you can Attend. Register Premium / year-round membership with the club link, then enter the ID.",
    registerUrl,
  };
}

export function isOmrWelcomeUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.includes("usaswimming.org") && u.pathname.includes("/omr/");
  } catch {
    return false;
  }
}
