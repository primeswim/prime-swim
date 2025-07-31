"use client";

import Image from "next/image";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function Header() {
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
        <div className="hidden md:flex items-center space-x-8 text-slate-600">
          {/* About Us */}
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

          {/* Programs */}
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

          {/* News */}
          <Link
            href="/news"
            className="hover:text-slate-800 transition-colors"
          >
            News
          </Link>

          {/* Login */}
          <Link
            href="/login"
            className="hover:text-slate-800 transition-colors"
          >
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
