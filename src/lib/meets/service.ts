import { extractEligibilityNotes, inferInvitationStatus } from "./eligibility";
import { effectiveHostDeadline, isPrimeDeadlinePassed, meetPaymentDueAt, pacificYmd, suggestPrimeDeadline } from "./deadlines";
import { exceedsEventLimits, feeForMeetEvents, resolveMeetFeeRates, typicalIndividualEventFee } from "./fees";
import { eventLabel, parseHytekEventFile } from "./hytek-events";
import { mailtoHref } from "./mailto";
import { serializeMeetEntries, serializeMeetPayments, type MeetEntriesPayload, type MeetPaymentRow } from "./entries";
import { applyPendingSourcePatch, calendarItemToDraftMeet, fetchLivePnsCalendar, mergePnsUpdates, pnsDatesChanged, pnsLocationChanged, type PnsCalendarItem } from "./pns-calendar";
import { keepValidMeetDayIds } from "./sessions";
import {
  applyLocationNoticeBump,
  applyMeetVersionBump,
  currentMeetVersion,
  currentNoticeVersion,
  isAttendingCommitment,
  locationChanged,
  parentMeetReviewState,
  reasonsForMeetShapeChange,
  reasonsFromPnsDateDiffs,
} from "./meet-version";
import { buildParentMeetDetail, buildPublicMeetDetail, householdMeetPayments, listParentMeetCards, listPublicMeetCards, listUpcomingSwimmerMeets, parentAccessFlags, type ParentMeetDetail, type PublicMeetDetail } from "./parent-view";
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
import { canPublishToFamilies, finalSwimEventIds, isPrePublishStatus, parentEventLabel, shouldAutoCloseRsvp, statusAfterApprove } from "./workflow";

