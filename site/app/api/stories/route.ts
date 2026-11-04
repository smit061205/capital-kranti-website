// The reader's saved stories (the Saved page lists them from the browser): headline, photo, section and time.
import { db } from "@/lib/db.ts";
import { sample, sampleOn } from "@/lib/sample.ts";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ids = (u.searchParams.get("ids") ?? "").split(",").filter((x) => /^[a-z][a-z0-9-]{1,40}$/.test(x)).slice(0, 50);
  const lang = u.searchParams.get("lang");
  if (sampleOn()) return Response.json({ stories: ids.map((id) => sample().stories.find((x) => x.id === id)).filter((x) => !!x)
    .map((x) => ({ id: x.id, headline: x.headline, photo: x.photo, tier: x.tier, publishedAt: x.publishedAt })) });
  const sql = db();
  if (!sql || !ids.length) return Response.json({ stories: [] });
  const rows = await sql.query(`select id, headline, en, en_status, hi, hi_status, photo, tier, published_at from stories where id = any($1::text[]) and status = 'published'`, [ids]);
  const headline = (r: Record<string, unknown>) =>
    lang === "en" && r.en_status === "done" ? (r.en as { headline: string }).headline
      : lang === "hi" && r.hi_status === "done" ? (r.hi as { headline: string }).headline : (r.headline as string);
  const byId = new Map(rows.map((r) => [r.id as string, { id: r.id as string, headline: headline(r), photo: r.photo ?? null, tier: r.tier as string,
                                                          publishedAt: new Date(r.published_at as string).toISOString() }]));
  return Response.json({ stories: ids.filter((id) => byId.has(id)).map((id) => byId.get(id)) });
}
