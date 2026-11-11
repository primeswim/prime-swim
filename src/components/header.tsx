"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Menu, X } from "lucide-react";
import { useIsAdminFromDB } from "@/hooks/useIsAdminFromDB";
import { AdminNavMenu } from "@/components/admin-nav-menu";
import { signOutToLogin } from "@/lib/auth-session";
import { auth } from "@/lib/firebase";
import TryoutLink from "./tryout-link";
import styles from "./header-brand.module.css";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user] = useAuthState(auth);
  const isAdmin = useIsAdminFromDB();

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleLogout() {
    setMobileOpen(false);
    void signOutToLogin();
  }

  return (
    <header className={styles.header}>
      <div className={`container mx-auto px-4 ${styles.inner}`}>
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

          <div className={styles.navActions}>
            {/* Desktop Navigation */}
            <div className={`hidden xl:flex ${styles.desktopNav}`}>
              {mounted ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={styles.navItem}>
                      About Us <ChevronDown aria-hidden="true" className={styles.chevron} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.dropdown}>
                      <DropdownMenuItem asChild>
                        <Link href="/mission">Mission &amp; Vision</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/coaches#top">Our Coaches</a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/school-policy">Team Policy</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href="/#contact">Contact</a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger className={styles.navItem}>
                      Programs <ChevronDown aria-hidden="true" className={styles.chevron} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.dropdown}>
                      <DropdownMenuItem asChild>
                        <a href="/#programs">Team Practice</a>
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
                  <span className={styles.navItem}>About Us</span>
                  <span className={styles.navItem}>Programs</span>
                </>
              )}

              <Link href="/safesport" className={styles.navItem}>
                Safe Sport
              </Link>
              <Link href="/events" className={styles.navItem}>
                Events
              </Link>
              <Link href="/news" className={styles.navItem}>
                News
              </Link>
              {user ? (
                <button type="button" className={styles.navItem} onClick={handleLogout}>Logout</button>
              ) : (
                <Link href="/dashboard" className={styles.navItem}>Login</Link>
              )}
              {isAdmin === true && (
                mounted ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className={styles.navItem}>
                      Admin <ChevronDown aria-hidden="true" className={styles.chevron} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={`${styles.dropdown} max-h-[600px] overflow-y-auto`}>
                      <AdminNavMenu variant="desktop" />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className={styles.navItem}>Admin</span>
                )
              )}
            </div>

            <TryoutLink className={styles.tryout} onClick={() => setMobileOpen(false)} />

            {/* Mobile Menu Button */}
            <button
              className={`flex xl:hidden text-slate-800 ${styles.menu}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="header-mobile-navigation"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown */}
        {mobileOpen && (
          <div id="header-mobile-navigation" className={`xl:hidden mt-4 space-y-3 text-lg leading-relaxed ${styles.mobileNav}`} onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setMobileOpen(false);
          }}>
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
              <a href="/coaches#top" className="block ml-4">Our Coaches</a>
              <Link href="/school-policy" className="block ml-4">Team Policy</Link>
              <a href="/#contact" className="block ml-4">Contact</a>
            </div>

            <div className="space-y-1">
              <p className="font-semibold">Programs</p>
              <a href="/#programs" className="block ml-4">Team Practice</a>
              <Link href="/private-lessons" className="block ml-4">Private Lessons</Link>
              <Link href="/clinics" className="block ml-4">Clinics</Link>
            </div>

            <Link href="/safesport" className="block">Safe Sport</Link>
            <Link href="/events" className="block">Events</Link>
            <Link href="/news" className="block">News</Link>
            {user ? (
              <button type="button" className={styles.mobileLogout} onClick={handleLogout}>Logout</button>
            ) : (
              <Link href="/dashboard" className="block">Login</Link>
            )}
            {isAdmin === true && (
              <div className="space-y-1 border-t pt-2 mt-2">
                <p className="font-semibold">Admin</p>
                <AdminNavMenu variant="mobile" />
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
