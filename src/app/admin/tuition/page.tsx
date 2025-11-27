// src/app/admin/tuition/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useIsAdminFromDB } from "../../../hooks/useIsAdminFromDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Header from "@/components/header";
import { DollarSign, Calendar, Mail, User, Users, Search, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";

type SwimmerDoc = {
  id: string;
  swimmerName: string;
  parentName?: string;
  parentEmail: string;
};

// Firestore swimmers 文档字段（兼容多种历史字段）
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

type SendResp = { ok: boolean; data?: unknown; error?: string };

// Function to generate months list based on current date
const generateMonthsChoices = (): string[] => {
  const now = new Date();
  const list: string[] = [];
  // Generate months from -1 (last month) to 24 months ahead
  for (let i = -1; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    list.push(d.toLocaleString("en-US", { month: "long", year: "numeric" }));
  }
  return list;
};

const DEFAULT_QR_IMG =
  process.env.NEXT_PUBLIC_QR_IMAGE_URL ||
  "https://www.primeswimacademy.com/images/zelle_qr.jpeg";

export default function TuitionPage() {
  // 用数据库 admin 集合判断权限
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

  // 新增：可自定义的一段话，将在邮件里插到 late-fee 句子后面
  const [extraNote, setExtraNote] = useState("");

  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // 加载 swimmers（映射到兼容字段）
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "swimmers"));
      const arr: SwimmerDoc[] = [];
      snap.forEach((d) => {
        const x = d.data() as SwimmerFS;

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

  // Generate months choices dynamically based on current date
  const monthsChoices = useMemo(() => generateMonthsChoices(), []);

  // Filter swimmers by search term
  const filteredSwimmers = useMemo(() => {
    if (!searchTerm.trim()) return swimmers;
    const term = searchTerm.toLowerCase();
    return swimmers.filter(
      (s) =>
        s.swimmerName.toLowerCase().includes(term) ||
        s.parentName?.toLowerCase().includes(term) ||
        s.parentEmail.toLowerCase().includes(term)
    );
  }, [swimmers, searchTerm]);

  // 切换学生 → 自动回填
  useEffect(() => {
    const s = swimmers.find((x) => x.id === selectedId);
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

  const handleSend = async () => {
    try {
      setStatus("Sending email…");
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
          swimmerName, // 读取可编辑的学生名字
          months,
          practiceText,
          dueDate,
          amount,
          afterFeeNote: extraNote, // 新增：自定义补充段
          bccAdmin: true,
        }),
      });

      const j: SendResp = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Send failed");
      
      setStatus(`✅ Tuition & training schedule email sent successfully to ${parentEmail}`);
      setSuccess(true);
      
      // Reset form after successful send
      setTimeout(() => {
        setStatus("");
        setSuccess(false);
        setSelectedId("");
        setParentEmail("");
        setParentName("");
        setSwimmerName("");
        setMonths([]);
        setPracticeText("");
        setDueDate("");
        setAmount(0);
        setExtraNote("");
        setSearchTerm("");
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("❌ " + msg);
      setSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-600" />
            Send Tuition & Training Schedule Email
          </h1>
          <p className="text-slate-600">Send next month&apos;s tuition and training schedule information to parents</p>
        </div>

        {status && (
          <Alert 
            variant={success ? "default" : "destructive"}
            className={`mb-6 ${success ? "border-green-200 bg-green-50" : ""}`}
          >
            {success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={success ? "text-green-800" : ""}>
              {status}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Student & Parent Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Student & Parent Information
                </CardTitle>
                <CardDescription>Select a student and review their information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search swimmers, parents, or emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Student Selection */}
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSwimmers.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-slate-500">No swimmers found</div>
                      ) : (
                        filteredSwimmers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.swimmerName}
                            {s.parentName ? ` — ${s.parentName}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Student Name (Editable) */}
                <div className="space-y-2">
                  <Label htmlFor="swimmerName">Student Name</Label>
                  <Input
                    id="swimmerName"
                    value={swimmerName}
                    onChange={(e) => setSwimmerName(e.target.value)}
                    placeholder="Type or edit the swimmer's name"
                  />
                </div>

                {/* Parent Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="parentName">Parent Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="parentName"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail">Parent Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="parentEmail"
                        type="email"
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Code Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment QR Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 flex items-center justify-center min-h-48 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={DEFAULT_QR_IMG} alt="Payment QR" className="max-h-48 max-w-full object-contain" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Invoice Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Tuition & Schedule Details
                </CardTitle>
                <CardDescription>Enter tuition and training schedule information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Months Selection */}
                <div className="space-y-2">
                  <Label>Months (Select training months)</Label>
                  <div className="border rounded-lg p-4 max-h-80 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-3">
                      {monthsChoices.map((m) => {
                        const isSelected = months.includes(m);
                        return (
                          <div key={m} className="flex items-center space-x-2">
                            <Checkbox
                              id={`month-${m}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setMonths([...months, m]);
                                } else {
                                  setMonths(months.filter((month) => month !== m));
                                }
                              }}
                            />
                            <Label
                              htmlFor={`month-${m}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {m}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{months.length} month(s) selected</span>
                    <button
                      type="button"
                      onClick={() => setMonths(months.length === monthsChoices.length ? [] : [...monthsChoices])}
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {months.length === monthsChoices.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                </div>

                {/* Practice Details */}
                <div className="space-y-2">
                  <Label htmlFor="practiceText">Practice Details</Label>
                  <Textarea
                    id="practiceText"
                    placeholder="e.g., Mon/Wed 7:00–8:00 PM at Mary Wayte Pool"
                    value={practiceText}
                    onChange={(e) => setPracticeText(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Due Date & Amount */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Tuition Due Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="amount"
                        type="number"
                        min={0}
                        step={0.01}
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value || 0))}
                        className="pl-10"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Extra Note */}
                <div className="space-y-2">
                  <Label htmlFor="extraNote">Extra Note (Optional)</Label>
                  <Textarea
                    id="extraNote"
                    placeholder='This note will appear right after: "A $35 late fee will be applied …".'
                    value={extraNote}
                    onChange={(e) => setExtraNote(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-slate-500">
                    Style: plain black text. Leave empty if not needed.
                  </p>
                </div>

                {/* Subject Preview */}
                <div className="space-y-2">
                  <Label>Email Subject Preview</Label>
                  <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                    <p className="text-sm font-medium text-blue-900">{subjectPreview}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              size="lg"
              className="w-full"
              disabled={!selectedId || !parentEmail || !swimmerName || months.length === 0 || !dueDate || amount <= 0 || status.includes("Sending")}
            >
              {status.includes("Sending") ? (
                "Sending..."
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Tuition & Schedule Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
