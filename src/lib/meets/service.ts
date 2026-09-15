import { extractEligibilityNotes, inferInvitationStatus } from "./eligibility";
import { effectiveHostDeadline, isPrimeDeadlinePassed, meetPaymentDueAt, suggestPrimeDeadline } from "./deadlines";
import { exceedsEventLimits, computeHostFee } from "./fees";
import { eventLabel, parseHytekEventFile } from "./hytek-events";
import { mailtoHref } from "./mailto";
import { serializeMeetEntries, serializeMeetPayments, type MeetEntriesPayload, type MeetPaymentRow } from "./entries";
import { applyPendingSourcePatch, calendarItemToDraftMeet, fetchLivePnsCalendar, mergePnsUpdates, type PnsCalendarItem } from "./pns-calendar";
import { buildParentMeetDetail, householdMeetPayments, listParentMeetCards, type ParentMeetDetail } from "./parent-view";
import { commitmentId, type MeetStore } from "./store";
import { canViewerSeeMeet, isTestEmail, isTestRecord, isTestSwimmer, markTestName } from "./test-data";
import type {
  ClubMeetSettings,
  InvitationStatus,
  Meet,
  MeetCommitment,
  MeetSwimmer,
} from "./types";
import { DEFAULT_FEE_POLICY_VERSION, resolveClubMeetSettings } from "./types";
import { isOmrWelcomeUrl, isValidUsaSwimmingId, normalizeUsaSwimmingId, usaSwimmingAttendGate } from "./usa-swimming";
import { canPublishToFamilies, isPrePublishStatus, parentEventLabel, shouldAutoCloseRsvp, statusAfterApprove } from "./workflow";

export class MeetServiceError extends Error {
  constructor(message: string, readonly code = "INVALID") {
    super(message);
  }
}

export interface PnsScanMeet {
  id: string;
  name: string;
  diffs: string[];
}

export interface PnsScanResult {
  count: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  createdMeets: PnsScanMeet[];
  updatedMeets: PnsScanMeet[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export function isAllowedTestHostRecipient(email: string): boolean {
  const to = email.trim().toLowerCase();
  return to === "prime.swim.us@gmail.com" || isTestEmail(to);
}

export function assertSendableHostEmail(meet: Pick<Meet, "isTestData">, to: string) {
  const email = to.trim();
  if (!email.includes("@")) throw new MeetServiceError("Enter a host email address.");
  if (meet.isTestData && !isAllowedTestHostRecipient(email)) {
    throw new MeetServiceError(
      "This is a [TEST] meet. Send only to prime.swim.us@gmail.com or a test inbox so we do not email the real host."
    );
  }
}

function sessionCounts(meet: Meet, eventIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of eventIds) {
    const event = meet.events.find((e) => e.id === id);
    if (!event) continue;
    counts[event.sessionName] = (counts[event.sessionName] || 0) + 1;
  }
  return counts;
}

export class MeetService {
  constructor(private store: MeetStore) {}

  async viewerIsTestAccount(uid: string, email?: string | null): Promise<boolean> {
    if (isTestEmail(email)) return true;
    if (await this.store.isTestAccount(uid, email)) return true;
    const swimmers = await this.store.listSwimmers({ parentUID: uid });
    return swimmers.length > 0 && swimmers.every((s) => isTestSwimmer(s));
  }

  async ingestPns(items: PnsCalendarItem[], opts: { isTestData: boolean }): Promise<Meet[]> {
    const existing = await this.store.listMeets();
    const out: Meet[] = [];
    for (const item of items) {
      const prev = existing.find((m) => m.sourceKey === item.sourceId || m.id === item.sourceId);
      if (!prev) {
        const draft = calendarItemToDraftMeet(item, { isTestData: opts.isTestData });
        draft.sourceLastCheckedAt = nowIso();
        out.push(await this.store.saveMeet(draft));
        continue;
      }
      if (prev.status === "cancelled" || prev.rejectedAt) {
        prev.sourceLastCheckedAt = nowIso();
        out.push(await this.store.saveMeet(prev));
        continue;
      }
      const merged = mergePnsUpdates(prev, item);
      merged.next.sourceLastCheckedAt = nowIso();
      if (isPrePublishStatus(merged.next.status)) {
        const invitationStatus = inferInvitationStatus(`${merged.next.name}\n${merged.next.announcementText || ""}`);
        merged.next.invitationStatus = invitationStatus;
        merged.next.meetType = invitationStatus === "not_required" ? "open" : "invitational";
        merged.next.eligibilityNotes = extractEligibilityNotes(`${merged.next.name}\n${merged.next.announcementText || ""}`);
        if (invitationStatus === "not_required" && merged.next.status === "invitation_pending") {
          merged.next.status = "admin_review";
        }
      }
      if (merged.changed) {
        merged.next.pendingSourceReview = true;
        merged.next.pendingSourceDiffs = merged.diffs;
      }
      out.push(await this.store.saveMeet(merged.next));
    }
    return out;
  }

