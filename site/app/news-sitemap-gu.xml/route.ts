import { sitemapEntries } from "@/lib/db.ts";
import { newsSitemap } from "@/lib/feeds.ts";

// The Gujarati stories of the last two days for Google News (news-sitemap.xml lists this file). Renewed by every publish
// (/api/refresh renews the whole site), and at most ten minutes old even if that call is missed.
export const revalidate = 600;
export async function GET() {
  return new Response(newsSitemap(await sitemapEntries(2), "gu"), { headers: { "content-type": "application/xml; charset=utf-8" } });
}
