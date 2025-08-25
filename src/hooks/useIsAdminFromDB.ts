// app/hooks/useIsAdminFromDB.ts
"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, getDocs, collection, query, where, limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; // 直接用你现有的导出

function lower(s?: string | null) {
  return (s || "").trim().toLowerCase();
}

async function checkAdminsInClient(emailLower: string, uid?: string | null) {
  // 允许两种集合名：admin / admins
  const colNames = ["admin", "admins"];

  // 1) 尝试 doc(id=email) / doc(id=uid)
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

  // 2) 尝试字段匹配 email == {emailLower}
  for (const col of colNames) {
    const q = query(collection(db, col), where("email", "==", emailLower), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return true;
  }

  return false;
}

/**
 * 返回 null=加载中, true=是管理员, false=不是管理员
 */
export function useIsAdminFromDB(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        mounted && setIsAdmin(false);
        return;
      }
      try {
        const ok = await checkAdminsInClient(lower(user.email), user.uid);
        mounted && setIsAdmin(ok);
      } catch (err) {
        console.error("useIsAdminFromDB error:", err);
        mounted && setIsAdmin(false);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return isAdmin;
}
