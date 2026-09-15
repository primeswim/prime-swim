import type { ClubMeetSettings, Meet, MeetCommitment, MeetSwimmer } from "./types";
import { DEFAULT_CLUB_MEET_SETTINGS } from "./types";

export interface MeetStore {
  listMeets(): Promise<Meet[]>;
  getMeet(id: string): Promise<Meet | null>;
  saveMeet(meet: Meet): Promise<Meet>;
  listCommitments(opts?: { meetId?: string; parentUID?: string; swimmerId?: string }): Promise<MeetCommitment[]>;
  getCommitment(meetId: string, swimmerId: string): Promise<MeetCommitment | null>;
  saveCommitment(commitment: MeetCommitment): Promise<MeetCommitment>;
  listSwimmers(opts?: { parentUID?: string; ids?: string[] }): Promise<MeetSwimmer[]>;
  getSwimmer(id: string): Promise<MeetSwimmer | null>;
  saveSwimmer(swimmer: MeetSwimmer): Promise<MeetSwimmer>;
  getSettings(): Promise<ClubMeetSettings>;
  saveSettings(settings: ClubMeetSettings): Promise<ClubMeetSettings>;
  isTestAccount(uid: string, email?: string | null): Promise<boolean>;
  markTestAccount(uid: string, email?: string | null): Promise<void>;
}

export function commitmentId(meetId: string, swimmerId: string): string {
  return `${meetId}__${swimmerId}`;
}

export class MemoryMeetStore implements MeetStore {
  meets = new Map<string, Meet>();
  commitments = new Map<string, MeetCommitment>();
  swimmers = new Map<string, MeetSwimmer>();
  settings: ClubMeetSettings = { ...DEFAULT_CLUB_MEET_SETTINGS };
  testAccounts = new Set<string>();

  async listMeets(): Promise<Meet[]> {
    return [...this.meets.values()];
  }
  async getMeet(id: string): Promise<Meet | null> {
    return this.meets.get(id) || null;
  }
  async saveMeet(meet: Meet): Promise<Meet> {
    this.meets.set(meet.id, { ...meet, updatedAt: new Date().toISOString() });
    return this.meets.get(meet.id)!;
  }
  async listCommitments(opts?: { meetId?: string; parentUID?: string; swimmerId?: string }): Promise<MeetCommitment[]> {
    return [...this.commitments.values()].filter((c) => {
      if (opts?.meetId && c.meetId !== opts.meetId) return false;
      if (opts?.parentUID && c.parentUID !== opts.parentUID) return false;
      if (opts?.swimmerId && c.swimmerId !== opts.swimmerId) return false;
      return true;
    });
  }
  async getCommitment(meetId: string, swimmerId: string): Promise<MeetCommitment | null> {
    return this.commitments.get(commitmentId(meetId, swimmerId)) || null;
  }
  async saveCommitment(commitment: MeetCommitment): Promise<MeetCommitment> {
    const id = commitment.id || commitmentId(commitment.meetId, commitment.swimmerId);
    const next = { ...commitment, id, updatedAt: new Date().toISOString() };
    this.commitments.set(id, next);
    return next;
  }
  async listSwimmers(opts?: { parentUID?: string; ids?: string[] }): Promise<MeetSwimmer[]> {
    return [...this.swimmers.values()].filter((s) => {
      if (opts?.parentUID && s.parentUID !== opts.parentUID) return false;
      if (opts?.ids && !opts.ids.includes(s.id)) return false;
      return true;
    });
  }
  async getSwimmer(id: string): Promise<MeetSwimmer | null> {
    return this.swimmers.get(id) || null;
  }
  async saveSwimmer(swimmer: MeetSwimmer): Promise<MeetSwimmer> {
    this.swimmers.set(swimmer.id, swimmer);
    return swimmer;
  }
  async getSettings(): Promise<ClubMeetSettings> {
    return { ...this.settings };
  }
  async saveSettings(settings: ClubMeetSettings): Promise<ClubMeetSettings> {
    this.settings = { ...settings };
    return this.getSettings();
  }
  async isTestAccount(uid: string, email?: string | null): Promise<boolean> {
    if (this.testAccounts.has(uid)) return true;
    if (email && this.testAccounts.has(email.toLowerCase())) return true;
    return false;
  }
  async markTestAccount(uid: string, email?: string | null): Promise<void> {
    this.testAccounts.add(uid);
    if (email) this.testAccounts.add(email.toLowerCase());
  }
}
