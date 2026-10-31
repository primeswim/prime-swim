// components/parent-testimonials-section.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./parent-testimonials-section.module.css";
import { MessageSquare, Quote } from "lucide-react";

import { normalizeCoachMoDisplay } from "@/lib/coach-display-name";

interface Testimonial {
  id: string;
  content: string;
  parentName?: string;
  swimmerName?: string;
}

// Preserve the original words while emphasizing selected passages from current feedback.
const highlightedPassages = /(first place in 2 heats|time improved for all\.|she really enjoys the swimming class\.|We fully trust your judgement|huge progress with his arm technique|improved cross the board\.|she really improved a loooot,|we recommended you to our friends\.|amazing progress, learning Freestyle and Backstroke in such a short time\.|believes in her and cheers her on)/gi;

function testimonialContent(content: string) {
  return normalizeCoachMoDisplay(content).split(highlightedPassages).map((part, index) =>
    index % 2 ? <strong key={index} className={styles.emphasis}>{part}</strong> : part
  );
}

export default function ParentTestimonialsSection() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestimonials();
  }, []);

  const loadTestimonials = async () => {
    try {
      const res = await fetch("/api/testimonials");
      if (!res.ok) throw new Error("Failed to load testimonials");
      const data = await res.json();
      setTestimonials(data.testimonials || []);
    } catch (err) {
      console.error("Load testimonials error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (testimonials.length === 0) {
    return null; // Don't show section if no testimonials
  }

  return (
    <section className="bg-slate-50 py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            <h2 className="text-4xl font-bold text-slate-800">What Parents Say</h2>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Hear from our families about their experience with Prime Swim Academy
          </p>
        </div>

        <div className={`${styles.wall} max-w-7xl mx-auto`}>
          {testimonials.map((testimonial) => (
            <article key={testimonial.id} className={styles.note}>
              <Quote className={styles.quote} aria-hidden="true" />
              <blockquote className="text-sm text-slate-700 leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {testimonialContent(testimonial.content)}
              </blockquote>
            </article>
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Button asChild className="bg-slate-800 hover:bg-slate-700 text-white rounded-full px-6">
            <Link href="/tryout">Schedule a Tryout</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}


