import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/site.ts";

// The free Vercel address stays out of search engines until the paper's own
// domain points here (lib/site.ts); then everything but search and the API is open.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  // the pages each reader makes for themselves (search results, saved stories) and the editor's own; never the photos
  const own = ["/search", "/saved", "/aavtikal/search"].flatMap((p) => [p, `/en${p}`, `/hi${p}`]);
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/editor", ...own] },
           sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`] };
}