  async scanLivePns(): Promise<PnsScanResult> {
    const items = await fetchLivePnsCalendar();
    const before = await this.store.listMeets();
    const known = new Set(before.map((m) => m.sourceKey || m.id));
    const meets = await this.ingestPns(items, { isTestData: false });
    const createdMeets: PnsScanMeet[] = [];
    const updatedMeets: PnsScanMeet[] = [];
    let skipped = 0;
    let unchanged = 0;
    for (const meet of meets) {
      const key = meet.sourceKey || meet.id;
      const summary = { id: meet.id, name: meet.name, diffs: meet.pendingSourceDiffs || [] };
      if (!known.has(key)) {
        createdMeets.push(summary);
        continue;
      }
      const prev = before.find((m) => (m.sourceKey || m.id) === key);
      if (prev?.status === "cancelled" || prev?.rejectedAt) {
        skipped += 1;
        continue;
      }
      if (meet.pendingSourceReview) updatedMeets.push(summary);
      else unchanged += 1;
    }
    return {
      count: items.length,
      created: createdMeets.length,
      updated: updatedMeets.length,
      unchanged,
      skipped,
      createdMeets,
      updatedMeets,
    };
  }

  async acceptSourceUpdate(meetId: string, banner?: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    const next = applyPendingSourcePatch(meet);
    if (banner) next.parentUpdateBanner = banner;
    if (next.pnsPublishedDeadline) {
      next.effectiveHostDeadline = effectiveHostDeadline(next);
    }
    return this.store.saveMeet(next);
  }

  async dismissSourceUpdate(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    meet.pendingSourceReview = false;
    meet.pendingSourceDiffs = [];
    meet.pendingSourcePatch = undefined;
    return this.store.saveMeet(meet);
  }

  async updateMeet(meetId: string, patch: Partial<Meet>): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    const next = { ...meet, ...patch, id: meet.id, isTestData: meet.isTestData };
    if (next.name && meet.isTestData) next.name = markTestName(next.name);
    next.effectiveHostDeadline = effectiveHostDeadline(next);
    if (!patch.primeCommitmentDeadline && !meet.primeCommitmentDeadline) {
      next.primeCommitmentDeadline = suggestPrimeDeadline(next.effectiveHostDeadline);
    }
    if (
      next.status === "commitment_closed" &&
      patch.primeCommitmentDeadline &&
      !isPrimeDeadlinePassed(next.primeCommitmentDeadline)
    ) {
      next.status = "commitment_open";
      next.commitmentClosedAt = undefined;
    }
    return this.store.saveMeet(next);
  }

