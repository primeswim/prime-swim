import { adminDb } from "@/lib/firebaseAdmin";
import { FirestoreMeetStore } from "./firestore-store";
import { MeetService } from "./service";

export function getMeetService(): MeetService {
  return new MeetService(new FirestoreMeetStore(adminDb));
}
