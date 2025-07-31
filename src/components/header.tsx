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
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3">
          <Image
            src="/images/psa-logo.png"
            alt="Prime Swim Academy Logo"
            width={60}
            height={60}
            className="rounded-full"
          />
          <span className="text-xl font-bold text-slate-800">Prime Swim Academy</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8 text-slate-600">
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:text-slate-800 transition-colors cursor-pointer">
              About Us
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href="/mission">Mission & Vision</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/coaches">Our Coaches</Link>
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

          <Link href="/news" className="hover:text-slate-800 transition-colors">
            News
          </Link>

          <Link href="/login" className="hover:text-slate-800 transition-colors">
            Login
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-slate-800"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden mt-4 space-y-2 text-slate-700">
          <div className="space-y-1">
            <p className="font-semibold">About Us</p>
            <Link href="/mission" className="block ml-4">Mission & Vision</Link>
            <Link href="/coaches" className="block ml-4">Our Coaches</Link>
            <Link href="/#contact" className="block ml-4">Contact</Link>
          </div>

          <div className="space-y-1">
            <p className="font-semibold">Programs</p>
            <Link href="/#programs" className="block ml-4">Group Programs</Link>
            <Link href="/private-lessons" className="block ml-4">Private Lessons</Link>
          </div>

          <Link href="/news" className="block">News</Link>
          <Link href="/login" className="block">Login</Link>
        </div>
      )}
    </header>
  );
}
