import { latestStories } from "@/lib/db.ts";
import { rss } from "@/lib/feeds.ts";

export const revalidate = 3600;
export async function GET() {
  return new Response(rss(await latestStories(120), "gu", "/rss.xml"), { headers: { "content-type": "application/xml; charset=utf-8" } });
}
