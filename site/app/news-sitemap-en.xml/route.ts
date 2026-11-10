import { sitemapEntries } from "@/lib/db.ts";
import { newsSitemap, xml } from "@/lib/feeds.ts";

// The English stories of the last two days for Google News (news-sitemap.xml lists this file): made when asked for,
// and at most ten minutes old (lib/feeds.ts xml).
export const dynamic = "force-dynamic";
export async function GET() {
  return xml(newsSitemap(await sitemapEntries(2), "en"));
}
