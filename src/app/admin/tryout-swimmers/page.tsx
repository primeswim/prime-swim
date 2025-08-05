"use client";

import { Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
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
  preferredDate?: string;
  program?: string;
  experience?: string;
  location?: string;
  healthIssues?: string;
  notes?: string;
}

export default function TryoutSwimmersPage() {
  const [swimmers, setSwimmers] = useState<TryoutSwimmer[]>([]);
  const [filtered, setFiltered] = useState<TryoutSwimmer[]>([]);
  const [search, setSearch] = useState("");

  const fetchSwimmers = async () => {
    const q = query(collection(db, "tryouts"), orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(q);
    const data: TryoutSwimmer[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as TryoutSwimmer[];
    setSwimmers(data);
    setFiltered(data);
  };

  const toggleField = async (
    id: string,
    field: "tryoutFinished" | "willContinue",
    current: boolean | undefined
  ) => {
    const ref = doc(db, "tryouts", id);
    await updateDoc(ref, { [field]: !current });
    fetchSwimmers();
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this swimmer?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "tryouts", id));
      fetchSwimmers(); // refresh after deletion
    } catch (error) {
      console.error("❌ Error deleting swimmer:", error);
      alert("Failed to delete swimmer. Please try again.");
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
                      >
                        {s.tryoutFinished ? "✅ Finished" : "Mark"}
                      </Button>
                    </td>
                    <td className="p-3">
                      <Button
                        variant={s.willContinue ? "default" : "outline"}
                        onClick={() => toggleField(s.id, "willContinue", s.willContinue)}
                        className="text-xs"
                      >
                        {s.willContinue ? "✅ Continue" : "Mark"}
                      </Button>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(s.id)}
                        className="text-xs"
                      >
                        Delete
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
