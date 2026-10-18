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

// Tint for the date block on each card. Kept muted so the text stays readable
// in both themes.
export const CATEGORY_TINT: Record<EventCategory, string> = {
  tech: "bg-[#e6ecf7] text-[#24467d] dark:bg-[#1a2333] dark:text-[#9fb9e6]",
  music: "bg-[#efe6f5] text-[#5d2f7d] dark:bg-[#271d2e] dark:text-[#cfa9e8]",
  sports: "bg-[#e3f1e6] text-[#21633a] dark:bg-[#17291d] dark:text-[#93d4a7]",
  food: "bg-[#fbeadd] text-[#8a3f0c] dark:bg-[#2e1f14] dark:text-[#efb48a]",
  arts: "bg-[#f9e4e8] text-[#8a2440] dark:bg-[#2e1a1f] dark:text-[#eea5b6]",
  community: "bg-[#ddf0ee] text-[#165f58] dark:bg-[#142a28] dark:text-[#8ad3ca]",
  business: "bg-[#e9e8f2] text-[#3c3a6e] dark:bg-[#1f1e2b] dark:text-[#b3b0e3]",
  education: "bg-[#f7efd6] text-[#7a5800] dark:bg-[#2b2513] dark:text-[#e6c76f]",
};
