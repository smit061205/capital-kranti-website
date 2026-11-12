// Renews the kept-ready pages, but only when the database changed since the
// last renewal (a publish, the hourly run's translations): safe to call by
// anyone, as it does nothing otherwise. The hourly run calls it when it's done.
// The pages of stories new or changed since the last renewal, each time; the pages that list stories at most every
// 20 minutes (7 Nov: every story of the last six hours and every list, up to eight times an hour, went past Vercel's free
// 200,000 "ISR writes" a month): lib/renew.ts.
import { db } from "../../../lib/db.ts";
import { HUB, INDEXNOW_KEY } from "../../../lib/feeds.ts";
import { INDEXABLE, SITE_URL } from "../../../lib/site.ts";
import { listPaths, renew, storyPaths } from "../../../lib/renew.ts";
import { prepared } from "../../../lib/write.ts";

export const dynamic = "force-dynamic";

const LISTS_EVERY = 20 * 60_000;

export async function POST() {
  const sql = db();
  if (!sql) return Response.json({ error: "no database" }, { status: 500 });
  await prepared(sql);
  const rows = await sql.query(`select key, value from state where key in ('content_changed_at', 'refreshed_at', 'lists_refreshed_at')`);
  const at = Object.fromEntries(rows.map((r) => [r.key as string, Date.parse(r.value as string)]));
  const changed = at.content_changed_at;
  // the lists still to renew when a change came after their last renewal (held back by the 20 minutes)
  const listsDue = !!changed && !(at.lists_refreshed_at >= changed);
  if (!changed || (at.refreshed_at >= changed && !listsDue)) return Response.json({ refreshed: false });
  const now = Date.now();
  await sql.query(`insert into state (key, value) values ('refreshed_at', $1) on conflict (key) do update set value = excluded.value`, [new Date(now).toISOString()]);
  const lists = listsDue && !(now - at.lists_refreshed_at < LISTS_EVERY);
  if (lists) await sql.query(`insert into state (key, value) values ('lists_refreshed_at', $1) on conflict (key) do update set value = excluded.value`, [new Date(now).toISOString()]);
  // the busy pages and the stories are marked stale, the quieter lists made again for their next reader (lib/renew.ts)
  const since = new Date(Number.isFinite(at.refreshed_at) ? at.refreshed_at : now - 6 * 3600_000).toISOString();
  const recent = await sql.query(`select id, status, en_status, hi_status, published_at > now() - interval '2 hours' as fresh from stories
    where published_at > $1 or updated_at > $1 order by published_at desc limit 120`, [since]);
  renew([...(lists ? listPaths() : []), ...recent.flatMap((r) => storyPaths(r.id as string))]);
  const told = await tellSearch(recent.filter((r) => r.fresh && r.status === "published"));
  return Response.json({ refreshed: true, lists, stories: recent.length, told });
}

/** The search engines and feed readers that listen are told of the new stories at once (13 Nov): IndexNow carries each
 *  new page's address, in the languages it is written in, to Bing, Yandex and those they feed; the feeds' hub (WebSub)
 *  tells whoever follows a feed that it has changed. Google takes neither: it reads the news sitemap. Free, and a
 *  failure here never holds the renewal up. */
async function tellSearch(fresh: Record<string, unknown>[]): Promise<number> {
  if (!INDEXABLE || !fresh.length) return 0;
  const urls = fresh.flatMap((r) => [`${SITE_URL}/news/${r.id}`, ...(r.en_status === "done" ? [`${SITE_URL}/en/news/${r.id}`] : []),
                                     ...(r.hi_status === "done" ? [`${SITE_URL}/hi/news/${r.id}`] : [])]);
  const host = new URL(SITE_URL).host;
  await Promise.all([
    fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls }) }).catch(() => null),
    fetch(HUB, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(8000),
      body: new URLSearchParams([["hub.mode", "publish"], ...["/rss.xml", "/en/rss.xml", "/hi/rss.xml"].map((p) => ["hub.url", `${SITE_URL}${p}`])]) }).catch(() => null),
  ]);
  return urls.length;
}
