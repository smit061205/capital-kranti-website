import { storiesIn } from "@/lib/db.ts";
import { rss, xml } from "@/lib/feeds.ts";
import { PAPER } from "@/lib/site.ts";
import { isSection, sectionName } from "@/lib/sections.ts";

// made when asked for, kept ten minutes by the CDN (lib/feeds.ts xml)
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ key: string }> }) {
  const key = (await params).key;
  if (!isSection(key)) return new Response("not found", { status: 404 });
  return xml(rss(await storiesIn(key, 100), "gu", `/section/${key}/rss.xml`, `${PAPER.gu.name}: ${sectionName(key, "gu")}`));
}
