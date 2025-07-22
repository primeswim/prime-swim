"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase"; // 你的 firebase 初始化模块

export function userIsAdminFromDB(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const db = getFirestore(app);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminRef = doc(db, "admin", user.email);
        const adminDoc = await getDoc(adminRef);
        setIsAdmin(adminDoc.exists());
      } catch (error) {
        console.error("Error checking admin:", error);
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, [db]);

  return isAdmin;
}
