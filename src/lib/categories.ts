import type { EventCategory } from "@/server/db/schema";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  tech: "Tech",
  music: "Music",
  sports: "Sports",
  food: "Food",
  arts: "Arts",
  community: "Community",
  business: "Business",
  education: "Learning",
};

// A small marker color per category. Muted enough to read on both themes.
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  tech: "#3d6fb5",
  music: "#8a55b0",
  sports: "#2f8a55",
  food: "#c2662d",
  arts: "#c04a6c",
  community: "#23857b",
  business: "#5b5aa6",
  education: "#b08a1e",
};
