"use client";

import Link from "next/link";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

type AdminNavMenuProps = {
  variant: "desktop" | "mobile";
};

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 ml-4 mb-1">{title}</p>
      {children}
    </div>
  );
}

function MobileLink({ href, children, nested }: { href: string; children: React.ReactNode; nested?: boolean }) {
  return (
    <Link href={href} className={`block text-sm py-0.5 ${nested ? "ml-6" : "ml-4"}`}>
      {children}
    </Link>
  );
}

export function AdminNavMenu({ variant }: AdminNavMenuProps) {
  if (variant === "mobile") {
    return (
      <>
        <MobileSection title="Swimmers">
          <MobileLink href="/admin/swimmers">Team Swimmers</MobileLink>
          <MobileLink href="/admin/tryout-swimmers">Tryout Swimmers</MobileLink>
          <MobileLink href="/admin/private-lesson-swimmers">PL Swimmers</MobileLink>
        </MobileSection>
        <MobileLink href="/admin/slots">Slots</MobileLink>
        <MobileSection title="Group Training">
          <MobileLink href="/admin/attendance">Attendance</MobileLink>
          <MobileLink href="/admin/attendance/report" nested>Attendance Report</MobileLink>
          <MobileLink href="/admin/makeup">Makeup Sessions</MobileLink>
          <MobileLink href="/admin/makeup/attendees" nested>Makeup Attendees</MobileLink>
        </MobileSection>
        <MobileSection title="Tuition">
          <MobileLink href="/admin/monthly-tuition">Calculate Tuition</MobileLink>
          <MobileLink href="/admin/tuition-billing">Send Tuition Email</MobileLink>
          <MobileLink href="/admin/tuition">Manual Tuition Email</MobileLink>
        </MobileSection>
        <MobileSection title="Programs">
          <MobileLink href="/admin/activity">Activity</MobileLink>
          <MobileLink href="/admin/activity/placement" nested>Activity Placement</MobileLink>
          <MobileLink href="/admin/clinic">Clinic</MobileLink>
          <MobileLink href="/admin/clinic/placement" nested>Clinic Placement</MobileLink>
          <MobileLink href="/admin/clinic/registrations" nested>Clinic Registrations</MobileLink>
        </MobileSection>
        <MobileSection title="Events & Evaluations">
          <MobileLink href="/admin/events">Events</MobileLink>
          <MobileLink href="/admin/events/new" nested>New Event</MobileLink>
          <MobileLink href="/admin/evaluations">Evaluations</MobileLink>
          <MobileLink href="/admin/evaluations/new" nested>New Evaluation</MobileLink>
          <MobileLink href="/admin/evaluations/templates" nested>Templates</MobileLink>
        </MobileSection>
        <MobileSection title="Content & Email">
          <MobileLink href="/news/add">Add News</MobileLink>
          <MobileLink href="/admin/news">Edit News</MobileLink>
          <MobileLink href="/admin/testimonials">Parent Testimonials</MobileLink>
          <MobileLink href="/admin/sendemail">Send Email</MobileLink>
        </MobileSection>
      </>
    );
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Swimmers</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem asChild>
            <Link href="/admin/swimmers">Team Swimmers</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/tryout-swimmers">Tryout Swimmers</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/private-lesson-swimmers">PL Swimmers</Link>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem asChild>
        <Link href="/admin/slots">Slots</Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Group Training</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin/attendance">Attendance</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/attendance/report">Attendance Report</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/makeup">Makeup Sessions</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/makeup/attendees">Makeup Attendees</Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Tuition</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin/monthly-tuition">Calculate Tuition</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/tuition-billing">Send Tuition Email</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/tuition">Manual Tuition Email</Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Programs</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin/activity">Activity</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/activity/placement">Activity Placement</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/clinic">Clinic</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/clinic/placement">Clinic Placement</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/clinic/registrations">Clinic Registrations</Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Events & Evaluations</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin/events">Events</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/events/new">New Event</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/evaluations">Evaluations</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/evaluations/new">New Evaluation</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/evaluations/templates">Templates</Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel>Content & Email</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/news/add">Add News</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/news">Edit News</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/testimonials">Parent Testimonials</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/sendemail">Send Email</Link>
      </DropdownMenuItem>
    </>
  );
}
