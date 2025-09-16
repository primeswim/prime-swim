// app/admin/makeup/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";

type SwimmerPick = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail?: string;
};

type SwimmerFS = {
  childFirstName?: string;
  childLastName?: string;
  swimmerName?: string;
  name?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentName?: string;
  parentEmail?: string;
  parentEmails?: string[];
};

export default function MakeupAdminPage() {
  const isAdmin = useIsAdminFromDB();
  const [swimmers, setSwimmers] = useState<SwimmerPick[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [makeupText, setMakeupText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "swimmers"));
      const arr: SwimmerPick[] = [];
      snap.forEach((d) => {
        const x = d.data() as SwimmerFS;

        const sName =
          [x.childFirstName, x.childLastName].filter(Boolean).join(" ").trim() ||
          x.swimmerName ||
          x.name ||
          d.id;

        const pName =
          [x.parentFirstName, x.parentLastName].filter(Boolean).join(" ").trim() ||
          x.parentName ||
          "";

        // 取单个主邮箱：parentEmail 优先；否则 parentEmails[0]
        const pEmail =
          x.parentEmail || (Array.isArray(x.parentEmails) ? x.parentEmails[0] : "") || "";

        if (sName) arr.push({ id: d.id, swimmerName: sName, parentName: pName, parentEmail: pEmail });
      });

      setSwimmers(arr.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName)));
    })();
  }, []);

  // 预览：展示选中条目的邮箱列表（去重）
  const recipientsPreview = useMemo(() => {
    const emails = selectedIds
      .map((id) => swimmers.find((s) => s.id === id)?.parentEmail?.toLowerCase() || "")
      .filter(Boolean);

    // 去重
    const unique = Array.from(new Set(emails));
    return unique.join(", ");
  }, [selectedIds, swimmers]);

  if (isAdmin === null) return <div className="p-6">Checking permission…</div>;
  if (!isAdmin) return <div className="p-6 text-red-600 font-semibold">Not authorized (admin only).</div>;

  const handlePublish = async () => {
    try {
      if (!makeupText.trim()) throw new Error("Please input the make-up class text.");
      if (!selectedIds.length) throw new Error("Please select at least one swimmer.");

      setStatus("Publishing…");
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);

      const res = await fetch("/api/makeup/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          makeupText: makeupText.trim(),
          swimmerIds: selectedIds,
        }),
      });

      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Publish failed");

      setStatus(`✅ Published to ${selectedIds.length} swimmer(s).`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("❌ " + msg);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Publish Next Make-up Class</h1>

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Next make-up class (string)</span>
          <input
            className="border rounded-lg p-2"
            placeholder="e.g., 10/1/2025 7–8PM Mary Wayte Pool"
            value={makeupText}
            onChange={(e) => setMakeupText(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Select swimmers (multi-select)</span>
          <select
            multiple
            className="border rounded-lg p-2 h-64"
            value={selectedIds}
            onChange={(e) => setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {swimmers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.swimmerName}
                {s.parentName ? ` — ${s.parentName}` : ""}
                {s.parentEmail ? ` <${s.parentEmail}>` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Hold Cmd/Ctrl to select multiple</span>
        </label>

        <div className="grid gap-1">
          <span className="text-sm font-medium">Preview (emails)</span>
          <div className="border rounded-lg p-2 bg-slate-50 text-sm">
            {recipientsPreview || "—"}
          </div>
        </div>

        <Button
          onClick={handlePublish}
          className="rounded-2xl px-5 py-3 font-semibold shadow bg-black text-white hover:opacity-90"
        >
          Publish
        </Button>

        <div className="text-sm">{status}</div>
      </div>
    </div>
  );
}
