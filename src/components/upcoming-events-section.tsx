"use client";

import { useEffect, useState } from "react";
import { Event, EVENT_CATEGORY_LABELS, EVENT_CATEGORY_COLORS, getEventStatus } from "@/types/event";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, ExternalLink, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function UpcomingEventsSection() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/events?publishedOnly=true&status=upcoming');
        const data = await res.json();
        
        if (data.ok) {
          // Helper to convert date to string
          const dateToString = (date: string | Date | { toDate?: () => Date } | undefined): string => {
            if (!date) return ''
            if (typeof date === 'string') return date
            if (date instanceof Date) return date.toISOString().split('T')[0]
            if (typeof date === 'object' && date !== null && 'toDate' in date && typeof date.toDate === 'function') {
              return date.toDate().toISOString().split('T')[0]
            }
            return ''
          }
          
          const eventsList = data.events.map((e: Event & { startDate?: string | Date | { toDate?: () => Date }; endDate?: string | Date | { toDate?: () => Date } }) => ({
            ...e,
            startDate: dateToString(e.startDate),
            endDate: e.endDate ? dateToString(e.endDate) : undefined,
          }))
          
          // Sort by date and take first 3
          eventsList.sort((a: Event, b: Event) => {
            const aDate = new Date(a.startDate).getTime();
            const bDate = new Date(b.startDate).getTime();
            return aDate - bDate;
          });
          
          setUpcomingEvents(eventsList.slice(0, 3));
        }
      } catch (error) {
        console.error("Failed to fetch upcoming events:", error);
        setUpcomingEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingEvents();
  }, []);

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (upcomingEvents.length === 0) {
    return null; // Don't show section if no events
  }

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold text-slate-800 mb-4">Upcoming Events</h2>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Stay informed about swim meets, meetings, and academy activities
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
        {upcomingEvents.map((event) => {
          const status = getEventStatus(event);
          const statusColors = {
            upcoming: 'bg-blue-100 text-blue-700',
            current: 'bg-green-100 text-green-700',
            past: 'bg-slate-100 text-slate-700',
            archived: 'bg-gray-100 text-gray-700',
          };
          
          return (
            <Card key={event.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge className={EVENT_CATEGORY_COLORS[event.category]}>
                    {EVENT_CATEGORY_LABELS[event.category]}
                  </Badge>
                  <Badge className={statusColors[status]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                </div>
                <CardTitle className="text-xl mb-2 line-clamp-2">{event.title}</CardTitle>
                <CardDescription className="line-clamp-2">{event.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>{formatDate(event.startDate)}</span>
                    {event.startTime && <span className="text-slate-500">• {formatTime(event.startTime)}</span>}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {event.registrationRequired && event.registrationDeadline && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-2 rounded-r-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-orange-800">
                          Deadline: <span className="font-bold">{formatDate(event.registrationDeadline)}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href={`/events/${event.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      View Details
                    </Button>
                  </Link>
                  {event.registrationRequired && event.registrationUrl && (
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <a
                        href={event.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Register
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center">
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-0 shadow-xl bg-white hover:bg-slate-50 text-slate-800 px-8 py-6 text-lg rounded-full transition-all duration-300"
        >
          <Link href="/events">
            <Calendar className="w-5 h-5 mr-2" />
            View All Events
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

