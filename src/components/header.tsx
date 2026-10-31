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
import { AdminNavMenu } from "@/components/admin-nav-menu";
import styles from "./header-brand.module.css";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className={`container mx-auto px-4 ${styles.header}`}>
      <nav className={`flex items-center justify-between ${styles.nav}`}>
        {/* Left: PSA logo + site title + affiliation logos */}
        <div className={styles.brandGroup}>
          {/* PSA brand (link to home) */}
          <Link href="/" className={styles.brand}>
            <Image
              src="/images/psa-logo.png"
              alt="Prime Swim Academy Logo"
              width={76}
              height={76}
              className={styles.logo}
              priority
            />
            <span className={styles.name}><span>Prime Swim</span><span>Academy</span></span>
          </Link>

          {/* Affiliation logos */}
          <div className={styles.partners}>
            <Link
              href="https://www.usaswimming.org/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="USA Swimming"
              title="USA Swimming Member Club"
              className={styles.partner}
            >
              <Image
                src="/images/usa-swimming.png"
                alt="USA Swimming"
                width={76}
                height={68}
                className={styles.partnerLogo}
              />
            </Link>
            <Link
              href="https://www.teamunify.com/team/pnws2/page/home"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pacific Northwest Swimming"
              title="Pacific Northwest Swimming (PNS)"
              className={styles.partner}
            >
              <Image
                src="/images/pns-logo.JPG"
                alt="Pacific Northwest Swimming (PNS)"
                width={76}
                height={68}
                className={styles.partnerLogo}
              />
            </Link>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden xl:flex items-center gap-5 text-sm text-slate-600">
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
                    <Link href="/school-policy">Team Policy</Link>
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
                  <AdminNavMenu variant="desktop" />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="hover:text-slate-800 transition-colors cursor-pointer">Admin</span>
            )
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className={`xl:hidden text-slate-800 ${styles.menu}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="xl:hidden mt-4 space-y-2 text-slate-700">
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
            <Link href="/school-policy" className="block ml-4">Team Policy</Link>
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
              <AdminNavMenu variant="mobile" />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
