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
