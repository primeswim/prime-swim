"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            </DropdownMenuContent>
          </DropdownMenu>

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
          </div>

          <Link href="/safesport" className="block">Safe Sport</Link>
          <Link href="/events" className="block">Events</Link>
          <Link href="/news" className="block">News</Link>
          <Link href="/dashboard" className="block">Dashboard</Link>
        </div>
      )}
    </header>
  );
}
