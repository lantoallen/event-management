import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // Personal pages and the API aren't useful in search results.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/tickets", "/inbox", "/organize", "/account", "/reset-password"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
