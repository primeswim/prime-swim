"use client";

import Image from "next/image";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer id="contact" className="bg-slate-800 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <Image
                src="/images/psa-logo.png"
                alt="Prime Swim Academy Logo"
                width={50}
                height={50}
                className="rounded-full"
              />
              <span className="text-xl font-bold">Prime Swim Academy</span>
            </div>
            <p className="text-slate-300 text-sm">
              Excellence in swimming instruction. Building confidence, technique, and champions one stroke at a time.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-3 text-slate-300">
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-3" />
                <span className="text-sm">(401) 402-0052</span>
              </div>
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-3" />
                <span className="text-sm">prime.swim.us@gmail.com</span>
              </div>
              <div className="flex items-start">
                <MapPin className="w-4 h-4 mr-3 mt-1" />
                <span className="text-sm">Bellevue, Washington</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <div className="space-y-2 text-slate-300">
              <Link href="/tryout" className="block text-sm hover:text-white transition-colors">
                Schedule Tryout
              </Link>
              <Link href="#programs" className="block text-sm hover:text-white transition-colors">
                Programs
              </Link>
              <Link href="#coaches" className="block text-sm hover:text-white transition-colors">
                Our Coaches
              </Link>
              <Link href="#schedule" className="block text-sm hover:text-white transition-colors">
                Schedules
              </Link>
            </div>
          </div>

          {/* WeChat */}
          <div className="text-center flex flex-col items-center justify-start h-full">
            <h3 className="text-lg font-semibold mb-2">WeChat</h3>
            <Image
              src="/images/wechatlogo.JPG"
              alt="Prime Swim Academy QR Code"
              width={120}
              height={120}
              className="rounded-lg shadow-md"
            />
          </div>
        </div>

        <div className="border-t border-slate-700 mt-12 pt-8 text-center">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} Prime Swim Academy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
