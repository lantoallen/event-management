import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Only the public pages. Event pages change daily with the demo reset, so
// they're left for crawlers to find from the home page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/signup`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
