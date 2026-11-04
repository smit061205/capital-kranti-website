// How the website is doing, in public figures only: the hourly runs (how late
// GitHub started them, whether the sources answered), today's use of the free
// plans' ceilings, and the stories waiting for their English.
import { db } from "@/lib/db.ts";
import { engineRounds } from "@/lib/editor.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = db();
  if (!sql) return Response.json({ error: "no database" }, { status: 500 });
  const [runs, usage, waiting, counts] = await Promise.all([
    sql.query(`select id, kind, scheduled_for, started_at, finished_at, ok, details from runs order by id desc limit 24`).catch(() => []),
    sql.query(`select day::text, kind, n from usage where day > (now() at time zone 'Asia/Kolkata')::date - 7 order by day desc, kind`).catch(() => []),
    sql.query(`select en_status, tag_status, count(*)::int as n from stories group by 1, 2`).catch(() => []),
    sql.query(`select (select count(*) from stories)::int as stories, (select count(*) from issues)::int as issues`).catch(() => [{}]),
  ]);
  // Aavtikal's desk: its last rounds (what it did, step by step) and the published articles' state, all public
  // (headlines and links are on the site already); held articles only counted
  const [deskRuns, arts, held, redone] = await Promise.all([
    sql.query(`select id, started_at, finished_at, ok, details from runs where kind = 'desk' order by id desc limit 4`).catch(() => []),
    sql.query(`select id, beat, author, en is not null and en->>'headline' <> '' and concat_ws(' ', en->>'headline', en->>'body') !~ '[\u0980-\u0DFF]' as en,
       hi is not null and (hi->>'headline') ~ '[\u0900-\u097F]' and concat_ws(' ', hi->>'headline', hi->>'body') !~ '[\u0980-\u0DFF]' as hi, photo is not null as photo, checks->>'cover' as cover, jsonb_array_length(figures)::int as figures,
                 coalesce((checks->>'rewritten')::boolean, false) as rewritten, (checks->>'words')::int as words, published_at, updated_at
               from features where status = 'published' order by published_at desc limit 60`).catch(() => []),
    sql.query(`select count(*)::int as n from features where status = 'held'`).catch(() => [{ n: null }]),
    sql.query(`select value from state where key = 'desk_redone_3'`).catch(() => []),
  ]);
  // where each day's news went, in counts only: how many reports came in and were sorted, and what became of the events
  const [itemsByDay, clustersByDay] = await Promise.all([
    sql.query(`select (seen_at at time zone 'Asia/Kolkata')::date::text as day, count(*)::int as items,
        count(*) filter (where source like 'pib%')::int as pib,
        count(*) filter (where triage is null)::int as unsorted,
        count(*) filter (where triage ? 'skipped')::int as skipped,
        count(*) filter (where (triage->>'score')::numeric < 3)::int as small,
        count(*) filter (where (triage->>'score')::numeric >= 5)::int as big
      from items where seen_at > now() - interval '6 days' group by 1 order by 1 desc`).catch(() => []),
    sql.query(`select (first_seen at time zone 'Asia/Kolkata')::date::text as day, state, left(split_part(coalesce(reason, ''), ' ', 1) || ' ' || split_part(coalesce(reason, ''), ' ', 2) || ' ' || split_part(coalesce(reason, ''), ' ', 3), 30) as why, count(*)::int as n
      from clusters where first_seen > now() - interval '6 days' group by 1, 2, 3 order by 1 desc, n desc`).catch(() => []),
  ]);
  // how long one small question to the database takes from where the site runs (30 Oct: pages not kept ready took seconds)
  const dbT = Date.now();
  await sql.query(`select 1`).catch(() => null);
  await sql.query(`select 1`).catch(() => null);
  const dbMs = Math.round((Date.now() - dbT) / 2);
  // which photo the site shows (4 Nov: no longer read from the photo store here: each look at this page cost two of the
  // store's 10,000 free reads a month, and the reads were on course to run out in two weeks)
  const [one] = await sql.query(`select photo->>'url' as url from stories where photo is not null limit 1`).catch(() => []);
  const photos = { key: !!process.env.BLOB_READ_WRITE_TOKEN, name: (one?.url as string | undefined)?.replace(/^\/media\//, "") ?? null };
  // the last day's news, judged (4 Nov, the plan's measures): stories each hour (India's time), how many have a photo,
  // how many are Gujarat's, and the minutes from the first report anywhere, and from our first sight of it, to our story
  const [quality, perHour] = await Promise.all([
    sql.query(`with s as (select s.published_at, s.tier, s.photo is not null as photo, c.first_seen,
                 (select min(coalesce(i.published_at, i.seen_at)) from items i where i.cluster_id = c.id) as first_report
               from stories s left join clusters c on c.story_id = s.id
              where s.origin = 'live' and s.status = 'published' and s.published_at > now() - interval '24 hours')
      select count(*)::int as stories, round(100.0 * avg(photo::int))::int as photo_pct, round(100.0 * avg((tier = 'gujarat')::int))::int as gujarat_pct,
        round(extract(epoch from percentile_cont(0.5) within group (order by published_at - first_report)) / 60)::int as minutes_from_report,
        round(extract(epoch from percentile_cont(0.5) within group (order by published_at - first_seen)) / 60)::int as minutes_from_seen
      from s`).catch((e) => [{ error: String(e) }]),
    sql.query(`select to_char(published_at at time zone 'Asia/Kolkata', 'DD HH24') as hour, count(*)::int as n from stories
      where origin = 'live' and status = 'published' and published_at > now() - interval '24 hours' group by 1 order by 1`).catch(() => []),
  ]);
  // the database questions that send the most rows, to cut what the database sends out (4 Nov: Neon's free 5 GB a month
  // ran out in four days); their wording is the code's own, with $1 for the values
  const heavy = async () => (await sql.query(`select calls::int, rows::bigint::text as rows, round(mean_exec_time)::int as ms, left(regexp_replace(query, '\\s+', ' ', 'g'), 160) as query
      from pg_stat_statements where dbid = (select oid from pg_database where datname = current_database()) order by rows desc limit 15`));
  const reads = await heavy().catch(async () => {
    await sql.query(`create extension if not exists pg_stat_statements`).catch(() => null);
    return heavy().catch((e) => String(e));
  });
  return Response.json({
    ...counts[0], photos, speed: { region: process.env.VERCEL_REGION ?? null, db_ms: dbMs },
    aavtikal: {
      held: held[0]?.n ?? null, tried_again: String(redone[0]?.value ?? "").split("\n").filter(Boolean),
      articles: arts,
      desk: deskRuns.map((r) => ({ id: r.id, started_at: r.started_at, finished_at: r.finished_at, ok: r.ok,
        counts: Object.fromEntries(Object.entries(r.details ?? {}).filter(([, v]) => typeof v === "number")), error: r.details?.error ?? null, log: r.details?.log ?? [] })),
    },
    last_day: { ...quality[0], per_hour: perHour },
    database_reads: reads,
    stories_by_state: waiting,
    news_by_day: { items: itemsByDay, events: clustersByDay },
    engine_rounds: await engineRounds(sql).catch((e) => String(e)),
    usage,
    runs: runs.map((r) => ({
      id: r.id, kind: r.kind, ok: r.ok, scheduled_for: r.scheduled_for, started_at: r.started_at, finished_at: r.finished_at,
      late_minutes: r.scheduled_for ? Math.round((Date.parse(r.started_at) - Date.parse(r.scheduled_for)) / 60000) : null,
      sources: (r.details?.sources ?? []).map((s: { name: string; status: number; items?: number; ms: number }) => ({ name: s.name, status: s.status, items: s.items, ms: s.ms })),
      stories: r.details?.stories ?? null, done: r.details?.done, error: r.details?.error,
      ...(r.kind === "engine" ? { steps: r.details?.steps ?? null, log: (r.details?.log ?? []).slice(-40) } : {}),
    })),
  }, { headers: { "cache-control": "no-store" } });
}