  async setInvitationStatus(meetId: string, invitationStatus: InvitationStatus): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    meet.invitationStatus = invitationStatus;
    if (invitationStatus === "invited" && meet.status === "invitation_pending") {
      meet.status = "ready_to_publish";
    }
    if (invitationStatus === "not_required") {
      meet.meetType = "open";
      if (isPrePublishStatus(meet.status)) meet.status = "ready_to_publish";
    }
    if (invitationStatus === "declined") meet.status = "cancelled";
    return this.store.saveMeet(meet);
  }

  async approveMeet(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    meet.status = statusAfterApprove(meet.invitationStatus);
    return this.store.saveMeet(meet);
  }

  async rejectMeet(meetId: string, reason?: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (!isPrePublishStatus(meet.status)) {
      throw new MeetServiceError("Only unpublished meets can be rejected. Families already see this one.");
    }
    meet.status = "cancelled";
    meet.rejectedAt = nowIso();
    meet.rejectedReason = (reason || "Admin chose not to post this meet to families.").trim();
    meet.pendingSourceReview = false;
    return this.store.saveMeet(meet);
  }

  async publishToFamilies(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (["draft", "admin_review", "invitation_pending"].includes(meet.status)) {
      meet.status = statusAfterApprove(meet.invitationStatus);
    }
    const gate = canPublishToFamilies(meet);
    if (!gate.ok) throw new MeetServiceError(gate.reason);
    meet.status = "commitment_open";
    meet.publishedToFamiliesAt = nowIso();
    return this.store.saveMeet(meet);
  }

  async importEventFile(meetId: string, fileContent: string, opts?: { accept?: boolean }): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    const parsed = parseHytekEventFile(fileContent);
    meet.events = parsed.events;
    meet.sessions = [...new Set(parsed.events.map((e) => e.sessionName))].map((name) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
    }));
    if (parsed.course !== "unknown") meet.course = parsed.course;
    if (opts?.accept !== false) {
      meet.eventFileAcceptedAt = nowIso();
      meet.pendingSourceReview = false;
    } else {
      meet.pendingSourceReview = true;
      meet.pendingSourceDiffs = [`Imported ${parsed.events.length} events from event file`];
    }
    return this.store.saveMeet(meet);
  }

  async closeCommitments(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status !== "commitment_open") throw new MeetServiceError("Meet is not open for commitments.");
    meet.status = "commitment_closed";
    return this.store.saveMeet(meet);
  }

  async markSubmitted(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status === "submitted") return meet;
    if (meet.status !== "commitment_closed" && meet.status !== "commitment_open") {
      throw new MeetServiceError("Meet must be closed or open before submit.");
    }
    const commits = await this.store.listCommitments({ meetId });
    const ready = commits.filter((c) => c.attendance === "attend");
    if (!ready.length) throw new MeetServiceError("No Attend responses to submit.");
    meet.status = "submitted";
    meet.entriesSubmittedAt = nowIso();
    return this.store.saveMeet(meet);
  }

  async recordHostReply(meetId: string, summary: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status !== "submitted" && meet.status !== "host_reply_received") {
      throw new MeetServiceError("Record host reply after entries are sent.");
    }
    meet.status = "host_reply_received";
    meet.hostReplyAt = nowIso();
    meet.hostReplySummary = summary;
    return this.store.saveMeet(meet);
  }

  async removeCutEvents(opts: {
    meetId: string;
    swimmerId: string;
    keepEventIds: string[];
    note?: string;
  }): Promise<MeetCommitment> {
    const meet = await this.requireMeet(opts.meetId);
    if (meet.status !== "host_reply_received") {
      throw new MeetServiceError("Cuts can be applied after the host reply is recorded.");
    }
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment) throw new MeetServiceError("No commitment for this swimmer.");
    commitment.confirmedEventIds = opts.keepEventIds.filter((id) => commitment.selectedEventIds.includes(id));
    commitment.hostCutNote = opts.note;
    return this.store.saveCommitment(commitment);
  }

  async publishConfirmed(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status !== "host_reply_received") {
      throw new MeetServiceError("Publish confirmed only after host reply and cuts.");
    }
    const confirmedAt = nowIso();
    const dueAt = meetPaymentDueAt(confirmedAt);
    const commits = await this.store.listCommitments({ meetId });
    for (const c of commits) {
      if (c.attendance !== "attend") continue;
      const confirmed = c.confirmedEventIds?.length ? c.confirmedEventIds : c.selectedEventIds;
      c.confirmedEventIds = confirmed;
      this.applyFinalInvoice(meet, c, confirmed, dueAt);
      await this.store.saveCommitment(c);
    }
    meet.status = "entries_confirmed";
    meet.entriesConfirmedAt = confirmedAt;
    return this.store.saveMeet(meet);
  }

  async reportPayment(opts: { meetId: string; swimmerId: string; parentUID: string }): Promise<MeetCommitment> {
    const meet = await this.requireMeet(opts.meetId);
    if (meet.status !== "entries_confirmed" && meet.status !== "upcoming" && meet.status !== "in_progress") {
      throw new MeetServiceError("Payment is only for confirmed meet invoices.");
    }
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment || commitment.parentUID !== opts.parentUID) {
      throw new MeetServiceError("Commitment not found.");
    }
    if (commitment.paymentStatus === "paid") return commitment;
    commitment.paymentStatus = "payment_reported";
    commitment.paymentReportedAt = nowIso();
    return this.store.saveCommitment(commitment);
  }

  async markPaid(opts: { meetId: string; swimmerId: string }): Promise<MeetCommitment> {
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment) throw new MeetServiceError("Commitment not found.");
    commitment.paymentStatus = "paid";
    commitment.paidAt = nowIso();
    return this.store.saveCommitment(commitment);
  }

  async markUnpaid(opts: { meetId: string; swimmerId: string }): Promise<MeetCommitment> {
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment) throw new MeetServiceError("Commitment not found.");
    if ((commitment.finalFee || 0) <= 0) {
      commitment.paymentStatus = "none";
      return this.store.saveCommitment(commitment);
    }
    commitment.paymentStatus = "invoice_ready";
    commitment.paidAt = "";
    commitment.paymentReportedAt = "";
    return this.store.saveCommitment(commitment);
  }

  async updateAdminCommitment(opts: {
    meetId: string;
    swimmerId: string;
    attendance?: "attend" | "decline";
    availableSessionIds?: string[];
    eventIds?: string[];
    parentNotes?: string;
    hostCutNote?: string;
  }): Promise<MeetCommitment> {
    const meet = await this.requireMeet(opts.meetId);
    const swimmer = await this.requireSwimmer(opts.swimmerId);
    let commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment) {
      commitment = {
        id: commitmentId(opts.meetId, opts.swimmerId),
        meetId: opts.meetId,
        swimmerId: opts.swimmerId,
        parentUID: swimmer.parentUID,
        attendance: "no_response",
        availableSessionIds: [],
        selectedEventIds: [],
        parentNotes: "",
        isTestData: meet.isTestData || Boolean(swimmer.isTestData),
      };
    }
    if (opts.attendance) commitment.attendance = opts.attendance;
    if (opts.availableSessionIds) commitment.availableSessionIds = opts.availableSessionIds;
    if (opts.parentNotes != null) commitment.parentNotes = opts.parentNotes;
    if (opts.hostCutNote != null) commitment.hostCutNote = opts.hostCutNote;

    const finalized = parentEventLabel(meet.status) === "confirmed";
    const afterHostReply = meet.status === "host_reply_received" || finalized;
    if (opts.eventIds) {
      if (afterHostReply) commitment.confirmedEventIds = opts.eventIds;
      else commitment.selectedEventIds = opts.eventIds;
    }

    if (commitment.attendance === "decline") {
      commitment.confirmedEventIds = [];
      commitment.finalFee = 0;
      commitment.paymentStatus = "none";
      commitment.paymentDueAt = undefined;
      commitment.estimatedFee = 0;
    } else if (opts.eventIds || opts.attendance === "attend") {
      const working = afterHostReply
        ? commitment.confirmedEventIds?.length
          ? commitment.confirmedEventIds
          : commitment.selectedEventIds
        : commitment.selectedEventIds;
      if (finalized) {
        this.applyFinalInvoice(
          meet,
          commitment,
          working,
          commitment.paymentDueAt || meetPaymentDueAt(meet.entriesConfirmedAt || nowIso())
        );
      } else {
        const fee = computeHostFee({
          surcharge: meet.surcharge,
          individualEventFee: meet.individualEventFee,
          eventCount: working.length,
        });
        commitment.estimatedFee = fee.total;
        if (meet.status === "host_reply_received") commitment.confirmedEventIds = working;
      }
    }
    return this.store.saveCommitment(commitment);
  }

  private applyFinalInvoice(meet: Meet, commitment: MeetCommitment, eventIds: string[], dueAt?: string) {
    const fee = computeHostFee({
      surcharge: meet.surcharge,
      individualEventFee: meet.individualEventFee,
      eventCount: eventIds.length,
    });
    commitment.confirmedEventIds = eventIds;
    commitment.finalFee = fee.total;
    commitment.paymentDueAt = dueAt;
    if (fee.total <= 0) {
      commitment.paymentStatus = "none";
      return;
    }
    if (commitment.paymentStatus !== "paid" && commitment.paymentStatus !== "payment_reported") {
      commitment.paymentStatus = "invoice_ready";
    }
  }

  async exportMeetEntries(meetId: string): Promise<MeetEntriesPayload> {
    const meet = await this.requireMeet(meetId);
    const commitments = await this.store.listCommitments({ meetId });
    const swimmers = await this.listSwimmersByIds([...new Set(commitments.map((c) => c.swimmerId))]);
    return serializeMeetEntries(meet, commitments, swimmers);
  }

  async listMeetPayments(now = nowIso()): Promise<MeetPaymentRow[]> {
    const meets = await this.listAdminMeets(now);
    const rows: MeetPaymentRow[] = [];
    for (const meet of meets) {
      if (parentEventLabel(meet.status) !== "confirmed") continue;
      const commitments = await this.store.listCommitments({ meetId: meet.id });
      const swimmers = await this.listSwimmersByIds([...new Set(commitments.map((c) => c.swimmerId))]);
      rows.push(...serializeMeetPayments({ meet, commitments, swimmers, nowIso: now }));
    }
    return rows.sort((a, b) => `${b.startDate}${b.meetName}`.localeCompare(`${a.startDate}${a.meetName}`));
  }

  async saveParentCommitment(opts: {
    meetId: string;
    swimmerId: string;
    parentUID: string;
    attendance: "attend" | "decline";
    availableSessionIds: string[];
    selectedEventIds: string[];
    parentNotes: string;
    acceptFeePolicy?: boolean;
    nowIso?: string;
  }): Promise<MeetCommitment> {
    const meet = await this.requireMeet(opts.meetId);
    const swimmer = await this.requireSwimmer(opts.swimmerId);
    if (swimmer.parentUID !== opts.parentUID) throw new MeetServiceError("Swimmer does not belong to this parent.");
    const viewerIsTest = await this.viewerIsTestAccount(opts.parentUID);
    if (!canViewerSeeMeet({ meetIsTestData: meet.isTestData, viewerIsTestAccount: viewerIsTest })) {
      throw new MeetServiceError("Meet not found.");
    }
    const clock = opts.nowIso || nowIso();
    const meetNow = await this.applyDeadlineClose(meet, clock);
    if (meetNow.status !== "commitment_open") throw new MeetServiceError("This meet is not open for changes.");
    if (isPrimeDeadlinePassed(meetNow.primeCommitmentDeadline, clock)) {
      throw new MeetServiceError("Prime Deadline has passed. RSVP closed the next day.");
    }

    const settings = await this.store.getSettings();
    const gate = usaSwimmingAttendGate({
      usaSwimmingId: swimmer.usaSwimmingId,
      omrUrl: settings.usaSwimmingOmrUrl,
    });
    if (opts.attendance === "attend" && !gate.canAttend) {
      throw new MeetServiceError(gate.reason);
    }
    if (opts.attendance === "attend" && !opts.acceptFeePolicy) {
      throw new MeetServiceError("Fee policy must be accepted to Attend.");
    }
    if (opts.attendance === "attend" && opts.availableSessionIds.length === 0) {
      throw new MeetServiceError("Select at least one day to Attend.");
    }

    const hasFile = Boolean(meet.eventFileAcceptedAt && meet.events.length);
    if (opts.attendance === "attend" && hasFile && opts.selectedEventIds.length === 0) {
      // Allowed as incomplete if they only picked days; we persist incomplete
    }
    if (hasFile) {
      const validIds = new Set(meet.events.map((e) => e.id));
      if (opts.selectedEventIds.some((id) => !validIds.has(id))) {
        throw new MeetServiceError("One or more selected events are not on this meet.");
      }
      const limit = exceedsEventLimits({
        selectedCount: opts.selectedEventIds.length,
        maxEventsMeet: meet.maxEventsMeet,
        sessionCounts: sessionCounts(meet, opts.selectedEventIds),
        maxEventsBySession: meet.maxEventsBySession,
      });
      if (!limit.ok) throw new MeetServiceError(limit.reason);
    } else if (opts.selectedEventIds.length) {
      throw new MeetServiceError("Event selection is not open until the Event File is available.");
    }

    const prev = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    const notes = opts.parentNotes ?? prev?.parentNotes ?? "";
    const fee = computeHostFee({
      surcharge: meet.surcharge,
      individualEventFee: meet.individualEventFee,
      eventCount: opts.selectedEventIds.length,
    });
    const incomplete =
      opts.attendance === "attend" && (opts.availableSessionIds.length === 0 || (hasFile && opts.selectedEventIds.length === 0));

    const commitment: MeetCommitment = {
      id: prev?.id || commitmentId(opts.meetId, opts.swimmerId),
      meetId: opts.meetId,
      swimmerId: opts.swimmerId,
      parentUID: opts.parentUID,
      attendance: incomplete ? "incomplete" : opts.attendance,
      availableSessionIds: opts.availableSessionIds,
      selectedEventIds: hasFile ? opts.selectedEventIds : [],
      confirmedEventIds: prev?.confirmedEventIds,
      parentNotes: notes,
      hostCutNote: prev?.hostCutNote,
      feePolicyVersion: opts.acceptFeePolicy ? DEFAULT_FEE_POLICY_VERSION : prev?.feePolicyVersion,
      feePolicyAcceptedAt: opts.acceptFeePolicy ? clock : prev?.feePolicyAcceptedAt,
      estimatedFee: opts.attendance === "attend" ? fee.total : 0,
      finalFee: prev?.finalFee,
      paymentStatus: opts.attendance === "attend" ? "estimated" : "none",
      isTestData: meet.isTestData,
    };
    return this.store.saveCommitment(commitment);
  }

  async saveUsaSwimmingId(opts: { swimmerId: string; parentUID: string; usaSwimmingId: string }): Promise<MeetSwimmer> {
    const swimmer = await this.requireSwimmer(opts.swimmerId);
    if (swimmer.parentUID !== opts.parentUID) throw new MeetServiceError("Swimmer does not belong to this parent.");
    if (!isValidUsaSwimmingId(opts.usaSwimmingId)) {
      throw new MeetServiceError("Enter a valid USA Swimming ID (6–14 letters or numbers).");
    }
    swimmer.usaSwimmingId = normalizeUsaSwimmingId(opts.usaSwimmingId);
    return this.store.saveSwimmer(swimmer);
  }

  async getSettings(): Promise<ClubMeetSettings> {
    return resolveClubMeetSettings(await this.store.getSettings());
  }

  async saveSettings(settings: ClubMeetSettings): Promise<ClubMeetSettings> {
    const next = resolveClubMeetSettings(settings);
    if (!isOmrWelcomeUrl(next.usaSwimmingOmrUrl)) {
      throw new MeetServiceError("Club OMR link must be a USA Swimming /omr/welcome URL.");
    }
    return this.store.saveSettings(next);
  }

  async listAdminMeets(now = nowIso()): Promise<Meet[]> {
    const meets = await this.store.listMeets();
    return Promise.all(meets.map((meet) => this.applyDeadlineClose(meet, now)));
  }

  async getAdminMeet(id: string, now = nowIso()): Promise<Meet | null> {
    const meet = await this.store.getMeet(id);
    if (!meet) return null;
    return this.applyDeadlineClose(meet, now);
  }

  async listMeetCommitments(meetId: string) {
    return this.store.listCommitments({ meetId });
  }

  async listParentSwimmers(parentUID: string) {
    return this.store.listSwimmers({ parentUID });
  }

  async listSwimmersByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.store.listSwimmers({ ids });
  }

  async listParentMeets(parentUID: string, email?: string | null, swimmerId?: string) {
    const viewerIsTestAccount = await this.viewerIsTestAccount(parentUID, email);
    const [rawMeets, commitments] = await Promise.all([this.store.listMeets(), this.store.listCommitments({ parentUID })]);
    const meets = await Promise.all(rawMeets.map((meet) => this.applyDeadlineClose(meet)));
    return listParentMeetCards({
      meets,
      commitments: swimmerId ? commitments.filter((c) => c.swimmerId === swimmerId) : commitments,
      viewerIsTestAccount,
      swimmerId,
    });
  }

  async listParentDashboard(parentUID: string, email?: string | null) {
    const swimmers = await this.listParentSwimmers(parentUID);
    const bySwimmer: Record<string, Awaited<ReturnType<MeetService["listParentMeets"]>>> = {};
    for (const swimmer of swimmers) {
      bySwimmer[swimmer.id] = await this.listParentMeets(parentUID, email, swimmer.id);
    }
    const payments = Object.entries(bySwimmer).flatMap(([swimmerId, cards]) =>
      householdMeetPayments(cards).map((card) => ({ ...card, swimmerId }))
    );
    const settings = await this.getSettings();
    return { swimmers, meetsBySwimmer: bySwimmer, payments, settings };
  }

  async getParentDetail(opts: {
    meetId: string;
    swimmerId: string;
    parentUID: string;
    email?: string | null;
    nowIso?: string;
  }): Promise<ParentMeetDetail> {
    const meet = await this.applyDeadlineClose(await this.requireMeet(opts.meetId), opts.nowIso || nowIso());
    const swimmer = await this.requireSwimmer(opts.swimmerId);
    if (swimmer.parentUID !== opts.parentUID) throw new MeetServiceError("Swimmer does not belong to this parent.");
    const viewerIsTestAccount = await this.viewerIsTestAccount(opts.parentUID, opts.email);
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    const settings = await this.getSettings();
    const detail = buildParentMeetDetail({
      meet,
      swimmer,
      commitment,
      settings,
      nowIso: opts.nowIso || nowIso(),
      viewerIsTestAccount,
    });
    if ("error" in detail) throw new MeetServiceError(detail.error);
    return detail;
  }

  async composeInvitationInquiryEmail(meetId: string): Promise<{
    to: string;
    subject: string;
    body: string;
    html: string;
    mailto: string;
    eventCount: number;
    swimmerCount: number;
    readyToSend: boolean;
    testSafeTo: boolean;
  }> {
    const meet = await this.requireMeet(meetId);
    const to = hostInbox(meet);
    const cleanName = meet.name.replace(/^\[TEST\]\s*/, "");
    const host = meet.hostClub || "Meet Director";
    const dates =
      meet.endDate && meet.endDate !== meet.startDate ? `${meet.startDate} – ${meet.endDate}` : meet.startDate;
    const subject = `Invitation request from Prime Swim Academy — ${cleanName}`;
    const body = [
      `Hello ${host},`,
      "",
      "I hope you are well. I am writing from Prime Swim Academy.",
      "",
      `${cleanName} is listed as an invitational. We would be grateful if you would consider inviting Prime Swim Academy to participate.`,
      dates ? `Meet dates: ${dates}.` : "",
      meet.location ? `Location: ${meet.location}.` : "",
      "",
      "If an invitation is possible, please let us know. When convenient, please also send the Hy-Tek Event File (.hyv or .ev3) so we can share the event list with our families.",
      "",
      "Thank you very much for your time and consideration.",
      "",
      "Warm regards,",
      "Prime Swim Academy",
      "Meet coordinator",
      "prime.swim.us@gmail.com",
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      to,
      subject,
      body,
      html: entryEmailHtml(body),
      mailto: mailtoHref(to, subject, body),
      eventCount: 0,
      swimmerCount: 0,
      readyToSend: Boolean(to && body),
      testSafeTo: !meet.isTestData || isAllowedTestHostRecipient(to),
    };
  }

  async markInvitationRequested(meetId: string, to?: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.invitationStatus !== "invited" && meet.invitationStatus !== "declined") {
      meet.invitationStatus = "requested";
    }
    meet.invitationEmailTo = (to || hostInbox(meet)).trim();
    meet.invitationEmailSentAt = nowIso();
    return this.store.saveMeet(meet);
  }

  async composeEntryEmail(meetId: string): Promise<{
    to: string;
    subject: string;
    body: string;
    html: string;
    mailto: string;
    eventCount: number;
    swimmerCount: number;
    readyToSend: boolean;
    testSafeTo: boolean;
  }> {
    const meet = await this.requireMeet(meetId);
    const commits = (await this.store.listCommitments({ meetId })).filter((c) => c.attendance === "attend");
    const swimmers = commits.length ? await this.store.listSwimmers({ ids: commits.map((c) => c.swimmerId) }) : [];
    const byId = new Map(swimmers.map((s) => [s.id, s]));
    const athleteBlocks = commits.map((c) => {
      const s = byId.get(c.swimmerId);
      const name = s ? `${s.childFirstName} ${s.childLastName}` : c.swimmerId;
      const usa = s?.usaSwimmingId ? `USA Swimming ID ${s.usaSwimmingId}` : "USA Swimming ID on file";
      const bySession = new Map<string, string[]>();
      for (const id of c.selectedEventIds) {
        const event = meet.events.find((e) => e.id === id);
        if (!event) continue;
        const list = bySession.get(event.sessionName) || [];
        list.push(`#${event.eventNumber} ${eventLabel(event)}`);
        bySession.set(event.sessionName, list);
      }
      const eventLines = [...bySession.entries()]
        .map(([session, events]) => `    ${session}: ${events.join("; ")}`)
        .join("\n");
      const days = c.availableSessionIds.map(prettySessionName).join(", ");
      const dayLine = !eventLines && days ? `    Available: ${days}` : "";
      const details = [eventLines, dayLine].filter(Boolean).join("\n");
      return details ? `${name} (${usa})\n${details}` : `${name} (${usa})`;
    });
    const eventCount = commits.reduce((n, c) => n + c.selectedEventIds.length, 0);
    const to = hostInbox(meet);
    const cleanName = meet.name.replace(/^\[TEST\]\s*/, "");
    const subject = `Prime Swim Academy entries — ${cleanName}`;
    const athleteSection = athleteBlocks.length
      ? athleteBlocks.join("\n\n")
      : "No Prime swimmers have Attended yet. I will send an updated list as soon as families finish RSVP.";
    const body = [
      `Hello ${meet.hostClub || "Meet Director"},`,
      "",
      "I hope you are well. Prime Swim Academy is submitting entries for:",
      "",
      `Meet: ${cleanName}`,
      meet.hostClub ? `Host club: ${meet.hostClub}` : "",
      `Dates: ${meet.startDate}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${meet.endDate}` : ""}`,
      meet.location ? `Location: ${meet.location}` : "",
      meet.sanctionNumber ? `Approval / sanction: ${meet.sanctionNumber}` : "",
      "",
      "Please accept the following Prime Swim Academy athletes and events:",
      "",
      athleteSection,
      "",
      athleteBlocks.length
        ? `Total: ${commits.length} swimmer${commits.length === 1 ? "" : "s"}, ${eventCount} individual event${eventCount === 1 ? "" : "s"}.`
        : "",
      "",
      "Please reply to this email to confirm the entries, or list any cuts we should remove. If you need a Hy-Tek / SD3 file, we can send that in a follow-up.",
      "",
      "Thank you,",
      "Prime Swim Academy",
      "Meet entries",
      "prime.swim.us@gmail.com",
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      to,
      subject,
      body,
      html: entryEmailHtml(body),
      mailto: mailtoHref(to, subject, body),
      eventCount,
      swimmerCount: commits.length,
      readyToSend: Boolean(to && athleteBlocks.length),
      testSafeTo: !meet.isTestData || isAllowedTestHostRecipient(to),
    };
  }

  async recordEntryEmailSent(meetId: string, to: string): Promise<Meet> {
    await this.markSubmitted(meetId);
    const meet = await this.requireMeet(meetId);
    meet.entryEmailTo = to;
    meet.entryEmailSentAt = nowIso();
    return this.store.saveMeet(meet);
  }

  private async applyDeadlineClose(meet: Meet, now = nowIso()): Promise<Meet> {
    if (!shouldAutoCloseRsvp(meet, now)) return meet;
    meet.status = "commitment_closed";
    meet.commitmentClosedAt = now;
    return this.store.saveMeet(meet);
  }

  private async requireMeet(id: string): Promise<Meet> {
    const meet = await this.store.getMeet(id);
    if (!meet) throw new MeetServiceError("Meet not found.");
    return meet;
  }

  private async requireSwimmer(id: string): Promise<MeetSwimmer> {
    const swimmer = await this.store.getSwimmer(id);
    if (!swimmer) throw new MeetServiceError("Swimmer not found.");
    return swimmer;
  }
}

function prettySessionName(id: string): string {
  if (!id) return id;
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function hostInbox(meet: Pick<Meet, "hostEntryEmail" | "announcementText">): string {
  if (meet.hostEntryEmail?.includes("@")) return meet.hostEntryEmail.trim();
  const found = (meet.announcementText || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return found?.[0] || "";
}

function entryEmailHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1e293b">${escaped}</div>`;
}

export function assertNoProductionLeak(meets: Meet[], viewerIsTestAccount: boolean) {
  for (const meet of meets) {
    if (!canViewerSeeMeet({ meetIsTestData: isTestRecord(meet), viewerIsTestAccount })) {
      throw new MeetServiceError("Test/production meet isolation violated.");
    }
  }
}
