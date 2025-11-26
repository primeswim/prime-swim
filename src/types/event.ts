import { Timestamp } from "firebase/firestore";

// Event categories
export type EventCategory = 
  | "swim_meet"           // 游泳比赛
  | "board_meeting"        // 董事会会议
  | "parents_meeting"      // 家长会
  | "volunteer"            // 志愿者活动
  | "training"             // 训练相关
  | "social"               // 社交活动
  | "fundraising"          // 筹款活动
  | "other";               // 其他

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  swim_meet: "Swim Meet",
  board_meeting: "Board Meeting",
  parents_meeting: "Parents Meeting",
  volunteer: "Volunteer Event",
  training: "Training",
  social: "Social Event",
  fundraising: "Fundraising",
  other: "Other",
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  swim_meet: "bg-blue-100 text-blue-700 border-blue-200",
  board_meeting: "bg-purple-100 text-purple-700 border-purple-200",
  parents_meeting: "bg-green-100 text-green-700 border-green-200",
  volunteer: "bg-orange-100 text-orange-700 border-orange-200",
  training: "bg-cyan-100 text-cyan-700 border-cyan-200",
  social: "bg-pink-100 text-pink-700 border-pink-200",
  fundraising: "bg-yellow-100 text-yellow-700 border-yellow-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

// Event document/file
export interface EventDocument {
  id: string;
  name: string;
  url: string;
  type?: string; // e.g., "PDF", "DOC", "Link"
}

// Event interface
export interface Event {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  
  // Date and time
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (24-hour format)
  endDate?: string; // YYYY-MM-DD (if multi-day event)
  endTime?: string; // HH:mm
  
  // Location
  location?: string;
  locationAddress?: string;
  locationUrl?: string; // Google Maps link or venue website
  
  // Registration
  registrationDeadline?: string; // YYYY-MM-DD
  registrationUrl?: string; // USA Swimming link or other registration link
  registrationRequired: boolean;
  registrationNotes?: string; // Additional notes about registration
  
  // Documents
  documents?: EventDocument[];
  
  // Additional info
  contactEmail?: string;
  contactPhone?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  
  // Status
  isPublished: boolean;
  isArchived: boolean; // Manually archived events
  
  // Metadata
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string; // Admin email or name
}

// Helper function to check if event is upcoming
export function isEventUpcoming(event: Event): boolean {
  if (event.isArchived) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
  endDate.setHours(23, 59, 59, 999);
  
  return endDate >= today;
}

// Helper function to check if event is past
export function isEventPast(event: Event): boolean {
  if (event.isArchived) return true;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
  endDate.setHours(23, 59, 59, 999);
  
  return endDate < today;
}

// Helper function to get event status
export function getEventStatus(event: Event): "upcoming" | "current" | "past" | "archived" {
  if (event.isArchived) return "archived";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(event.startDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
  endDate.setHours(23, 59, 59, 999);
  
  if (endDate < today) return "past";
  if (startDate <= today && endDate >= today) return "current";
  return "upcoming";
}

