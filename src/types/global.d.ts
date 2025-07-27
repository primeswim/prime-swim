declare module 'react-big-calendar' {
    import * as React from 'react';
  
    export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';
  
    export interface Event {
      title: string;
      allDay?: boolean;
      start: Date;
      end: Date;
      [key: string]: any;
    }
  
    export interface CalendarProps<T extends object = Event> {
      localizer: any;
      events: T[];
      startAccessor: string | ((event: T) => Date);
      endAccessor: string | ((event: T) => Date);
      titleAccessor?: string | ((event: T) => string);
      view?: View;
      date?: Date;
      onView?: (view: View) => void;
      onNavigate?: (date: Date, view: View, action: string) => void;
      onSelectEvent?: (event: T) => void;
      eventPropGetter?: (event: T) => { style?: React.CSSProperties };
      style?: React.CSSProperties;
      className?: string;
      [key: string]: any;
    }
  
    export function Calendar<T extends object = Event>(props: CalendarProps<T>): JSX.Element;
  
    export function momentLocalizer(momentInstance: any): any;
    export function dateFnsLocalizer(config: any): any;
  }
  