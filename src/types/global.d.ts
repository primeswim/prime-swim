declare module 'react-big-calendar' {
    import * as React from 'react';
  
    export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';
  
    export interface Event {
      title: string;
      allDay?: boolean;
      start: Date;
      end: Date;
      [key: string]: unknown; // 原来是 any
    }
  
    export interface CalendarProps<T extends object = Event> {
      localizer: {
        format: (value: Date, format: string, culture?: string) => string;
        formats: Record<string, unknown>;
        firstOfWeek: (culture: string) => number;
        messages: Record<string, string>;
      };
      events: T[];
      startAccessor: string | ((event: T) => Date);
      endAccessor: string | ((event: T) => Date);
      titleAccessor?: string | ((event: T) => string);
      view?: View;
      date?: Date;
      onView?: (view: View) => void;
      onNavigate?: (date: Date, view: View, action: 'NEXT' | 'PREV' | 'DATE') => void;
      onSelectEvent?: (event: T) => void;
      eventPropGetter?: (event: T) => { style?: React.CSSProperties };
      style?: React.CSSProperties;
      className?: string;
      [key: string]: unknown;
    }
  
    export function Calendar<T extends object = Event>(props: CalendarProps<T>): JSX.Element;
  
    export function momentLocalizer(momentInstance: {
      format: (value: Date, format: string, culture?: string) => string;
      parse: (dateString: string, format: string, culture?: string) => Date;
      startOf: (date: Date, unit: string) => Date;
      endOf: (date: Date, unit: string) => Date;
      firstDayOfWeek: () => number;
    }): ReturnType<typeof Calendar>;
  
    export function dateFnsLocalizer(config: {
      format: (value: Date, format: string, options?: object) => string;
      parse: (value: string, format: string, referenceDate: Date, options?: object) => Date;
      startOfWeek: (date: Date, options?: object) => Date;
      getDay: (date: Date) => number;
      locales: Record<string, object>;
    }): ReturnType<typeof Calendar>;
  }
  