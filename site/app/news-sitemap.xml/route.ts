import { sitemapEntries } from "@/lib/db.ts";
import { newsSitemapIndex } from "@/lib/feeds.ts";

// Google News's sitemap (the address in Search Console and robots.txt): an index of one file per language, each with the
// last two days' stories (news-sitemap-gu.xml, -en, -hi). Renewed by every publish, and at most ten minutes old.
export const revalidate = 600;
export async function GET() {
  const newest = (await sitemapEntries(2))[0]?.publishedAt ?? null;
  return new Response(newsSitemapIndex(newest), { headers: { "content-type": "application/xml; charset=utf-8" } });
}
