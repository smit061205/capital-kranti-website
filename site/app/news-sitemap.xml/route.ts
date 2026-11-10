import { sitemapEntries } from "@/lib/db.ts";
import { newsSitemapIndex, xml } from "@/lib/feeds.ts";

// Google News's sitemap (the address in Search Console and robots.txt): an index of one file per language, each with the
// last two days' stories (news-sitemap-gu.xml, -en, -hi). Made when asked for, and at most ten minutes old.
export const dynamic = "force-dynamic";
export async function GET() {
  const newest = (await sitemapEntries(2))[0]?.publishedAt ?? null;
  return xml(newsSitemapIndex(newest));
}
