"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, ChevronDown, ChevronRight, Lock, MapPin, Upload, Users } from "lucide-react";
import { MeetAnnouncementText } from "@/components/meet-announcement-text";
import { PnsMeetLink } from "@/components/pns-meet-link";
import { eventLabel } from "@/lib/meets/hytek-events";
import type { Meet, MeetCommitment, MeetSwimmer } from "@/lib/meets/types";
import { mailtoHref } from "@/lib/meets/mailto";
import { adminMeetGuide, canPublishToFamilies, parentEventLabel, type AdminMeetStepId } from "@/lib/meets/workflow";

async function token() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

function statusTone(status: string) {
  if (status === "commitment_open") return "bg-green-100 text-green-800";
  if (status === "entries_confirmed") return "bg-emerald-100 text-emerald-800";
  if (status === "invitation_pending" || status === "ready_to_publish") return "bg-amber-100 text-amber-800";
  if (status === "submitted" || status === "host_reply_received") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    invitation_pending: "Waiting for host invite",
    admin_review: "Needs review",
    ready_to_publish: "Ready to publish",
    cancelled: "Not posted to families",
    commitment_open: "Open to families",
    commitment_closed: "RSVP closed",
    submitted: "Sent to host",
    host_reply_received: "Host replied — review cuts",
    entries_confirmed: "Confirmed for families",
  };
  return map[status] || status.replace(/_/g, " ");
}

