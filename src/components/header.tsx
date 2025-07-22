"use client";

import Image from "next/image";
import Link from "next/link";
import { userIsAdminFromDB } from "../hooks/userIsAdminFromDB";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const isAdmin = userIsAdminFromDB();
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

        {/* Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-slate-600 hover:text-slate-800 transition-colors cursor-pointer">
              About Us
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href="/mission">Mission & Vision</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/coaches">Our Coaches</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/#programs"
            className="text-slate-600 hover:text-slate-800 transition-colors"
          >
            Programs
          </Link>
          <Link
            href="/#schedule"
            className="text-slate-600 hover:text-slate-800 transition-colors"
          >
            Schedule
          </Link>
          <Link
            href="/#contact"
            className="text-slate-600 hover:text-slate-800 transition-colors"
          >
            Contact
          </Link>
          <Link
            href="/login"
            className="text-slate-600 hover:text-slate-800 transition-colors"
          >
            Login
          </Link>
          {isAdmin && (
            <Link
              href="/news/add"
              className="text-slate-600 hover:text-slate-800 transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
