// A section's Instagram cards to look at (lib/insta.ts): the latest set made for it, or one from its stories now that
// have a big enough photo of their own (the engine also finds file photos: engine/insta.ts). `?small` shows them at a quarter.
import { db, storiesIn } from "@/lib/db.ts";
import { cardsHtml, editionNow, MAX_STORIES, MIN_WIDTH, recentSets, type Card } from "@/lib/insta.ts";
import { TIERS } from "@/lib/sections.ts";
import type { Tier } from "@/lib/types.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tier: string }> }) {
  const tier = (await params).tier as Tier;
  if (!TIERS.includes(tier)) return new Response("not found", { status: 404 });
  const small = new URL(req.url).searchParams.has("small");
  const sql = db();
  const made = sql ? (await recentSets(sql, 30)).find((s) => s.tier === tier && s.cards.length) : undefined;
  const t = new Date(Date.now() + 5.5 * 3600_000);
  const set = made ?? {
    tier, edition: editionNow() ?? `${t.toISOString().slice(0, 10)}-${t.getUTCHours() < 13 ? "am" : "pm"}`,
    cards: (await storiesIn(tier, 80)).filter((s) => s.photo && s.photo.width >= MIN_WIDTH).slice(0, MAX_STORIES)
      .map((s): Card => ({ storyId: s.id, headline: s.headline, pick: 0, options: [{ ...s.photo!, representative: !!s.photo!.credit }] })),
  };
  if (!set.cards.length) return new Response("no cards for this section yet", { status: 404 });
  return new Response(cardsHtml(set, small), { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}