export default function AdminMeetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [meet, setMeet] = useState<Meet | null>(null);
  const [commitments, setCommitments] = useState<MeetCommitment[]>([]);
  const [swimmers, setSwimmers] = useState<MeetSwimmer[]>([]);
  const [deadline, setDeadline] = useState("");
  const [hostReply, setHostReply] = useState("");
  const [banner, setBanner] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [inviteTo, setInviteTo] = useState("");
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteBody, setInviteBody] = useState("");
  const [packetOpen, setPacketOpen] = useState<boolean | null>(null);
  const [openedStep, setOpenedStep] = useState<AdminMeetStepId | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const adminSnap = await getDoc(doc(db, "admin", user.email ?? ""));
      if (!adminSnap.exists()) {
        router.push("/not-authorized");
        return;
      }
      setReady(true);
      await reload();
    });
    return () => unsub();
  }, [router, id]);

  async function reload() {
    const idToken = await token();
    const res = await fetch(`/api/admin/meets/${id}`, { headers: { Authorization: `Bearer ${idToken}` } });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Load failed");
    setMeet(json.meet);
    setCommitments(json.commitments || []);
    setSwimmers(json.swimmers || []);
    setDeadline(json.meet.primeCommitmentDeadline || "");
    setHostReply(json.meet.hostReplySummary || "");
    if (json.invitationEmail) {
      setInviteTo(json.invitationEmail.to || "");
      setInviteSubject(json.invitationEmail.subject || "");
      setInviteBody(json.invitationEmail.body || "");
    }
    if (json.email) {
      setEmailTo(json.email.to || "");
      setEmailSubject(json.email.subject || "");
      setEmailBody(json.email.body || "");
    }
  }

  async function act(body: Record<string, unknown>, okText?: string, opts?: { stay?: boolean }) {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const idToken = await token();
      const res = await fetch(`/api/admin/meets/${id}/actions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Action failed");
      if (json.invitationEmail) {
        setInviteTo(json.invitationEmail.to || "");
        setInviteSubject(json.invitationEmail.subject || "");
        setInviteBody(json.invitationEmail.body || "");
      }
      if (json.email) {
        setEmailTo(json.email.to || "");
        setEmailSubject(json.email.subject || "");
        setEmailBody(json.email.body || "");
      }
      if (okText) setMessage(okText);
      setOpenedStep(null);
      await reload();
      if (!opts?.stay) window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !meet) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-10 text-slate-500">Loading meet…</div>
      </div>
    );
  }

  const guide = adminMeetGuide(meet);
  const activeStep = openedStep && openedStep !== "done" ? openedStep : guide.current;
  const publishGate = canPublishToFamilies(meet);
  const canClickPublish = publishGate.ok && Boolean(deadline) && guide.current === "publish";
  const packetExpanded = packetOpen ?? (guide.current === "ask_host" || guide.current === "publish");
  const showFamilies = guide.current !== "ask_host" && guide.current !== "publish";

  const swimmerName = (sid: string) => {
    const s = swimmers.find((x) => x.id === sid);
    return s ? `${s.childFirstName} ${s.childLastName}` : sid;
  };

  function stepBody(stepId: AdminMeetStepId) {
    if (stepId === "ask_host") {
      return (
        <div className="space-y-4 text-sm">
          {meet.invitationStatus === "declined" && (
            <p className="rounded-md bg-rose-50 border border-rose-100 px-3 py-2 text-rose-900">
              The host declined. This meet cannot be published.
            </p>
          )}
          {meet.status !== "cancelled" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                act({ action: "reject", reason: "Admin chose not to take this invitational." }, "Rejected. Families will not see this meet.")
              }
            >
              Reject — do not post to families
            </Button>
          )}
          {meet.invitationStatus === "requested" && (
            <p className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-amber-950">
              Invitation request marked
              {meet.invitationEmailSentAt ? ` ${new Date(meet.invitationEmailSentAt).toLocaleString()}` : ""}
              {meet.invitationEmailTo ? ` → ${meet.invitationEmailTo}` : ""}. When they invite Prime, use the button below.
            </p>
          )}
          {meet.invitationStatus !== "invited" && meet.invitationStatus !== "declined" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                This letter only asks whether Prime Swim Academy may attend. It is not the athlete list.
              </p>
              <div>
                <label className="font-medium text-slate-700">To</label>
                <Input className="mt-1 bg-white" value={inviteTo} onChange={(e) => setInviteTo(e.target.value)} placeholder="host@example.com" />
              </div>
              <div>
                <label className="font-medium text-slate-700">Subject</label>
                <Input className="mt-1 bg-white" value={inviteSubject} onChange={(e) => setInviteSubject(e.target.value)} />
              </div>
              <div>
                <label className="font-medium text-slate-700">Message</label>
                <Textarea className="mt-1 min-h-40 bg-white" value={inviteBody} onChange={(e) => setInviteBody(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-slate-800" disabled={!inviteTo || !inviteBody} asChild>
                  <a href={mailtoHref(inviteTo, inviteSubject, inviteBody)}>Open in Mail</a>
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => act({ action: "composeInvitationEmail" }, "Invitation request refreshed.")}>
                  Refresh draft
                </Button>
                {meet.invitationStatus !== "requested" && (
                  <Button
                    variant="outline"
                    disabled={busy || !inviteTo}
                    onClick={() =>
                      act(
                        { action: "markInvitationRequested", to: inviteTo },
                        "Marked as asked. Next: wait for the host, then mark Host invited Prime."
                      )
                    }
                  >
                    I asked the host
                  </Button>
                )}
              </div>
              {meet.isTestData && (
                <p className="text-xs text-amber-800">[TEST] meet. Do not send to a live host unless you mean to.</p>
              )}
            </div>
          )}
          {(meet.invitationStatus === "requested" || meet.invitationStatus === "not_requested") && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                className="bg-blue-700 hover:bg-blue-800"
                disabled={busy}
                onClick={() => act({ action: "invite", invitationStatus: "invited" }, "Host invited Prime. Next: set the Prime Deadline and publish.")}
              >
                Host invited Prime
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => act({ action: "invite", invitationStatus: "not_required" }, "Marked as an open meet. Next: set the Prime Deadline and publish.")}
              >
                This is an open meet
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => act({ action: "invite", invitationStatus: "declined" }, "Host declined. This meet will not be published.")}
              >
                Host declined
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (stepId === "publish") {
      return (
        <div className="space-y-4 text-sm">
          {meet.invitationStatus === "not_required" && (
            <p className="rounded-md bg-sky-50 border border-sky-100 px-3 py-2 text-sky-900">
              This is an open meet. You do not need to ask the host for an invitation.
            </p>
          )}
          <div>
            <label className="font-medium text-slate-700">Prime Deadline (families must RSVP by this day)</label>
            <Input value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" placeholder="2026-09-20T23:59:00" />
            <p className="text-xs text-slate-500 mt-1">RSVP stays open through that day, then closes automatically the next Pacific day.</p>
            <Button
              className="mt-2"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                const idToken = await token();
                await fetch(`/api/admin/meets/${id}`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ primeCommitmentDeadline: deadline }),
                });
                await reload();
                setMessage("Prime Deadline saved.");
              }}
            >
              Save deadline
            </Button>
          </div>
          <EventFilePanel
            meet={meet}
            fileName={fileName}
            busy={busy}
            when="before_publish"
            onPick={async (file) => {
              setFileName(file.name);
              await act({ action: "importEventFile", content: await file.text(), accept: true }, `Imported ${file.name}. Families will be able to check events when they Attend.`);
            }}
          />
          <Button
            className="bg-blue-700 hover:bg-blue-800"
            disabled={busy || !canClickPublish}
            onClick={async () => {
              const idToken = await token();
              await fetch(`/api/admin/meets/${id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ primeCommitmentDeadline: deadline }),
              });
              await act({ action: "publish" }, "Published. Signed-in Prime families can now Attend or Decline.");
            }}
          >
            Publish to families
          </Button>
          {!deadline && <p className="text-xs text-amber-800">Save a Prime Deadline before publishing.</p>}
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 mb-2">If Prime is not going, reject it here. Families never see a rejected meet.</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                act({ action: "reject", reason: "Admin chose not to post this meet to families." }, "Rejected. Families will not see this meet.")
              }
            >
              Reject — do not post to families
            </Button>
          </div>
        </div>
      );
    }

    if (stepId === "collect_rsvp") {
      return (
        <div className="space-y-4 text-sm">
          <p className="rounded-md bg-green-50 border border-green-100 px-3 py-2 text-green-900">
            Families can see this meet. Attend / Decline stay open through {meet.primeCommitmentDeadline || "the Prime Deadline"}, then close the next day.
          </p>
          <EventFilePanel meet={meet} fileName={fileName} busy={busy} when="during_rsvp" onPick={async (file) => {
            setFileName(file.name);
            await act({ action: "importEventFile", content: await file.text(), accept: true }, `Imported ${file.name}. Families can now check events until the Prime Deadline.`);
          }} />
          <div>
            <p className="text-xs text-slate-500 mb-2">Only if the meet fills before the deadline.</p>
            <Button
              disabled={busy || meet.status !== "commitment_open"}
              variant="outline"
              onClick={() => act({ action: "close" }, "RSVP closed early. Next: email the entry list to the host.")}
            >
              Close RSVP early
            </Button>
          </div>
        </div>
      );
    }

    if (stepId === "send_entries") {
      return (
        <div className="space-y-3 text-sm">
          <p className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">
            RSVP is closed. Families can no longer Attend or Decline.
            {meet.commitmentClosedAt ? ` Closed ${new Date(meet.commitmentClosedAt).toLocaleString()}.` : ""}
          </p>
          {meet.events.length === 0 && (
            <EventFilePanel meet={meet} fileName={fileName} busy={busy} when="after_close" onPick={async (file) => {
              setFileName(file.name);
              await act({ action: "importEventFile", content: await file.text(), accept: true }, `Imported ${file.name}. RSVP is already closed, so parents cannot check events.`);
            }} />
          )}
          <div>
            <label className="font-medium text-slate-700">To</label>
            <Input className="mt-1 bg-white" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="host@example.com" />
          </div>
          <div>
            <label className="font-medium text-slate-700">Subject</label>
            <Input className="mt-1 bg-white" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          </div>
          <div>
            <label className="font-medium text-slate-700">Message</label>
            <Textarea className="mt-1 min-h-48 bg-white" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-slate-800" disabled={!emailTo || !emailBody} asChild>
              <a href={mailtoHref(emailTo, emailSubject, emailBody)}>Open in Mail</a>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => act({ action: "composeEntryEmail" }, "Draft refreshed from current Attend selections.")}>
              Refresh draft
            </Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={busy || !emailTo}
              onClick={() =>
                act({ action: "submit" }, `Marked as sent to ${emailTo}. Next: wait for the host reply.`)
              }
            >
              I sent it from Mail
            </Button>
          </div>
          {meet.isTestData && (
            <p className="text-xs text-amber-800">[TEST] meet. Do not send to a live host unless you mean to.</p>
          )}
        </div>
      );
    }

    if (stepId === "host_reply") {
      return (
        <div className="space-y-3 text-sm">
          {meet.entryEmailSentAt && (
            <p className="text-xs text-slate-500">
              Entry list marked sent {new Date(meet.entryEmailSentAt).toLocaleString()}
              {meet.entryEmailTo ? ` → ${meet.entryEmailTo}` : ""}
            </p>
          )}
          <label className="font-medium text-slate-700">Host reply note</label>
          <Input className="mt-1" placeholder="e.g. Host cut Sunday 500 for timeline" value={hostReply} onChange={(e) => setHostReply(e.target.value)} />
          <Button
            className="mt-2 bg-blue-700 hover:bg-blue-800"
            disabled={busy || !hostReply.trim()}
            onClick={() => act({ action: "recordHostReply", summary: hostReply }, "Host reply recorded. Next: uncheck cut events, then show families the confirmed list.")}
          >
            Record host reply
          </Button>
        </div>
      );
    }

    if (stepId === "confirm_families") {
      return (
        <div className="space-y-3 text-sm">
          <p>
            Uncheck or add events in Family responses below, then show families the confirmed list. Admin edits are stored as the final entry.
          </p>
          <Button
            disabled={busy}
            className="bg-blue-700 hover:bg-blue-800"
            onClick={() => act({ action: "publishConfirmed" }, "Families now see the confirmed events and fees.")}
          >
            Show families the confirmed events &amp; fees
          </Button>
        </div>
      );
    }

    return <p className="text-sm text-slate-600">Families see the confirmed events and fees.</p>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Link href="/admin/meets" className="text-sm text-blue-700 hover:underline">
          ← All meets
        </Link>

        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {meet.isTestData && <Badge className="bg-amber-100 text-amber-800 border-amber-200">TEST DATA</Badge>}
            <Badge className={statusTone(meet.status)}>{labelStatus(meet.status)}</Badge>
            <Badge className={meet.meetType === "invitational" ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}>
              {meet.meetType === "invitational" ? "Invitational" : "Open meet"}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{meet.name}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4 text-blue-600" />
              {meet.startDate} – {meet.endDate}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4 text-blue-600" />
              {meet.location || "Location TBD"}
            </span>
            <span>Host: {meet.hostClub}</span>
            <PnsMeetLink sourceKey={meet.sourceKey} />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}
        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>
        )}
        {meet.pendingSourceReview && (
          <Card className="border-0 shadow-md border-l-4 border-l-orange-400">
            <CardHeader>
              <CardTitle>PNS found updates</CardTitle>
              <CardDescription>
                This meet is already in our list. Review the changes below. Families still see the current version until you Accept.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-sm list-disc pl-5">
                {(meet.pendingSourceDiffs || []).length > 0 ? (
                  (meet.pendingSourceDiffs || []).map((d) => <li key={d}>{d}</li>)
                ) : (
                  <li>PNS calendar data changed.</li>
                )}
              </ul>
              <Input placeholder="Note for parents (optional)" value={banner} onChange={(e) => setBanner(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => act({ action: "acceptUpdate", banner }, "Update accepted. Parent pages now show the new PNS info.")}>
                  Accept update
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => act({ action: "dismissUpdate" }, "PNS update dismissed. Family pages stay as they are.")}>
                  Keep current version
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {meet.status === "cancelled" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {meet.rejectedReason || "This meet will not be posted to families."}
            {meet.rejectedAt ? ` Rejected ${new Date(meet.rejectedAt).toLocaleString()}.` : ""}
          </div>
        )}

        <Card className="border-0 shadow-md border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardDescription>Do this next</CardDescription>
            <CardTitle className="text-xl">{guide.nextTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">{guide.nextDetail}</p>
            {guide.current !== "done" && stepBody(guide.current)}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress</CardTitle>
            <CardDescription>Later steps stay locked so you cannot send entries before families RSVP, or publish before an invitational invite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {guide.steps.map((step, index) => {
              const canOpen = step.state === "done" || step.state === "current";
              const open = canOpen && activeStep === step.id && step.state === "done";
              return (
                <div key={step.id} className={`rounded-lg border px-3 py-2 ${step.state === "current" ? "border-blue-200 bg-blue-50/70" : "bg-white"}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    disabled={!canOpen || step.state === "current"}
                    onClick={() => setOpenedStep(open ? guide.current : step.id)}
                  >
                    <StepMark index={index + 1} state={step.state} />
                    <span className={`flex-1 text-sm font-medium ${step.state === "locked" ? "text-slate-400" : "text-slate-800"}`}>
                      {step.title}
                      {step.state === "skipped" ? " — not needed for an open meet" : ""}
                    </span>
                    {step.state === "locked" && <Lock className="h-3.5 w-3.5 text-slate-300" />}
                    {step.state === "done" && (open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />)}
                  </button>
                  {open && <div className="mt-3 border-t pt-3">{stepBody(step.id)}</div>}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <button type="button" className="flex w-full items-center justify-between px-6 py-4 text-left" onClick={() => setPacketOpen(!packetExpanded)}>
            <span className="font-medium text-slate-800">Meet packet</span>
            {packetExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
          {packetExpanded && (
            <CardContent className="space-y-3 pt-0">
              {meet.eligibilityNotes.length > 0 && (
                <ul className="text-[13px] text-slate-700 list-disc pl-5 space-y-0.5">
                  {meet.eligibilityNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <PnsMeetLink sourceKey={meet.sourceKey} className="block text-sm text-blue-700 underline" />
              {(meet.sourceFiles || []).map((file) => (
                <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="block text-sm text-blue-700 underline">
                  {file.kind === "event_file" ? "Event file: " : file.kind === "announcement" ? "Announcement: " : "PNS file: "}
                  {file.name}
                </a>
              ))}
              {meet.announcementUrl && !(meet.sourceFiles || []).some((f) => f.url === meet.announcementUrl) && (
                <a href={meet.announcementUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-blue-700 underline">
                  Open announcement PDF
                </a>
              )}
              {meet.sourceLastCheckedAt && (
                <p className="text-xs text-slate-400">Last checked PNS {new Date(meet.sourceLastCheckedAt).toLocaleString()}</p>
              )}
              {meet.announcementText && (
                <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <MeetAnnouncementText text={meet.announcementText} hostClub={meet.hostClub} />
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {showFamilies && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Family responses
              </CardTitle>
              <CardDescription>
                Requested events stay on file. The final events you save here are what Prime stores for this swimmer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {commitments.length === 0 && <p className="text-sm text-slate-500">No parent responses yet.</p>}
              {commitments.map((c) => (
                <AdminCommitmentEditor
                  key={`${c.id}-${c.updatedAt || c.attendance}-${(c.confirmedEventIds || []).join(",")}`}
                  meet={meet}
                  commitment={c}
                  swimmerName={swimmerName(c.swimmerId)}
                  busy={busy}
                  onSave={(patch) =>
                    act(
                      { action: "updateCommitment", swimmerId: c.swimmerId, ...patch },
                      "Saved this swimmer’s final entry.",
                      { stay: true }
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function StepMark({ index, state }: { index: number; state: "skipped" | "done" | "current" | "locked" }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-[11px] font-semibold text-white">{index}</span>;
  }
  if (state === "skipped") {
    return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-500">–</span>;
  }
  return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-400">{index}</span>;
}

function EventFilePanel({
  meet,
  fileName,
  busy,
  when,
  onPick,
}: {
  meet: Meet;
  fileName: string;
  busy: boolean;
  when: "before_publish" | "during_rsvp" | "after_close";
  onPick: (file: File) => Promise<void>;
}) {
  const hint =
    when === "before_publish"
      ? "If the host already sent the Event File, upload it now. Families can then check events when they Attend. If it has not arrived yet, publish anyway and upload later."
      : when === "during_rsvp"
        ? "If the host sent the file, upload it now. Families who already Attended can come back and check events until the Prime Deadline."
        : "RSVP is closed, so parents can no longer check events. Upload only if you need the event list on the entry letter.";
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{hint}</p>
      <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-6 py-6 ${busy ? "opacity-60" : "cursor-pointer hover:bg-blue-50"}`}>
        <Upload className="h-7 w-7 text-blue-600" />
        <span className="text-sm font-medium text-slate-800">{fileName || "Click to choose a .hyv or .ev3 file"}</span>
        <input
          type="file"
          accept=".hyv,.ev3,.txt,.zip"
          className="hidden"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onPick(file);
          }}
        />
      </label>
      <p className="text-sm text-slate-600">
        {meet.events.length > 0
          ? `${meet.events.length} events imported${meet.eventFileAcceptedAt ? ` · ${new Date(meet.eventFileAcceptedAt).toLocaleString()}` : ""}`
          : "No Event File yet. Parents can Attend and pick days, but cannot check individual events."}
      </p>
      {meet.events.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Event</th>
              </tr>
            </thead>
            <tbody>
              {meet.events.slice(0, 40).map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="px-3 py-1.5">{event.eventNumber}</td>
                  <td className="px-3 py-1.5">{event.sessionName}</td>
                  <td className="px-3 py-1.5">{eventLabel(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminCommitmentEditor({
  meet,
  commitment,
  swimmerName,
  busy,
  onSave,
}: {
  meet: Meet;
  commitment: MeetCommitment;
  swimmerName: string;
  busy: boolean;
  onSave: (patch: {
    attendance: "attend" | "decline";
    availableSessionIds: string[];
    eventIds: string[];
    parentNotes: string;
    hostCutNote: string;
  }) => void;
}) {
  const sessionIds = meet.sessions.length ? meet.sessions.map((s) => s.id) : ["saturday", "sunday"];
  const finalized = parentEventLabel(meet.status) === "confirmed" || meet.status === "host_reply_received";
  const [attendance, setAttendance] = useState<"attend" | "decline">(commitment.attendance === "decline" ? "decline" : "attend");
  const [days, setDays] = useState(commitment.availableSessionIds);
  const [eventIds, setEventIds] = useState(
    finalized ? commitment.confirmedEventIds || commitment.selectedEventIds : commitment.selectedEventIds
  );
  const [notes, setNotes] = useState(commitment.parentNotes || "");
  const [cutNote, setCutNote] = useState(commitment.hostCutNote || "");
  const requested = commitment.selectedEventIds
    .map((eid) => meet.events.find((e) => e.id === eid))
    .filter(Boolean)
    .map((e) => eventLabel(e!));

  return (
    <div className="rounded-lg border bg-white p-3 text-sm space-y-3">
      <div className="font-medium text-slate-800">
        {swimmerName}
        <span className="ml-2 text-xs font-normal text-slate-500">{commitment.attendance}</span>
        {commitment.isTestData ? <Badge className="ml-2 bg-amber-100 text-amber-800">TEST</Badge> : null}
      </div>
      {requested.length > 0 && (
        <p className="text-xs text-slate-500">Parent requested: {requested.join(", ")}</p>
      )}
      <div className="flex gap-3">
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" name={`att-${commitment.id}`} checked={attendance === "attend"} onChange={() => setAttendance("attend")} />
          Attend
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="radio" name={`att-${commitment.id}`} checked={attendance === "decline"} onChange={() => setAttendance("decline")} />
          Decline
        </label>
      </div>
      <div>
        <div className="text-xs font-medium text-slate-600 mb-1">Days</div>
        {sessionIds.map((day) => (
          <label key={day} className="mr-3 inline-flex items-center gap-1 capitalize">
            <input
              type="checkbox"
              checked={days.includes(day)}
              onChange={(e) => setDays((prev) => (e.target.checked ? [...prev, day] : prev.filter((d) => d !== day)))}
            />
            {day}
          </label>
        ))}
      </div>
      {meet.events.length > 0 && attendance === "attend" && (
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">Final events</div>
          <div className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 space-y-1">
            {meet.events.map((event) => (
              <label key={event.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventIds.includes(event.id)}
                  onChange={(e) =>
                    setEventIds((prev) => (e.target.checked ? [...prev, event.id] : prev.filter((id) => id !== event.id)))
                  }
                />
                {event.sessionName}: {eventLabel(event)}
              </label>
            ))}
          </div>
        </div>
      )}
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to coach" />
      {(meet.status === "host_reply_received" || parentEventLabel(meet.status) === "confirmed") && (
        <Input value={cutNote} onChange={(e) => setCutNote(e.target.value)} placeholder="Host cut / admin note" />
      )}
      <Button
        size="sm"
        disabled={busy}
        onClick={() =>
          onSave({
            attendance,
            availableSessionIds: days,
            eventIds: attendance === "decline" ? [] : eventIds,
            parentNotes: notes,
            hostCutNote: cutNote,
          })
        }
      >
        Save final entry
      </Button>
    </div>
  );
}
