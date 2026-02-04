// app/admin/testimonials/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import Header from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Testimonial {
  id: string;
  content: string;
  parentName?: string;
  swimmerName?: string;
  order?: number;
  isPublished?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export default function TestimonialsAdminPage() {
  const isAdmin = useIsAdminFromDB();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Testimonial, "id" | "createdAt" | "updatedAt">>({
    content: "",
    parentName: "",
    swimmerName: "",
    order: 0,
    isPublished: true,
  });

  useEffect(() => {
    if (isAdmin === true) {
      loadTestimonials();
    }
  }, [isAdmin]);

  const loadTestimonials = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch("/api/testimonials?admin=true", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to load testimonials");
      const data = await res.json();
      setTestimonials(data.testimonials || []);
    } catch (err) {
      console.error("Load testimonials error:", err);
      setStatus({ message: "Failed to load testimonials", success: false });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      if (!formData.content || formData.content.trim() === "") {
        setStatus({ message: "Please fill in the comment content", success: false });
        return;
      }

      const idToken = await user.getIdToken();
      const url = editingId ? `/api/testimonials/${editingId}` : "/api/testimonials";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      setStatus({
        message: editingId ? "Testimonial updated" : "Testimonial created",
        success: true,
      });
      setEditingId(null);
      setFormData({
        content: "",
        parentName: "",
        swimmerName: "",
        order: testimonials.length,
        isPublished: true,
      });
      await loadTestimonials();
    } catch (err) {
      console.error("Save error:", err);
      setStatus({
        message: err instanceof Error ? err.message : "Failed to save testimonial",
        success: false,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const user = auth.currentUser;
      if (!user) return;

      const idToken = await user.getIdToken();
      const res = await fetch(`/api/testimonials/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Failed to delete");
      setStatus({ message: "Testimonial deleted", success: true });
      setDeleteId(null);
      await loadTestimonials();
    } catch (err) {
      console.error("Delete error:", err);
      setStatus({ message: "Failed to delete testimonial", success: false });
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id);
    setFormData({
      content: testimonial.content,
      parentName: testimonial.parentName || "",
      swimmerName: testimonial.swimmerName || "",
      order: testimonial.order || 0,
      isPublished: testimonial.isPublished !== false,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      content: "",
      parentName: "",
      swimmerName: "",
      order: testimonials.length,
      isPublished: true,
    });
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <p className="text-center">Checking permission…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Not authorized (admin only).</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Parent Testimonials Management
          </h1>
          <p className="text-slate-600">Manage parent comments and testimonials displayed on the homepage</p>
        </div>

        {status && (
          <Alert
            variant={status.success ? "default" : "destructive"}
            className={`mb-6 ${status.success ? "border-green-200 bg-green-50" : ""}`}
          >
            {status.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={status.success ? "text-green-800" : ""}>
              {status.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Testimonial" : "Add New Testimonial"}</CardTitle>
            <CardDescription>
              {editingId ? "Update testimonial information" : "Add a new parent comment or testimonial"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Comment Content *</Label>
              <Textarea
                id="content"
                placeholder="Paste the parent's comment or testimonial here..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parentName">Parent Name (Optional)</Label>
                <Input
                  id="parentName"
                  placeholder="e.g. John Smith"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="swimmerName">Swimmer Name (Optional)</Label>
                <Input
                  id="swimmerName"
                  placeholder="e.g. Emma Smith"
                  value={formData.swimmerName}
                  onChange={(e) => setFormData({ ...formData, swimmerName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input
                  id="order"
                  type="number"
                  placeholder="0"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-slate-500">Lower numbers appear first</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isPublished">Status</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isPublished" className="cursor-pointer">
                    Published (visible on homepage)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Plus className="w-4 h-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Existing Testimonials */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-800">Existing Testimonials</h2>
          {loading ? (
            <p>Loading...</p>
          ) : testimonials.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No testimonials found. Create one above.
              </CardContent>
            </Card>
          ) : (
            testimonials.map((testimonial) => (
              <Card key={testimonial.id} className={testimonial.isPublished ? "border-2 border-green-500" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Testimonial #{testimonial.order || 0}</CardTitle>
                      {testimonial.isPublished ? (
                        <Badge className="bg-green-100 text-green-700">Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(testimonial)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(testimonial.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-4 whitespace-pre-wrap">{testimonial.content}</p>
                  {(testimonial.parentName || testimonial.swimmerName) && (
                    <div className="text-sm text-slate-500">
                      {testimonial.parentName && <span>— {testimonial.parentName}</span>}
                      {testimonial.swimmerName && <span> (Parent of {testimonial.swimmerName})</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Testimonial</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this testimonial? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


