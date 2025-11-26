// Swimmer Level Definitions
export const SWIMMER_LEVELS = [
  "Bronze Beginner",
  "Bronze Performance",
  "Silver Beginner",
  "Silver Performance",
  "Gold Beginner",
  "Gold Performance",
  "Platinum Beginner",
  "Platinum Performance",
] as const

export type SwimmerLevel = typeof SWIMMER_LEVELS[number]

// Level groups for organization
export const LEVEL_GROUPS = {
  Bronze: ["Bronze Beginner", "Bronze Performance"],
  Silver: ["Silver Beginner", "Silver Performance"],
  Gold: ["Gold Beginner", "Gold Performance"],
  Platinum: ["Platinum Beginner", "Platinum Performance"],
} as const

// Helper function to get level group
export function getLevelGroup(level: SwimmerLevel): string {
  if (level.includes("Bronze")) return "Bronze"
  if (level.includes("Silver")) return "Silver"
  if (level.includes("Gold")) return "Gold"
  if (level.includes("Platinum")) return "Platinum"
  return "Unknown"
}

// Helper function to check if level is beginner or performance
export function isBeginnerLevel(level: SwimmerLevel): boolean {
  return level.includes("Beginner")
}

export function isPerformanceLevel(level: SwimmerLevel): boolean {
  return level.includes("Performance")
}

