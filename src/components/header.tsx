"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="container mx-auto px-4 py-6">
      <nav className="flex items-center justify-between">
        {/* Left: PSA logo + site title + affiliation logos */}
        <div className="flex items-center gap-4">
          {/* PSA brand (link to home) */}
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={60}
              height={60}
              className="rounded-full"
              priority
            />
            <span className="text-xl font-bold text-slate-800">Prime Swim Academy</span>
          </Link>

          {/* Affiliation logos */}
          <div className="flex items-center gap-3">
            <Link
              href="https://www.usaswimming.org/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="USA Swimming"
              title="USA Swimming Member Club"
              className="block"
            >
              <Image
                src="/images/usa-swimming.png"
                alt="USA Swimming"
                width={56}
                height={56}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <Link
              href="https://www.teamunify.com/team/pnws2/page/home"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pacific Northwest Swimming"
              title="Pacific Northwest Swimming (PNS)"
              className="block"
            >
              <Image
                src="/images/pns-logo.JPG"
                alt="Pacific Northwest Swimming (PNS)"
                width={56}
                height={56}
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8 text-slate-600">
          {mounted ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className="hover:text-slate-800 transition-colors cursor-pointer">
                  About Us
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/mission">Mission &amp; Vision</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/coaches">Our Coaches</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/school-policy">School Policy</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/#contact">Contact</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="hover:text-slate-800 transition-colors cursor-pointer">
                  Programs
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/#programs">Group Programs</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/private-lessons">Private Lessons</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/clinics">Clinics</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <span className="hover:text-slate-800 transition-colors cursor-pointer">About Us</span>
              <span className="hover:text-slate-800 transition-colors cursor-pointer">Programs</span>
            </>
          )}

          <Link href="/safesport" className="hover:text-slate-800 transition-colors">
            Safe Sport
          </Link>
          <Link href="/events" className="hover:text-slate-800 transition-colors">
            Events
          </Link>
          <Link href="/news" className="hover:text-slate-800 transition-colors">
            News
          </Link>
          <Link href="/dashboard" className="hover:text-slate-800 transition-colors">
            Dashboard
          </Link>
          {isAdmin === true && (
            mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="hover:text-slate-800 transition-colors cursor-pointer">
                  Admin
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[600px] overflow-y-auto">
                  <DropdownMenuItem asChild>
                    <Link href="/admin/swimmers">Swimmers</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/slots">Slots</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/events">Events</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/events/new">New Event</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuItem asChild>
                    <Link href="/admin/attendance">Attendance</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/attendance/report">Attendance Report</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuItem asChild>
                    <Link href="/admin/makeup">Makeup</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/makeup/attendees">Makeup Attendees</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/tryout-swimmers">Tryout Swimmers</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/private-lesson-swimmers">Private Lesson Swimmers</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin/tuition">Tuition</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/sendemail">Send Email</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/test-reminder">Test Reminder</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/bulk-insert">Bulk Insert</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/news/add">Add News</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/news">Edit News</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/testimonials">Parent Testimonials</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="hover:text-slate-800 transition-colors cursor-pointer">Admin</span>
            )
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-800"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden mt-4 space-y-2 text-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src="/images/usa-swimming.png"
              alt="USA Swimming"
              width={44}
              height={44}
              className="h-8 w-auto object-contain"
            />
            <Image
              src="/images/pns-logo.JPG"
              alt="Pacific Northwest Swimming (PNS)"
              width={44}
              height={44}
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="space-y-1">
            <p className="font-semibold">About Us</p>
            <Link href="/mission" className="block ml-4">Mission &amp; Vision</Link>
            <Link href="/coaches" className="block ml-4">Our Coaches</Link>
            <Link href="/school-policy" className="block ml-4">School Policy</Link>
            <Link href="/#contact" className="block ml-4">Contact</Link>
          </div>

          <div className="space-y-1">
            <p className="font-semibold">Programs</p>
            <Link href="/#programs" className="block ml-4">Group Programs</Link>
            <Link href="/private-lessons" className="block ml-4">Private Lessons</Link>
            <Link href="/clinics" className="block ml-4">Clinics</Link>
          </div>

          <Link href="/safesport" className="block">Safe Sport</Link>
          <Link href="/events" className="block">Events</Link>
          <Link href="/news" className="block">News</Link>
          <Link href="/dashboard" className="block">Dashboard</Link>
          {isAdmin === true && (
            <div className="space-y-1 border-t pt-2 mt-2">
              <p className="font-semibold">Admin</p>
              <Link href="/admin/swimmers" className="block ml-4">Swimmers</Link>
              <Link href="/admin/slots" className="block ml-4">Slots</Link>
              <Link href="/admin/events" className="block ml-4">Events</Link>
              <Link href="/admin/events/new" className="block ml-6">New Event</Link>
              <Link href="/admin/evaluations" className="block ml-4">Evaluations</Link>
              <Link href="/admin/evaluations/new" className="block ml-6">New Evaluation</Link>
              <Link href="/admin/evaluations/templates" className="block ml-6">Templates</Link>
              <Link href="/admin/attendance" className="block ml-4">Attendance</Link>
              <Link href="/admin/attendance/report" className="block ml-6">Attendance Report</Link>
              <Link href="/admin/activity" className="block ml-4">Activity</Link>
              <Link href="/admin/activity/placement" className="block ml-6">Activity Placement</Link>
              <Link href="/admin/clinic" className="block ml-4">Clinic</Link>
              <Link href="/admin/clinic/placement" className="block ml-6">Clinic Placement</Link>
              <Link href="/admin/clinic/registrations" className="block ml-6">Clinic Registrations</Link>
              <Link href="/admin/makeup" className="block ml-4">Makeup</Link>
              <Link href="/admin/makeup/attendees" className="block ml-6">Makeup Attendees</Link>
              <Link href="/admin/tryout-swimmers" className="block ml-4">Tryout Swimmers</Link>
              <Link href="/admin/private-lesson-swimmers" className="block ml-4">Private Lesson Swimmers</Link>
              <Link href="/admin/tuition" className="block ml-4">Tuition</Link>
              <Link href="/admin/sendemail" className="block ml-4">Send Email</Link>
              <Link href="/admin/test-reminder" className="block ml-4">Test Reminder</Link>
              <Link href="/admin/bulk-insert" className="block ml-4">Bulk Insert</Link>
              <Link href="/news/add" className="block ml-4">Add News</Link>
              <Link href="/admin/news" className="block ml-4">Edit News</Link>
              <Link href="/admin/testimonials" className="block ml-4">Parent Testimonials</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
