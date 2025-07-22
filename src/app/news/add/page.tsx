"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/userIsAdminFromDB";

export default function AddNewsPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [publishDate, setPublishDate] = useState(""); // ✅ 格式为 "YYYY-MM-DD"
  const [isPublished, setIsPublished] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const db = getFirestore(app);
  const router = useRouter();

  const isAdmin = useIsAdminFromDB();

  if (isAdmin === null) {
    return <p className="text-center mt-10 text-slate-500">Checking access...</p>;
  }

  if (!isAdmin) {
    return (
      <p className="text-center mt-10 text-red-600 font-semibold">
        You do not have permission to access this page.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
  
    try {
      if (!summary || !publishDate) {
        alert("Please fill out summary and publish date.");
        setLoading(false);
        return;
      }
  
      await addDoc(collection(db, "news"), {
        title,
        content,
        summary,
        image: imageUrl || null,
        publishDate,
        createdAt: serverTimestamp(),
        isPublished,
      });
  
      setSuccess(true);
      router.push("/news");
    } catch (err) {
      console.error("Error submitting news:", err);
      alert("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-slate-800">Add News</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-slate-700 font-medium mb-1">Title</label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
            <label className="block text-slate-700 font-medium mb-1">Summary</label>
            <textarea
                className="w-full border border-slate-300 rounded px-3 py-2 h-20"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
            />
            </div>

            <div>
            <label className="block text-slate-700 font-medium mb-1">Publish Date</label>
            <input
                type="date"
                className="w-full border border-slate-300 rounded px-3 py-2"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                required
            />
        </div>

        <div>
          <label className="block text-slate-700 font-medium mb-1">Content</label>
          <textarea
            className="w-full border border-slate-300 rounded px-3 py-2 h-40"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={() => setIsPublished(!isPublished)}
            className="mr-2"
          />
          <label className="text-slate-700">Publish immediately</label>
        </div>

        <div>
            <label className="block text-slate-700 font-medium mb-1">Image URL (e.g., https://...)</label>
            <input
                type="text"
                className="w-full border border-slate-300 rounded px-3 py-2"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://your-image-url"
            />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>

        {success && (
          <p className="text-green-600 mt-4 text-sm">News added successfully!</p>
        )}
      </form>
    </div>
  );
}
