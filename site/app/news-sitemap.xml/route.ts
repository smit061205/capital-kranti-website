import { sitemapEntries } from "@/lib/db.ts";
import { newsSitemap } from "@/lib/feeds.ts";

// Renewed by every publish (/api/refresh renews the whole site), and at most ten minutes old even if that call is missed:
// Google News reads only the last two days and comes back often
export const revalidate = 600;
export async function GET() {
  return new Response(newsSitemap(await sitemapEntries(2)), { headers: { "content-type": "application/xml; charset=utf-8" } });
}