export class MeetServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function meetServiceStatus(e: unknown): number {
  return e instanceof MeetServiceError ? e.status : 500;
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
    const diffs = meet.pendingSourceDiffs || [];
    const datesChanged = pnsDatesChanged(diffs);
    const feesInPatch =
      Boolean(meet.pendingSourcePatch) &&
      ("surcharge" in (meet.pendingSourcePatch || {}) || "individualEventFee" in (meet.pendingSourcePatch || {}));
    const next = applyPendingSourcePatch(meet);
    const commits = await this.store.listCommitments({ meetId });
    const reasons = [...reasonsFromPnsDateDiffs(diffs), ...reasonsForMeetShapeChange(meet, next)];
    const bumped = applyMeetVersionBump(next, reasons, banner);
    if (bumped !== next) {
      Object.assign(next, bumped);
    } else {
      next.parentUpdateBanner = (banner || "").trim() || undefined;
    }
    if (pnsLocationChanged(diffs) || locationChanged(meet.location, next.location)) {
      Object.assign(next, applyLocationNoticeBump(next, nowIso()));
    }
    if (next.pnsPublishedDeadline) {
      next.effectiveHostDeadline = effectiveHostDeadline(next);
    }
    const saved = await this.store.saveMeet(next);
    if (datesChanged) {
      for (const commitment of commits) {
        const nextDays = keepValidMeetDayIds(saved, commitment.availableSessionIds || []);
        if (nextDays.join(",") !== (commitment.availableSessionIds || []).join(",")) {
          await this.store.saveCommitment({ ...commitment, availableSessionIds: nextDays });
        }
      }
    }
    if (feesInPatch) await this.recalculateConfirmedInvoices(saved);
    return saved;
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
    const feesInPatch = "surcharge" in patch || "individualEventFee" in patch;
    if ("surcharge" in patch) next.surcharge = Number(patch.surcharge) || 0;
    if ("individualEventFee" in patch) next.individualEventFee = Number(patch.individualEventFee) || 0;
    Object.assign(next, applyMeetVersionBump(next, reasonsForMeetShapeChange(meet, next)));
    if (locationChanged(meet.location, next.location)) {
      Object.assign(next, applyLocationNoticeBump(next, nowIso()));
    }
    const saved = await this.store.saveMeet(next);
    if (feesInPatch) await this.recalculateConfirmedInvoices(saved);
    return saved;
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
    const before = { startDate: meet.startDate, endDate: meet.endDate, sessions: meet.sessions, events: meet.events };
    const parsed = parseHytekEventFile(fileContent);
    meet.events = parsed.events;
    meet.sessions = [...new Set(parsed.events.map((e) => e.sessionName))].map((name) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
    }));
    if (parsed.course !== "unknown") meet.course = parsed.course;
    if (!(Number(meet.individualEventFee) > 0)) {
      const typical = typicalIndividualEventFee(parsed.events);
      if (typical != null) meet.individualEventFee = typical;
    }
    if (opts?.accept !== false) {
      meet.eventFileAcceptedAt = nowIso();
      meet.pendingSourceReview = false;
    } else {
      meet.pendingSourceReview = true;
      meet.pendingSourceDiffs = [`Imported ${parsed.events.length} events from event file`];
    }
    const reasons = reasonsForMeetShapeChange(before, meet);
    if (opts?.accept !== false && reasons.length) {
      Object.assign(meet, applyMeetVersionBump(meet, [...reasons, "event_file_changed"]));
    }
    const saved = await this.store.saveMeet(meet);
    await this.recalculateConfirmedInvoices(saved);
    return saved;
  }

  async closeCommitments(meetId: string): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status !== "commitment_open") throw new MeetServiceError("Meet is not open for commitments.");
    meet.status = "commitment_closed";
    meet.commitmentClosedAt = nowIso();
    return this.store.saveMeet(meet);
  }

  async reopenCommitments(meetId: string, now = nowIso()): Promise<Meet> {
    const meet = await this.requireMeet(meetId);
    if (meet.status !== "commitment_closed") {
      throw new MeetServiceError("Only a closed RSVP can be reopened. After entries are sent to the host, do not reopen.");
    }
    if (isPrimeDeadlinePassed(meet.primeCommitmentDeadline, now)) {
      throw new MeetServiceError("Prime Deadline has already passed. Save a later Prime Deadline, then reopen RSVP.");
    }
    meet.status = "commitment_open";
    meet.commitmentClosedAt = "";
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
    const withFees = await this.fillMissingFeeRates(meet);
    const commits = await this.store.listCommitments({ meetId });
    for (const c of commits) {
      if (c.attendance !== "attend") continue;
      const confirmed = c.confirmedEventIds?.length ? c.confirmedEventIds : c.selectedEventIds;
      c.confirmedEventIds = confirmed;
      this.applyFinalInvoice(withFees, c, confirmed, dueAt);
      await this.store.saveCommitment(c);
    }
    withFees.status = "entries_confirmed";
    withFees.entriesConfirmedAt = confirmedAt;
    return this.store.saveMeet(withFees);
  }

  async reportPayment(opts: { meetId: string; swimmerId: string; parentUID: string }): Promise<MeetCommitment> {
    const meet = await this.requireMeet(opts.meetId);
    if (meet.status !== "entries_confirmed" && meet.status !== "upcoming" && meet.status !== "in_progress") {
      throw new MeetServiceError("Payment is only for confirmed meet invoices.");
    }
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment || commitment.parentUID !== opts.parentUID) {
      throw new MeetServiceError("Commitment not found.", 404);
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
        const fee = feeForMeetEvents(meet, working);
        commitment.estimatedFee = fee.total;
        if (meet.status === "host_reply_received") commitment.confirmedEventIds = working;
      }
    }
    return this.store.saveCommitment(commitment);
  }

  private applyFinalInvoice(meet: Meet, commitment: MeetCommitment, eventIds: string[], dueAt?: string) {
    const fee = feeForMeetEvents(meet, eventIds);
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

  private invoiceEventIds(meet: Meet, commitment: MeetCommitment): string[] {
    return finalSwimEventIds({
      attendance: commitment.attendance,
      status: meet.status,
      selectedEventIds: commitment.selectedEventIds || [],
      confirmedEventIds: commitment.confirmedEventIds,
    });
  }

  private invoiceNeedsRepair(meet: Meet, commitment: MeetCommitment): boolean {
    if (parentEventLabel(meet.status) !== "confirmed") return false;
    if (commitment.attendance !== "attend") return false;
    const fee = feeForMeetEvents(meet, this.invoiceEventIds(meet, commitment));
    const stored = Number(commitment.finalFee) || 0;
    if (stored !== fee.total) return true;
    return fee.total > 0 && (commitment.paymentStatus === "none" || !commitment.paymentStatus);
  }

  private async fillMissingFeeRates(meet: Meet): Promise<Meet> {
    const rates = resolveMeetFeeRates(meet);
    let changed = false;
    if (!(Number(meet.surcharge) > 0) && rates.surcharge != null) {
      meet.surcharge = rates.surcharge;
      changed = true;
    }
    if (!(Number(meet.individualEventFee) > 0) && rates.individualEventFee != null) {
      meet.individualEventFee = rates.individualEventFee;
      changed = true;
    }
    return changed ? this.store.saveMeet(meet) : meet;
  }

  private async persistInvoiceIfStale(meet: Meet, commitment: MeetCommitment): Promise<MeetCommitment> {
    if (!this.invoiceNeedsRepair(meet, commitment)) return commitment;
    this.applyFinalInvoice(
      meet,
      commitment,
      this.invoiceEventIds(meet, commitment),
      commitment.paymentDueAt || meetPaymentDueAt(meet.entriesConfirmedAt || nowIso())
    );
    return this.store.saveCommitment(commitment);
  }

  private async recalculateConfirmedInvoices(meet: Meet): Promise<void> {
    if (parentEventLabel(meet.status) !== "confirmed") return;
    const commits = await this.store.listCommitments({ meetId: meet.id });
    for (const commitment of commits) {
      await this.persistInvoiceIfStale(meet, commitment);
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
      await this.recalculateConfirmedInvoices(meet);
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
    const swimmer = await this.requireHouseholdSwimmer(opts.swimmerId, opts.parentUID);
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

    const prev = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    const notes = (opts.parentNotes ?? prev?.parentNotes ?? "").trim();
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
    if (opts.attendance === "attend" && !hasFile && notes.length < 8) {
      throw new MeetServiceError(
        "The host Event File is not posted yet. Write the events they want in Notes — for example: Saturday 50 Fly, 50 Free."
      );
    }
    const fee = feeForMeetEvents(meet, opts.selectedEventIds);
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
      responseVersion: currentMeetVersion(meetNow),
      acknowledgedNoticeVersion: currentNoticeVersion(meetNow),
    };
    const saved = await this.store.saveCommitment(commitment);
    if (meetNow.parentUpdateBanner) {
      const all = await this.store.listCommitments({ meetId: opts.meetId });
      const stillNeed = all.some((row) => parentMeetReviewState(meetNow, row).requiresEventReview);
      if (!stillNeed) {
        meetNow.parentUpdateBanner = undefined;
        await this.store.saveMeet(meetNow);
      }
    }
    return saved;
  }

  async acknowledgeParentMeet(opts: {
    meetId: string;
    swimmerId: string;
    parentUID: string;
    acknowledge: Array<"notice" | "closed_review">;
    nowIso?: string;
  }): Promise<MeetCommitment> {
    const swimmer = await this.requireHouseholdSwimmer(opts.swimmerId, opts.parentUID);
    const clock = opts.nowIso || nowIso();
    const meet = await this.applyDeadlineClose(await this.requireMeet(opts.meetId), clock);
    const commitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    if (!commitment || !isAttendingCommitment(commitment.attendance)) {
      throw new MeetServiceError("No attending response to acknowledge.");
    }
    const kinds = [...new Set(opts.acknowledge)];
    if (kinds.length === 0) throw new MeetServiceError("acknowledge is required.");
    const settings = await this.getSettings();
    const gate = usaSwimmingAttendGate({
      usaSwimmingId: swimmer.usaSwimmingId,
      omrUrl: settings.usaSwimmingOmrUrl,
    });
    const access = parentAccessFlags(meet, clock, gate.canAttend);
    const review = parentMeetReviewState(meet, commitment, access);
    const next = { ...commitment };
    for (const kind of kinds) {
      if (kind === "notice") {
        next.acknowledgedNoticeVersion = currentNoticeVersion(meet);
        continue;
      }
      if (!review.requiresEventReview) {
        throw new MeetServiceError("There is no closed event review to acknowledge.");
      }
      if (access.canRespond) {
        throw new MeetServiceError("RSVP is still open. Confirm events again instead of acknowledging.");
      }
      next.responseVersion = currentMeetVersion(meet);
    }
    return this.store.saveCommitment(next);
  }

  async saveUsaSwimmingId(opts: { swimmerId: string; parentUID: string; usaSwimmingId: string }): Promise<MeetSwimmer> {
    const swimmer = await this.requireHouseholdSwimmer(opts.swimmerId, opts.parentUID);
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
    const closed = await this.applyDeadlineClose(meet, now);
    const withFees = await this.fillMissingFeeRates(closed);
    await this.recalculateConfirmedInvoices(withFees);
    return withFees;
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

  async listPublicMeets(now = nowIso()) {
    const meets = await Promise.all((await this.store.listMeets()).map((meet) => this.applyDeadlineClose(meet, now)));
    return listPublicMeetCards(meets);
  }

  async getPublicMeet(meetId: string, opts?: { viewerIsTestAccount?: boolean; nowIso?: string }): Promise<PublicMeetDetail> {
    const meet = await this.applyDeadlineClose(await this.requireMeet(meetId), opts?.nowIso || nowIso());
    if (!canViewerSeeMeet({ meetIsTestData: meet.isTestData, viewerIsTestAccount: opts?.viewerIsTestAccount === true })) {
      throw new MeetServiceError("Meet not found.");
    }
    const detail = buildPublicMeetDetail(meet);
    if ("error" in detail) throw new MeetServiceError(detail.error);
    return detail;
  }

  async listParentMeets(parentUID: string, email?: string | null, swimmerId?: string, opts?: { nowIso?: string }) {
    const viewerIsTestAccount = await this.viewerIsTestAccount(parentUID, email);
    const clock = opts?.nowIso || nowIso();
    const [rawMeets, commitments, swimmers, settings] = await Promise.all([
      this.store.listMeets(),
      this.store.listCommitments({ parentUID }),
      this.listParentSwimmers(parentUID),
      this.getSettings(),
    ]);
    const meets = await Promise.all(rawMeets.map((meet) => this.applyDeadlineClose(meet, clock)));
    const repaired: MeetCommitment[] = [];
    for (const commitment of commitments) {
      const meet = meets.find((row) => row.id === commitment.meetId);
      repaired.push(meet ? await this.persistInvoiceIfStale(meet, commitment) : commitment);
    }
    return listParentMeetCards({
      meets,
      commitments: swimmerId ? repaired.filter((c) => c.swimmerId === swimmerId) : repaired,
      viewerIsTestAccount,
      swimmerId,
      nowIso: clock,
      swimmers,
      settings,
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
    const upcoming = await this.listUpcomingSwimmerMeets(parentUID, email);
    return { swimmers, meetsBySwimmer: bySwimmer, payments, settings, upcoming };
  }

  async listUpcomingSwimmerMeets(parentUID: string, email?: string | null, opts?: { nowIso?: string; swimmerIds?: string[] }) {
    const viewerIsTestAccount = await this.viewerIsTestAccount(parentUID, email);
    const [rawMeets, commitments, swimmers] = await Promise.all([
      this.store.listMeets(),
      this.store.listCommitments({ parentUID }),
      this.listParentSwimmers(parentUID),
    ]);
    const wanted = [...new Set((opts?.swimmerIds || []).filter(Boolean))];
    if (wanted.some((id) => !swimmers.some((swimmer) => swimmer.id === id))) {
      throw new MeetServiceError("Swimmer not found.", 404);
    }
    const clock = opts?.nowIso || nowIso();
    const [meets, settings] = await Promise.all([
      Promise.all(rawMeets.map((meet) => this.applyDeadlineClose(meet, clock))),
      this.getSettings(),
    ]);
    return listUpcomingSwimmerMeets({
      meets,
      commitments,
      swimmers,
      viewerIsTestAccount,
      todayYmd: pacificYmd(clock),
      swimmerIds: wanted.length ? wanted : undefined,
      nowIso: clock,
      settings,
    });
  }

  async getParentDetail(opts: {
    meetId: string;
    swimmerId: string;
    parentUID: string;
    email?: string | null;
    nowIso?: string;
  }): Promise<ParentMeetDetail> {
    const meet = await this.applyDeadlineClose(await this.requireMeet(opts.meetId), opts.nowIso || nowIso());
    const swimmer = await this.requireHouseholdSwimmer(opts.swimmerId, opts.parentUID);
    const viewerIsTestAccount = await this.viewerIsTestAccount(opts.parentUID, opts.email);
    const rawCommitment = await this.store.getCommitment(opts.meetId, opts.swimmerId);
    const commitment = rawCommitment ? await this.persistInvoiceIfStale(meet, rawCommitment) : rawCommitment;
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
        list.push(eventLabel(event));
        bySession.set(event.sessionName, list);
      }
      const eventLines = [...bySession.entries()]
        .map(([session, events]) => `    ${session}: ${events.join("; ")}`)
        .join("\n");
      const days = c.availableSessionIds.map(prettySessionName).join(", ");
      const dayLine = !eventLines && days ? `    Available: ${days}` : "";
      const noteLine = c.parentNotes ? `    Requested / notes: ${c.parentNotes}` : "";
      const details = [eventLines, dayLine, noteLine].filter(Boolean).join("\n");
      return details ? `${name} (${usa})\n${details}` : `${name} (${usa})`;
    });
    const eventCount = commits.reduce((n, c) => n + c.selectedEventIds.length, 0);
    const to = hostInbox(meet);
    const cleanName = meet.name.replace(/^\[TEST\]\s*/, "");
    const hasFile = Boolean(meet.eventFileAcceptedAt && meet.events.length);
    const subject = hasFile
      ? `Prime Swim Academy entries (SD3 attached) — ${cleanName}`
      : `Prime Swim Academy athlete list — event file not posted yet — ${cleanName}`;
    const athleteSection = athleteBlocks.length
      ? athleteBlocks.join("\n\n")
      : "No Prime swimmers have Attended yet. I will send an updated list as soon as families finish RSVP.";
    const fileParagraph = hasFile
      ? [
          "Please import the attached Standard SD3 in Hy-Tek Meet Manager: File → Import → Entries.",
          "This is the same file TeamUnify/SportsEngine clubs send. Please do not retype these from a spreadsheet.",
        ]
      : [
          "The host Event File (.ev3 / .hyv) is not posted yet, so we cannot send an importable Hy-Tek entry file.",
          "Below is an athlete list only: who intends to attend, and the events families wrote in notes. After you post the Event File we will send a Standard SD3 that Meet Manager can import.",
        ];
    const body = [
      `Hello ${meet.hostClub || "Meet Director"},`,
      "",
      "I hope you are well. Prime Swim Academy is writing about:",
      "",
      `Meet: ${cleanName}`,
      meet.hostClub ? `Host club: ${meet.hostClub}` : "",
      `Dates: ${meet.startDate}${meet.endDate && meet.endDate !== meet.startDate ? ` – ${meet.endDate}` : ""}`,
      meet.location ? `Location: ${meet.location}` : "",
      meet.sanctionNumber ? `Approval / sanction: ${meet.sanctionNumber}` : "",
      "",
      ...fileParagraph,
      "",
      athleteSection,
      "",
      athleteBlocks.length
        ? `Total: ${commits.length} swimmer${commits.length === 1 ? "" : "s"}${hasFile ? `, ${eventCount} individual event${eventCount === 1 ? "" : "s"}` : ""}.`
        : "",
      "",
      hasFile
        ? "Please reply to confirm the imported entries, or list any cuts we should remove."
        : "Please send the Event File when it is ready. We will follow with the SD3.",
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
    if (!meet) throw new MeetServiceError("Meet not found.", 404);
    return meet;
  }

  private async requireSwimmer(id: string): Promise<MeetSwimmer> {
    const swimmer = await this.store.getSwimmer(id);
    if (!swimmer) throw new MeetServiceError("Swimmer not found.", 404);
    return swimmer;
  }

  private async requireHouseholdSwimmer(swimmerId: string, parentUID: string): Promise<MeetSwimmer> {
    const swimmer = await this.requireSwimmer(swimmerId);
    if (swimmer.parentUID !== parentUID) throw new MeetServiceError("Swimmer not found.", 404);
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
