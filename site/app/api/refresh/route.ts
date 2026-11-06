// Renews the kept-ready pages, but only when the database changed since the
// last renewal (a publish, the hourly run's translations): safe to call by
// anyone, as it does nothing otherwise. The hourly run calls it when it's done.
// Only the pages that list stories, and the pages of stories new or changed in the last six hours (their translations,
// photos and checks come then): lib/renew.ts.
import { db } from "../../../lib/db.ts";
import { listPaths, renew, storyPaths } from "../../../lib/renew.ts";
import { prepared } from "../../../lib/write.ts";

export const dynamic = "force-dynamic";

export async function POST() {
  const sql = db();
  if (!sql) return Response.json({ error: "no database" }, { status: 500 });
  await prepared(sql);
  const rows = await sql.query(`select key, value from state where key in ('content_changed_at', 'refreshed_at')`);
  const at = Object.fromEntries(rows.map((r) => [r.key as string, Date.parse(r.value as string)]));
  if (!at.content_changed_at || (at.refreshed_at && at.refreshed_at >= at.content_changed_at)) return Response.json({ refreshed: false });
  await sql.query(`insert into state (key, value) values ('refreshed_at', now()::text) on conflict (key) do update set value = excluded.value`);
  // marked stale rather than expired: readers get the kept page at once while the new one is made behind them (29 Oct:
  // expired pages kept the first reader after each renewal waiting 3 seconds or more while the page was made)
  const recent = await sql.query(`select id from stories where published_at > now() - interval '6 hours' or updated_at > now() - interval '6 hours'
    order by published_at desc limit 120`);
  renew([...listPaths(), ...recent.flatMap((r) => storyPaths(r.id as string))]);
  return Response.json({ refreshed: true, stories: recent.length });
}
