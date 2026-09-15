/** Shared production DB: every fake record must carry these markers. */

export const TEST_DATA_PREFIX = "[TEST]";
export const TEST_ACCOUNT_COLLECTION = "test_accounts";

export function isTestNamed(name?: string | null): boolean {
  return (name || "").trim().startsWith(TEST_DATA_PREFIX);
}

export function markTestName(name: string): string {
  const trimmed = name.trim();
  return isTestNamed(trimmed) ? trimmed : `${TEST_DATA_PREFIX} ${trimmed}`;
}

export function isTestRecord(doc: { isTestData?: boolean; name?: string } | null | undefined): boolean {
  if (!doc) return false;
  return doc.isTestData === true || isTestNamed(doc.name);
}

/** Real parents never see test meets. Test accounts never see production meets. */
export function canViewerSeeMeet(opts: {
  meetIsTestData: boolean;
  viewerIsTestAccount: boolean;
}): boolean {
  return opts.meetIsTestData === opts.viewerIsTestAccount;
}

export function isTestSwimmer(swimmer: {
  isTestData?: boolean;
  childFirstName?: string;
  childLastName?: string;
}): boolean {
  if (swimmer.isTestData === true) return true;
  return isTestNamed(swimmer.childFirstName) || isTestNamed(swimmer.childLastName);
}

export function isTestEmail(email?: string | null): boolean {
  const e = (email || "").toLowerCase();
  return e.includes("+meetstest") || e.endsWith("@prime-swim.test") || e.includes("prime.swim.test");
}
