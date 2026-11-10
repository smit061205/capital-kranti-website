// Renews the kept-ready pages, but only when the database changed since the
// last renewal (a publish, the hourly run's translations): safe to call by
// anyone, as it does nothing otherwise. The hourly run calls it when it's done.
// The pages of stories new or changed since the last renewal, each time; the pages that list stories at most every
// 20 minutes (7 Nov: every story of the last six hours and every list, up to eight times an hour, went past Vercel's free
// 200,000 "ISR writes" a month): lib/renew.ts.
import { db } from "../../../lib/db.ts";
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
  const recent = await sql.query(`select id from stories where published_at > $1 or updated_at > $1 order by published_at desc limit 120`, [since]);
  renew([...(lists ? listPaths() : []), ...recent.flatMap((r) => storyPaths(r.id as string))]);
  return Response.json({ refreshed: true, lists, stories: recent.length });
}
