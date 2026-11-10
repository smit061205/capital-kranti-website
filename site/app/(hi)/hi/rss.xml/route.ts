import { latestStories } from "@/lib/db.ts";
import { rss, xml } from "@/lib/feeds.ts";

// made when asked for, kept ten minutes by the CDN (lib/feeds.ts xml)
export const dynamic = "force-dynamic";
export async function GET() {
  return xml(rss(await latestStories(120), "hi", "/hi/rss.xml"));
}
