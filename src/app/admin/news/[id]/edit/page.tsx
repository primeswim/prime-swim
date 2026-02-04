"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { app, storage } from "@/lib/firebase";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Header from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Image as ImageIcon, Calendar, User, Eye, Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { RichTextEditor } from "@/components/rich-text-editor";

export default function EditNewsPage() {
  const params = useParams();
  const router = useRouter();
  const newsId = params.id as string;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const auth = getAuth(app);
  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  // Fetch news data
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setFetching(true);
        const res = await fetch(`/api/news/${newsId}`);
        if (!res.ok) {
          setError("Failed to load news article");
          setFetching(false);
          return;
        }

        const data = await res.json();
        const news = data.news;
        
        setTitle(news.title || "");
        setContent(news.content || "");
        setSummary(news.summary || "");
        setAuthor(news.author || "");
        setPublishDate(news.publishDate || "");
        setIsPublished(news.isPublished || false);
        setImageUrl(news.image || "");
        if (news.image) {
          setImagePreview(news.image);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
        setError("Failed to load news article");
      } finally {
        setFetching(false);
      }
    };

    if (newsId) {
      fetchNews();
    }
  }, [newsId]);

  // 处理图片文件选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setImageFile(file);
      setError("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 上传图片到Firebase Storage
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) {
      return imageUrl || null;
    }

    setUploadingImage(true);
    try {
      const timestamp = Date.now();
      const fileName = `news/${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(storageRef);
      setImageUrl(downloadURL);
      setUploadingImage(false);
      return downloadURL;
    } catch (err) {
      console.error("Error uploading image:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to upload image: ${errorMessage}. Please try again.`);
      setUploadingImage(false);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be logged in");
        setLoading(false);
        return;
      }

      // 验证必填字段
      if (!title.trim()) {
        setError("Title is required");
        setLoading(false);
        return;
      }
      if (!summary.trim()) {
        setError("Summary is required");
        setLoading(false);
        return;
      }
      if (!content.trim()) {
        setError("Content is required");
        setLoading(false);
        return;
      }
      if (!publishDate) {
        setError("Publish date is required");
        setLoading(false);
        return;
      }

      // 上传图片（如果有新图片）
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          setLoading(false);
          return;
        }
        finalImageUrl = uploadedUrl;
      }

      // 更新 news
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/news/${newsId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          summary: summary.trim(),
          author: author.trim() || null,
          image: finalImageUrl || null,
          publishDate,
          isPublished,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/admin/news");
        }, 1500);
      } else {
        setError(data.error || "Failed to update news");
      }
    } catch (err) {
      console.error("Error updating news:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to update news: ${errorMessage}. Please check the console for details.`);
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin === null || fetching) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-20">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You do not have permission to access this page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Edit News Article
          </h1>
          <p className="text-slate-600">Update the news article for Prime Swim Academy</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              News article updated successfully! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Enter the title, summary, and author information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter news article title"
                  required
                  className="text-lg"
                />
                <p className="text-xs text-slate-500">{title.length} characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary *</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary of the news article (will be shown in news list)"
                  required
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">{summary.length} characters</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="author"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Author name (optional)"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publishDate">Publish Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="publishDate"
                      type="date"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
              <CardDescription>Write the full content of the news article</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write the full article content here... You can use the toolbar above to format your text."
                  className="min-h-[400px]"
                />
                <p className="text-xs text-slate-500">
                  {content.replace(/<[^>]*>/g, "").length} characters (HTML tags excluded)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Featured Image
              </CardTitle>
              <CardDescription>Upload an image or provide an image URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageFile">Upload Image</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="imageFile"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="cursor-pointer"
                      disabled={uploadingImage}
                    />
                    <p className="text-xs text-slate-500 mt-1">Max size: 5MB. Supported formats: JPG, PNG, GIF, WebP</p>
                  </div>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setImageUrl("");
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {imagePreview && (
                <div className="relative w-full h-64 rounded-lg overflow-hidden border border-slate-200">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="imageUrl">Or Enter Image URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value && !imageFile) {
                      setImagePreview(e.target.value);
                    }
                  }}
                  placeholder="https://i.imgur.com/xxxxx.jpg"
                  disabled={!!imageFile || uploadingImage}
                />
                <p className="text-xs text-slate-500">If you upload a file, the URL field will be ignored</p>
              </div>

              {uploadingImage && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Upload className="w-4 h-4 animate-pulse" />
                  Uploading image...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Publishing Options */}
          <Card>
            <CardHeader>
              <CardTitle>Publishing Options</CardTitle>
              <CardDescription>Control when and how the article is published</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={(checked) => setIsPublished(checked as boolean)}
                />
                <Label htmlFor="isPublished" className="cursor-pointer">
                  Publish immediately
                </Label>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {isPublished
                  ? "This article will be visible on the news page immediately after submission."
                  : "This article will be saved as a draft and can be published later."}
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/news")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploadingImage}
              className="min-w-32"
            >
              {loading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Update Article
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


