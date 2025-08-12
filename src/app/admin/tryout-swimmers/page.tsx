"use client";

import { Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";

interface TryoutSwimmer {
  id: string;
  firstName: string;
  lastName: string;
  age?: string;
  email?: string;
  phone?: string;
  submittedAt?: Timestamp;
  tryoutFinished?: boolean;
  willContinue?: boolean;
  preferredDate?: string;  // yyyy-mm-dd（已在后端 normalize）
  program?: string;        // 已在后端转小写
  experience?: string;
  location?: string;
  healthIssues?: string;
  notes?: string;
  capKey?: string | null;  // 形如 "bronze_2025-08-23"
}

export default function TryoutSwimmersPage() {
  const [swimmers, setSwimmers] = useState<TryoutSwimmer[]>([]);
  const [filtered, setFiltered] = useState<TryoutSwimmer[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSwimmers = async () => {
    const q = query(collection(db, "tryouts"), orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(q);
    const data: TryoutSwimmer[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<TryoutSwimmer, "id">),
    }));
    setSwimmers(data);
    setFiltered(data);
  };

  const toggleField = async (
    id: string,
    field: "tryoutFinished" | "willContinue",
    current: boolean | undefined
  ) => {
    setBusyId(id);
    try {
      const ref = doc(db, "tryouts", id);
      await updateDoc(ref, { [field]: !current });
      await fetchSwimmers();
    } finally {
      setBusyId(null);
    }
  };

  // 通过服务端 API 同时删除报名与锁
  const handleDelete = async (s: TryoutSwimmer) => {
    const confirmDelete = confirm("Are you sure you want to delete this swimmer?");
    if (!confirmDelete) return;

    setBusyId(s.id);
    try {
      const res = await fetch("/api/tryout/admin-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          capKey: s.capKey ?? null,
          program: s.program ?? "",
          preferredDate: s.preferredDate ?? "",
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg = payload?.message || payload?.error || "Delete failed.";
        alert(`❌ ${msg}`);
        return;
      }

      await fetchSwimmers();
    } catch (error) {
      console.error("❌ Error deleting swimmer:", error);
      alert("Failed to delete swimmer. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    const lower = value.toLowerCase();
    const result = swimmers.filter(
      (s) =>
        s.firstName?.toLowerCase().includes(lower) ||
        s.lastName?.toLowerCase().includes(lower) ||
        s.email?.toLowerCase().includes(lower) ||
        s.phone?.includes(lower)
    );
    setFiltered(result);
  };

  useEffect(() => {
    fetchSwimmers();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <section className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">📝 Tryout Submissions</h1>

        {/* Search bar */}
        <div className="mb-6 max-w-md">
          <Input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="border border-slate-300"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-slate-500 mt-12">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            No matching tryout submissions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-slate-300">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="p-3 border-b">Name</th>
                  <th className="p-3 border-b">Age</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b">Phone</th>
                  <th className="p-3 border-b">Program</th>
                  <th className="p-3 border-b">Experience</th>
                  <th className="p-3 border-b">Date</th>
                  <th className="p-3 border-b">Location</th>
                  <th className="p-3 border-b">Health</th>
                  <th className="p-3 border-b">Notes</th>
                  <th className="p-3 border-b">Submitted</th>
                  <th className="p-3 border-b">Tryout?</th>
                  <th className="p-3 border-b">Enroll?</th>
                  <th className="p-3 border-b">Delete</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50 align-top">
                    <td className="p-3 font-medium whitespace-nowrap">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="p-3">{s.age || "N/A"}</td>
                    <td className="p-3">{s.email}</td>
                    <td className="p-3">{s.phone}</td>
                    <td className="p-3">{s.program || "-"}</td>
                    <td className="p-3">{s.experience || "-"}</td>
                    <td className="p-3">{s.preferredDate || "-"}</td>
                    <td className="p-3">{s.location || "-"}</td>
                    <td className="p-3">{s.healthIssues || "-"}</td>
                    <td className="p-3 max-w-xs">{s.notes || "-"}</td>
                    <td className="p-3 whitespace-nowrap">
                      {s.submittedAt?.toDate().toLocaleString() || "N/A"}
                    </td>
                    <td className="p-3">
                      <Button
                        variant={s.tryoutFinished ? "default" : "outline"}
                        onClick={() => toggleField(s.id, "tryoutFinished", s.tryoutFinished)}
                        className="text-xs"
                        disabled={busyId === s.id}
                      >
                        {s.tryoutFinished ? "✅ Finished" : "Mark"}
                      </Button>
                    </td>
                    <td className="p-3">
                      <Button
                        variant={s.willContinue ? "default" : "outline"}
                        onClick={() => toggleField(s.id, "willContinue", s.willContinue)}
                        className="text-xs"
                        disabled={busyId === s.id}
                      >
                        {s.willContinue ? "✅ Yes" : "Mark"}
                      </Button>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(s)}
                        className="text-xs"
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
