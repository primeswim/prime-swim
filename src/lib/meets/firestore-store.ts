import type { Firestore } from "firebase-admin/firestore";
import type { ClubMeetSettings, Meet, MeetCommitment, MeetSwimmer } from "./types";
import { resolveClubMeetSettings } from "./types";
import { commitmentId, type MeetStore } from "./store";
import { isTestEmail, isTestSwimmer } from "./test-data";

const MEETS = "meets";
const COMMITMENTS = "meet_commitments";
const SWIMMERS = "swimmers";
const SETTINGS = "club_settings";
const TEST_ACCOUNTS = "test_accounts";

function omitUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitUndefinedDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      out[key] = omitUndefinedDeep(item);
    }
    return out;
  }
  return value;
}

export class FirestoreMeetStore implements MeetStore {
  constructor(private db: Firestore) {}

  async listMeets(): Promise<Meet[]> {
    const snap = await this.db.collection(MEETS).get();
    return snap.docs.map((d) => asMeet(d.id, d.data()));
  }

  async getMeet(id: string): Promise<Meet | null> {
    const doc = await this.db.collection(MEETS).doc(id).get();
    return doc.exists ? asMeet(doc.id, doc.data() || {}) : null;
  }

  async saveMeet(meet: Meet): Promise<Meet> {
    const { id, ...rest } = meet;
    await this.db
      .collection(MEETS)
      .doc(id)
      .set(omitUndefinedDeep({ ...rest, updatedAt: new Date().toISOString() }) as Record<string, unknown>, { merge: true });
    return (await this.getMeet(id))!;
  }

  async listCommitments(opts?: { meetId?: string; parentUID?: string; swimmerId?: string }): Promise<MeetCommitment[]> {
    let query: FirebaseFirestore.Query = this.db.collection(COMMITMENTS);
    if (opts?.meetId) query = query.where("meetId", "==", opts.meetId);
    else if (opts?.parentUID) query = query.where("parentUID", "==", opts.parentUID);
    else if (opts?.swimmerId) query = query.where("swimmerId", "==", opts.swimmerId);
    const snap = await query.get();
    return snap.docs
      .map((d) => asCommitment(d.id, d.data()))
      .filter((c) => {
        if (opts?.meetId && c.meetId !== opts.meetId) return false;
        if (opts?.parentUID && c.parentUID !== opts.parentUID) return false;
        if (opts?.swimmerId && c.swimmerId !== opts.swimmerId) return false;
        return true;
      });
  }

  async getCommitment(meetId: string, swimmerId: string): Promise<MeetCommitment | null> {
    const id = commitmentId(meetId, swimmerId);
    const doc = await this.db.collection(COMMITMENTS).doc(id).get();
    return doc.exists ? asCommitment(doc.id, doc.data() || {}) : null;
  }

  async saveCommitment(commitment: MeetCommitment): Promise<MeetCommitment> {
    const id = commitment.id || commitmentId(commitment.meetId, commitment.swimmerId);
    await this.db
      .collection(COMMITMENTS)
      .doc(id)
      .set(omitUndefinedDeep({ ...commitment, id, updatedAt: new Date().toISOString() }) as Record<string, unknown>, { merge: true });
    return (await this.getCommitment(commitment.meetId, commitment.swimmerId))!;
  }

  async listSwimmers(opts?: { parentUID?: string; ids?: string[] }): Promise<MeetSwimmer[]> {
    if (opts?.ids?.length) {
      const docs = await Promise.all(opts.ids.map((id) => this.db.collection(SWIMMERS).doc(id).get()));
      return docs.filter((d) => d.exists).map((d) => asSwimmer(d.id, d.data() || {}));
    }
    if (opts?.parentUID) {
      const snap = await this.db.collection(SWIMMERS).where("parentUID", "==", opts.parentUID).get();
      return snap.docs.map((d) => asSwimmer(d.id, d.data()));
    }
    const snap = await this.db.collection(SWIMMERS).limit(500).get();
    return snap.docs.map((d) => asSwimmer(d.id, d.data()));
  }

  async getSwimmer(id: string): Promise<MeetSwimmer | null> {
    const doc = await this.db.collection(SWIMMERS).doc(id).get();
    return doc.exists ? asSwimmer(doc.id, doc.data() || {}) : null;
  }

  async saveSwimmer(swimmer: MeetSwimmer): Promise<MeetSwimmer> {
    await this.db.collection(SWIMMERS).doc(swimmer.id).set(
      {
        usaSwimmingId: swimmer.usaSwimmingId || "",
        ...(swimmer.isTestData ? { isTestData: true } : {}),
      },
      { merge: true }
    );
    return (await this.getSwimmer(swimmer.id))!;
  }

  async getSettings(): Promise<ClubMeetSettings> {
    const doc = await this.db.collection(SETTINGS).doc("meets").get();
    return resolveClubMeetSettings(doc.exists ? (doc.data() as Partial<ClubMeetSettings>) : {});
  }

  async saveSettings(settings: ClubMeetSettings): Promise<ClubMeetSettings> {
    await this.db.collection(SETTINGS).doc("meets").set(settings, { merge: true });
    return this.getSettings();
  }

