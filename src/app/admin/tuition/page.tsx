// app/admin/tuition/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";

type SwimmerDoc = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail: string;
};

const monthsChoices = (() => {
  const now = new Date();
  const list: string[] = [];
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    list.push(d.toLocaleString("en-US", { month: "long", year: "numeric" }));
  }
  return list;
})();

const QR_IMG =
  process.env.NEXT_PUBLIC_QR_IMAGE_URL ||
  "https://www.primeswimacademy.com/images/zelle_qr.jpeg";

export default function TuitionPage() {
  // ✅ 用数据库里的 admin 集合判断是否管理员（你的 hook）
  const isAdmin = useIsAdminFromDB();

  const [swimmers, setSwimmers] = useState<SwimmerDoc[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [parentEmail, setParentEmail] = useState("");
  const [parentName, setParentName] = useState("");
  const [swimmerName, setSwimmerName] = useState("");

  const [months, setMonths] = useState<string[]>([]);
  const [practiceText, setPracticeText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<number>(0);

  const [status, setStatus] = useState("");

  // 加载 swimmers（按你截图字段映射）
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "swimmers"));
      const arr: SwimmerDoc[] = [];
      snap.forEach((d) => {
        const x: any = d.data();

        const computedSwimmerName =
          [x.childFirstName, x.childLastName].filter(Boolean).join(" ").trim() ||
          x.swimmerName ||
          x.name ||
          d.id;

        const computedParentName =
          [x.parentFirstName, x.parentLastName].filter(Boolean).join(" ").trim() ||
          x.parentName ||
          "";

        const computedParentEmail =
          x.parentEmail ||
          (Array.isArray(x.parentEmails) ? x.parentEmails[0] : "") ||
          "";

        arr.push({
          id: d.id,
          swimmerName: computedSwimmerName,
          parentName: computedParentName,
          parentEmail: computedParentEmail,
        });
      });

      setSwimmers(
        arr
          .filter((s) => s.swimmerName && s.swimmerName.trim().length > 0)
          .sort((a, b) => a.swimmerName.localeCompare(b.swimmerName))
      );
    })();
  }, []);

  // 切换学生 → 自动回填
  useEffect(() => {
    const s = swimmers.find((s) => s.id === selectedId);
    if (s) {
      setParentEmail(s.parentEmail || "");
      setParentName(s.parentName || "");
      setSwimmerName(s.swimmerName || "");
    } else {
      setParentEmail("");
      setParentName("");
      setSwimmerName("");
    }
  }, [selectedId, swimmers]);

  const subjectPreview = useMemo(() => {
    const m = months.length
      ? months.length === 1
        ? months[0]
        : `${months.slice(0, -1).join(", ")} and ${months.slice(-1)[0]}`
      : "—";
    const due = dueDate
      ? new Date(dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
    return `Prime Swim Academy — Tuition for ${m} (Due ${due})`;
  }, [months, dueDate]);

  if (isAdmin === null) return <div className="p-6">Checking permission…</div>;
  if (!isAdmin) return <div className="p-6 text-red-600 font-semibold">Not authorized (admin only).</div>;

  const handleSend = async () => {
    try {
      setStatus("Sending…");
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const idToken = await u.getIdToken(true);

      const res = await fetch("/api/tuition-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          parentName,
          parentEmail,
          swimmerName,
          months,
          practiceText,
          dueDate,
          amount,
          bccAdmin: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Send failed");
      setStatus("✅ Sent!");
    } catch (e: any) {
      setStatus("❌ " + (e?.message || String(e)));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Send Tuition Email</h1>

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Student</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option value="">Select a student…</option>
            {swimmers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.swimmerName}{s.parentName ? ` — ${s.parentName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Parent name</span>
            <input
              className="border rounded-lg p-2"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Parent email</span>
            <input
              className="border rounded-lg p-2"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Months (multi-select)</span>
          <select
            multiple
            className="border rounded-lg p-2 h-32"
            value={months}
            onChange={(e) =>
              setMonths(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {monthsChoices.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Hold Cmd/Ctrl to select multiple</span>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Practice details</span>
          <textarea
            className="border rounded-lg p-2"
            placeholder="e.g., Mon/Wed 7:00–8:00 PM at Mary Wayte Pool"
            value={practiceText}
            onChange={(e) => setPracticeText(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tuition due date</span>
            <input
              type="date"
              className="border rounded-lg p-2"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Amount (USD)</span>
            <input
              type="number"
              min={0}
              step={1}
              className="border rounded-lg p-2"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">QR Preview</span>
          <div className="border rounded-lg p-4 flex items-center justify-center min-h-48 bg-white">
            <img src={QR_IMG} alt="Payment QR" className="max-h-48" />
          </div>
        </div>

        <div className="grid gap-1">
          <span className="text-sm font-medium">Subject Preview</span>
          <div className="border rounded-lg p-2 bg-slate-50">{subjectPreview}</div>
        </div>

        <button
          onClick={handleSend}
          className="rounded-2xl px-5 py-3 font-semibold shadow bg-black text-white hover:opacity-90"
        >
          Send Email
        </button>

        <div className="text-sm">{status}</div>
      </div>
    </div>
  );
}
