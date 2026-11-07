// The day's news for the printed paper (the newsroom app reads it at paper time, 7 Nov): the
// stories this site published that day, whole, and Aavtikal's recent articles, for a thin day's
// space. Only what passed the site's check, never the paper's own stories back (origin 'paper').
// A photo only when it is the government's own (shown through /official): a file or stock photo
// isn't the paper's to print. All of it is on the site already; nothing here is private.
import { db } from "@/lib/db.ts";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const date = DAY.test(u.searchParams.get("date") ?? "") ? u.searchParams.get("date")! : today;
  const sql = db();
  if (!sql) return Response.json({ error: "no database" }, { status: 500 });
  const [stories, features] = await Promise.all([
    sql.query(`select id, tier, kicker, headline, deck, body, caption, photo, source, sources, importance, published_at
                 from stories where issue_date = $1::date and status = 'published' and origin <> 'paper' and checked
                 order by importance desc nulls last, published_at desc limit 80`, [date]),
    sql.query(`select id, beat, headline, dek, body, published_at from features
                 where status = 'published' and published_at > $1::date - 30 and published_at < $1::date + 1
                 order by published_at desc limit 20`, [date]),
  ]);
  const official = (p: unknown) => {
    const photo = p as { url?: string; width?: number; height?: number; credit?: string } | null;
    return photo?.url?.startsWith("/official/") && !photo.credit ? { url: photo.url, width: photo.width, height: photo.height } : null;
  };
  return Response.json({
    date,
    stories: stories.map((r) => ({
      id: r.id, tier: r.tier, kicker: r.kicker, headline: r.headline, deck: r.deck, body: r.body, caption: r.caption,
      photo: official(r.photo), source: r.source ?? null, sources: r.sources ?? [], importance: r.importance ?? null,
      publishedAt: new Date(r.published_at as string).toISOString(),
    })),
    features: features.map((r) => ({
      id: r.id, beat: r.beat, headline: r.headline, deck: r.dek, body: r.body,
      publishedAt: new Date(r.published_at as string).toISOString(),
    })),
  }, { headers: { "cache-control": "no-store" } });
}