  async isTestAccount(uid: string, email?: string | null): Promise<boolean> {
    if (isTestEmail(email)) return true;
    const byUid = await this.db.collection(TEST_ACCOUNTS).doc(uid).get();
    if (byUid.exists) return true;
    if (email) {
      const byEmail = await this.db.collection(TEST_ACCOUNTS).doc(email.toLowerCase()).get();
      if (byEmail.exists) return true;
    }
    return false;
  }

  async markTestAccount(uid: string, email?: string | null): Promise<void> {
    await this.db.collection(TEST_ACCOUNTS).doc(uid).set(
      {
        uid,
        email: email || null,
        isTestData: true,
        name: "[TEST] parent account",
      },
      { merge: true }
    );
  }
}

function asMeet(id: string, data: FirebaseFirestore.DocumentData): Meet {
  return {
    id,
    sourceKey: data.sourceKey || id,
    name: String(data.name || ""),
    hostClub: String(data.hostClub || ""),
    meetType: data.meetType || "other",
    course: data.course || "unknown",
    startDate: String(data.startDate || ""),
    endDate: String(data.endDate || data.startDate || ""),
    location: String(data.location || ""),
    sanctionNumber: data.sanctionNumber,
    announcementUrl: data.announcementUrl,
    announcementText: data.announcementText,
    eventFileUrl: data.eventFileUrl,
    sourceFiles: Array.isArray(data.sourceFiles) ? data.sourceFiles : undefined,
    sourceUrl: data.sourceUrl,
    eligibilityStatus: data.eligibilityStatus || "unknown",
    invitationStatus: data.invitationStatus || "not_required",
    eligibilityNotes: Array.isArray(data.eligibilityNotes) ? data.eligibilityNotes : [],
    pnsPublishedDeadline: data.pnsPublishedDeadline,
    announcementEntryDeadline: data.announcementEntryDeadline,
    hostConfirmedDeadline: data.hostConfirmedDeadline,
    effectiveHostDeadline: data.effectiveHostDeadline,
    primeCommitmentDeadline: data.primeCommitmentDeadline,
    deadlineTimezone: data.deadlineTimezone || "America/Los_Angeles",
    hostEntryEmail: data.hostEntryEmail,
    surcharge: data.surcharge,
    individualEventFee: data.individualEventFee,
    maxEventsMeet: data.maxEventsMeet,
    maxEventsBySession: data.maxEventsBySession,
    status: data.status || "draft",
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    events: Array.isArray(data.events) ? data.events : [],
    eventFileAcceptedAt: data.eventFileAcceptedAt,
    pendingSourceReview: data.pendingSourceReview,
    pendingSourceDiffs: data.pendingSourceDiffs,
    pendingSourcePatch: data.pendingSourcePatch,
    sourceLastCheckedAt: data.sourceLastCheckedAt,
    rejectedAt: data.rejectedAt,
    rejectedReason: data.rejectedReason,
    parentUpdateBanner: data.parentUpdateBanner,
    hostReplySummary: data.hostReplySummary,
    isTestData: data.isTestData === true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedToFamiliesAt: data.publishedToFamiliesAt,
    entriesSubmittedAt: data.entriesSubmittedAt,
    entryEmailTo: data.entryEmailTo,
    entryEmailSentAt: data.entryEmailSentAt,
    invitationEmailTo: data.invitationEmailTo,
    invitationEmailSentAt: data.invitationEmailSentAt,
    commitmentClosedAt: data.commitmentClosedAt,
    hostReplyAt: data.hostReplyAt,
    entriesConfirmedAt: data.entriesConfirmedAt,
  };
}

function asCommitment(id: string, data: FirebaseFirestore.DocumentData): MeetCommitment {
  return {
    id,
    meetId: String(data.meetId || ""),
    swimmerId: String(data.swimmerId || ""),
    parentUID: String(data.parentUID || ""),
    attendance: data.attendance || "no_response",
    availableSessionIds: Array.isArray(data.availableSessionIds) ? data.availableSessionIds : [],
    selectedEventIds: Array.isArray(data.selectedEventIds) ? data.selectedEventIds : [],
    confirmedEventIds: data.confirmedEventIds,
    parentNotes: String(data.parentNotes || ""),
    hostCutNote: data.hostCutNote,
    feePolicyVersion: data.feePolicyVersion,
    feePolicyAcceptedAt: data.feePolicyAcceptedAt,
    estimatedFee: data.estimatedFee,
    finalFee: data.finalFee,
    paymentStatus: data.paymentStatus,
    paymentReportedAt: data.paymentReportedAt,
    paidAt: data.paidAt,
    paymentDueAt: data.paymentDueAt,
    isTestData: data.isTestData === true,
    updatedAt: data.updatedAt,
  };
}

function asSwimmer(id: string, data: FirebaseFirestore.DocumentData): MeetSwimmer {
  const swimmer: MeetSwimmer = {
    id,
    childFirstName: String(data.childFirstName || ""),
    childLastName: String(data.childLastName || ""),
    childDateOfBirth: String(data.childDateOfBirth || ""),
    childGender: data.childGender,
    level: data.level,
    usaSwimmingId: data.usaSwimmingId,
    parentUID: String(data.parentUID || ""),
    paymentStatus: data.paymentStatus,
    isFrozen: data.isFrozen,
    isTestData: data.isTestData === true || isTestSwimmer({
      isTestData: data.isTestData,
      childFirstName: data.childFirstName,
      childLastName: data.childLastName,
    }),
  };
  return swimmer;
}
