// components/parent-testimonials-section.tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const wallRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    let frame = 0;
    const notes = Array.from(wall.querySelectorAll<HTMLElement>("article"));
    const measure = () => {
      for (const note of notes) {
        note.parentElement!.style.gridRowEnd = `span ${Math.ceil((note.offsetHeight + 16) / 4)}`;
      }
      wall.dataset.measured = "true";
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    notes.forEach(note => observer.observe(note));
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [testimonials, loading]);

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

        <div ref={wallRef} className={`${styles.wall} max-w-7xl mx-auto`}>
          {testimonials.map((testimonial, index) => (
            <div key={testimonial.id} className={styles.item} data-palette={index % 7}
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                const node = event.currentTarget;
                const rect = node.getBoundingClientRect();
                const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
                node.style.setProperty("--pointer-x", `${x * 100}%`);
                node.style.setProperty("--pointer-y", `${y * 100}%`);
                node.style.setProperty("--tilt-x", `${(0.5 - y) * 2}deg`);
                node.style.setProperty("--tilt-y", `${(x - 0.5) * 2}deg`);
              }}
              onPointerLeave={(event) => {
                event.currentTarget.style.setProperty("--tilt-x", "0deg");
                event.currentTarget.style.setProperty("--tilt-y", "0deg");
              }}>
            <article className={styles.note}>
              <Quote className={styles.quote} aria-hidden="true" />
              <blockquote className="text-sm text-slate-700 leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                {testimonialContent(testimonial.content)}
              </blockquote>
            </article>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-6">
          <Button asChild size="lg" className="bg-slate-800 hover:bg-slate-700 text-white rounded-full px-8 py-6 text-lg font-medium">
            <Link href="/tryout">Schedule a Tryout</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}


