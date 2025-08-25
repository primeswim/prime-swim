// src/hooks/useIsAdminFromDB.ts
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function lower(s?: string | null) {
  return (s || "").trim().toLowerCase();
}

async function checkAdminsInClient(
  emailLower: string,
  uid?: string | null
): Promise<boolean> {
  const colNames = ["admin", "admins"];

  // 1) doc(id = email) / doc(id = uid)
  for (const col of colNames) {
    if (emailLower) {
      const byEmail = await getDoc(doc(db, col, emailLower));
      if (byEmail.exists()) return true;
    }
    if (uid) {
      const byUid = await getDoc(doc(db, col, uid));
      if (byUid.exists()) return true;
    }
  }

  // 2) where(email == emailLower)
  for (const col of colNames) {
    const q = query(
      collection(db, col),
      where("email", "==", emailLower),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return true;
  }

  return false;
}

/** 返回:
 *  - null: 加载中
 *  - true: 是管理员
 *  - false: 非管理员
 */
export function useIsAdminFromDB(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) setIsAdmin(false);
        return;
      }
      try {
        const ok = await checkAdminsInClient(lower(user.email), user.uid);
        if (mounted) setIsAdmin(ok);
      } catch (err) {
        console.error("useIsAdminFromDB error:", err);
        if (mounted) setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return isAdmin;
}
