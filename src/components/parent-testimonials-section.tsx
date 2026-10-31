// components/parent-testimonials-section.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Quote } from "lucide-react";

import { normalizeCoachMoDisplay } from "@/lib/coach-display-name";

interface Testimonial {
  id: string;
  content: string;
  parentName?: string;
  swimmerName?: string;
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

        <div className="grid items-start md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="gap-0 border-0 py-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white"
            >
              <CardContent className="p-4">
                <div className="mb-2">
                  <Quote className="w-5 h-5 text-blue-200" />
                </div>
                <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">
                  {normalizeCoachMoDisplay(testimonial.content)}
                </p>
                {testimonial.parentName && (
                  <div className="text-xs text-slate-500 mt-3 pt-2 border-t">
                    <span className="font-medium">— {normalizeCoachMoDisplay(testimonial.parentName)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}


