import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

/** Ends the Firebase session, then hard-navigates so family pages cannot keep stale RSVP data. */
export async function signOutToLogin() {
  try {
    await signOut(auth);
  } finally {
    window.location.assign("/login");
  }
}
