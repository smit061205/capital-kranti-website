// The engine's run, every 15 minutes on GitHub (.github/workflows/site-engine.yml;
// ROADMAP §3, decided 25 Oct). In order, each step stopping in time for the next run:
//   0. messages to the Telegram bot since the last run (lib/telegram.ts);
//   1. every source asked what's new (collect.ts);
//   2. new items ranked and grouped into events (triage.ts);
//   3. each event's checks: fresh, not debunked, from a listed source (newsroom.ts gate);
//   4. the most important confirmed events written in Gujarati, checked claim by claim
//      by a second free model, English and Hindi added for national and world news;
//   5. live at once, with no one to approve it (the user, 30 Oct); a story that doesn't pass its checks doesn't go up;
//      no official photo: a free file photo of its subject from Wikimedia Commons (wikiphoto.ts);
//   8. the last day and a half's stories still without a photo: the same, once each;
//   9. published stories watched for 24 hours: a source correcting or withdrawing takes them down.
// Free models only: the day's allowance is spent on the most important events first.
// Run: node --experimental-strip-types site/engine/run.ts   (DATABASE_URL, OPENROUTER_API_KEY;
//      BLOB_READ_WRITE_TOKEN for photos; TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS for notes to the editor)
import { neon } from "@neondatabase/serverless";
import { WEBSITE } from "../lib/config.ts";
import { ensureSchema } from "../lib/schema.ts";
import { pollUpdates, tell } from "../lib/telegram.ts";
import { touched } from "../lib/write.ts";
import { aiLeft, aiUsed, freeModels, groqModels } from "./ai.ts";
import { collect } from "./collect.ts";
import { STALE_H, STRAY, gate, gather, importance, levelOf, mendLetters, needsTranslation, thin, translate, writeChecked, type ClusterItem, type Debunk } from "./newsroom.ts";
import { indiaDate, photoOf, saveLive } from "./publish.ts";
import { alertBreaking } from "../lib/push.ts";
import { birthdays, leaders } from "../lib/leaders.ts";
import { background, fitsStory, freePhoto, leadPhoto } from "./wikiphoto.ts";
import { cluster, nearEvent, placeTier, sameEvent, triage, type Triage } from "./triage.ts";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set (a repository secret)"); process.exit(1); }
const sql = neon(url);
const started = Date.now();
/** the round's log, kept with the round (India's time) so the status page shows what a slow round was doing */
const lines: string[] = [];
const log = (s: string) => {
  console.log(s);
  lines.push(`${new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} ${s}`.slice(0, 300));
  if (lines.length > 80) lines.shift();
};
/** no story begun after this, so the round ends before the next starts (29 Oct: a story begun at 11 minutes ran past the
 *  13-minute limit and a third of the rounds were cut off unfinished; 4 Nov: at 8 minutes, the free models' allowance for
 *  the minutes until the next round went unused, so the writing goes on to 9, the round's last steps to 12; at 10½ a story
 *  written by a Gemma, minutes each at night, ran past the 13-minute stop) */
const deadline = started + 9 * 60_000;
/** the round's last steps (photos, translations) begin nothing after this */
const finish = started + 12 * 60_000;
/** free requests kept back each day for the hourly run's English (site/pipeline/run.ts) */
const RESERVE = 120;
/** at most this many stories written in one run (each takes ~3-5 requests) */
const PER_RUN = 12;
/** stories written side by side */
const WRITERS = 3;

const CORRECTION = /\b(corrigendum|correction|corrected|withdrawn|retracted|clarification|erratum)\b|સુધારો|સ્પષ્ટતા|शुद्धिपत्र|संशोधन|स्पष्टीकरण/i;

const ITEM = `id, cluster_id, source, url, title, summary, lang, published_at, seen_at, image, triage`;
const itemOf = (r: Record<string, unknown>): ClusterItem => ({ id: r.id as string, source: r.source as string, url: r.url as string, title: r.title as string,
  summary: r.summary as string, lang: r.lang as ClusterItem["lang"], publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
  seenAt: new Date(r.seen_at as string).toISOString(), image: r.image as string | null, triage: r.triage as Triage });

async function itemsOf(clusterId: string): Promise<ClusterItem[]> {
  return (await sql.query(`select ${ITEM} from items where cluster_id = $1 order by seen_at`, [clusterId])).map(itemOf);
}

async function debunks(): Promise<Debunk[]> {
  const rows = await sql.query(
    `select source, url, triage from items where cluster_id = 'factcheck' and seen_at > now() - interval '30 days' and coalesce(triage->>'debunk', '') <> ''`);
  return rows.map((r) => ({ claim: (r.triage as Triage).debunk!, keys: (r.triage as Triage).keys, url: r.url, source: r.source }));
}

/** Step 3: every open event through the checks before writing. */
async function advance() {
  // confirmed ones too, however old: one that went stale before its turn to be written leaves the list here, whatever the
  // writing pass had time for (31 Oct: a story failing its checks took the whole pass and nothing old was cleared)
  const open = await sql.query(`select id, first_seen, state, reason from clusters where state = 'confirmed' or (state in ('new', 'waiting') and updated_at > now() - interval '48 hours')`);
  // every event's reports in one question, and saved only when something changed (31 Oct: one question each, for some 270
  // events, took up to three minutes of the round, time the writing needs)
  // and only what the checks read (4 Nov: every report's text and sorting, for some 1,200 events each round, was most of
  // what the database sent out, and Neon's free 5 GB a month ran out in four days): the source, the times, the keywords;
  // a report too old to count isn't sent at all (the checks leave it out anyway)
  const items = new Map<string, ClusterItem[]>();
  const light = await sql.query(
    `select cluster_id, source, published_at, seen_at, triage->'keys' as keys from items
      where cluster_id = any($1) and coalesce(published_at, seen_at) > now() - make_interval(hours => $2)`, [open.map((c) => c.id), STALE_H]);
  for (const r of light) {
    const it: ClusterItem = { id: "", source: r.source, url: "", title: "", summary: "", lang: "en", image: null,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null, seenAt: new Date(r.seen_at).toISOString(),
      triage: { keys: (r.keys ?? []) as string[] } as Triage };
    items.set(r.cluster_id as string, [...(items.get(r.cluster_id as string) ?? []), it]);
  }
  const known = await debunks();
  const tally: Record<string, number> = {};
  for (const c of open) {
    const g = gate(items.get(c.id) ?? [], known);
    tally[g.state] = (tally[g.state] ?? 0) + 1;
    if (g.state === c.state && g.why === c.reason) continue;
    await sql.query(`update clusters set state = $2, reason = $3 where id = $1`, [c.id, g.state, g.why]);
    if (g.state === "blocked") await tell(`🚫 <b>ફેક્ટ-ચેક:</b> ${g.why}`);
  }
  log(`  checks: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing open"}`);
}

/** stories written this round, across its two writing passes */
let wrote = 0;
/** the events being written right now, so two writers don't take one event told two ways at once */
const writing: { event: string; keys: string[] }[] = [];

/** Steps 4 and 5: the most important confirmed events, written, checked, translated, saved, WRITERS at a time (4 Nov: one
 *  at a time, a round wrote two or three stories while hundreds waited); no story is begun after `until`. */
async function write(until = deadline) {
  const left = await aiLeft(sql);
  const can = Math.min(PER_RUN, Math.floor((left - RESERVE) / 5));
  if (can <= 0) { log(`  writing: waits (${left} free requests left today)`); return; }
  // today's news first: a day-old event goes after anything newer, however big it scored
  const ready = await sql.query(`select id, event, keys, tier, genres, sensitive, score, first_seen, write_tries from clusters where state = 'confirmed'
    order by write_tries, first_seen > now() - interval '12 hours' desc, score desc, first_seen asc limit ${PER_RUN * 8}`);
  let next = 0, stopped = false;
  const writer = async () => {
    while (!stopped && wrote < can && Date.now() <= until && next < ready.length) {
      const c = ready[next++];
      const mine = { event: c.event as string, keys: (c.keys ?? []) as string[] };
      // another writer has its twin: it waits for the next pass, when the twin is up and sameEvent finds it
      if (writing.some((x) => nearEvent(x, mine))) continue;
      writing.push(mine);
      try {
        const r = await writeOne(c);
        if (r === "stop") stopped = true;
        if (r === "busy") return;
      } finally { writing.splice(writing.indexOf(mine), 1); }
    }
  };
  await Promise.all(Array.from({ length: WRITERS }, writer));
}

/** The reports of the last two days filed under another event that's this one told another way (nearEvent), not yet up. */
async function nearReports(c: Record<string, any>): Promise<ClusterItem[]> {
  const mine = { event: c.event as string, keys: (c.keys ?? []) as string[] };
  const near = (await sql.query(
    `select id, event, keys from clusters where id <> $1 and keys && $2::text[] and updated_at > now() - interval '48 hours'
       and state in ('new', 'waiting', 'confirmed', 'dropped') limit 60`, [c.id, mine.keys]))
    .filter((r) => nearEvent(mine, { event: r.event, keys: r.keys ?? [] }));
  if (!near.length) return [];
  return (await sql.query(`select ${ITEM} from items where cluster_id = any($1) and coalesce(published_at, seen_at) > now() - interval '48 hours'
    order by seen_at limit 8`, [near.map((r) => r.id)])).map(itemOf);
}

/** One confirmed event: settled, joined to its twin, or written and put up. */
async function writeOne(c: Record<string, any>): Promise<"stop" | "busy" | void> {
  const items = await itemsOf(c.id);
  const g = gate(items, []);
  // gone stale while it waited: settled here, or it keeps its place at the top of the list and nothing newer is reached
  // (31 Oct: 29 Oct's biggest events held all 40 places and the site went almost quiet)
  if (g.state !== "confirmed") { await sql.query(`update clusters set state = $2, reason = $3 where id = $1`, [c.id, g.state, g.why]); return; }
  const imp = importance(Math.max(...items.map((i) => i.triage.score)), c.tier, g.groups.length, g.official);
  const level = levelOf(imp);
  if (!level) { await sql.query(`update clusters set state = 'dropped', reason = 'too small for a story' where id = $1`, [c.id]); return; }
  const twin = await sameEvent(sql, { id: c.id, event: c.event, keys: c.keys ?? [] });
  // not known whether it's already up: it waits for a later round
  if (twin === "unsure") { log(`    the free models couldn't say whether it's already up: next run: ${c.event}`); return; }
  if (twin) {
    // its reports join the story already up (the watch step reads them for changes) instead of a second story
    await sql.query(`update items set cluster_id = $2 where cluster_id = $1`, [c.id, twin.id]);
    await sql.query(`update clusters set state = 'dropped', reason = $2 where id = $1`, [c.id, `same event as ${twin.story}`]);
    log(`    same event as ${twin.story}: ${c.event}`);
    return;
  }
  let src = await gather(items);
  // only a few lines to write from: the other reports of the same event, filed apart, then Wikipedia's lines on its subject
  // for a paragraph of background (4 Nov: a story from a feed's three lines came out two short paragraphs)
  if (thin(level, src)) {
    const more = await nearReports(c);
    if (more.length) src = await gather([...items, ...more]);
    if (thin(level, src) && !c.sensitive) {
      const bg = await background(sql, c.event, items.map((i) => `${i.title}. ${i.summary}`).join("\n").slice(0, 1500)).catch(() => null);
      if (bg) src = [...src, bg];
    }
    log(`    few lines to write from: ${more.length} report(s) of the same event filed apart${src.some((s) => s.background) ? ", Wikipedia's background" : ""}`);
  }
  if (!src.length) { await sql.query(`update clusters set state = 'dropped', reason = 'no source text to write from' where id = $1`, [c.id]); return; }
  log(`  writing ${c.id} (${level}, ${imp}): ${c.event}`);
  const res = await writeChecked(sql, src, level, indiaDate(), c.event);
  wrote++;
  // not written, or written and still failing its checks: it doesn't go up, and it's tried again up to three times
  if (!res.ok) {
    log(`    not written${"retry" in res && res.retry ? " (the free models are busy: next run)" : ""}: ${res.why}`);
    if (res.stop) return "stop";
    if ("retry" in res && res.retry) return "busy";
    // 29 Oct: a gold-price story the models kept getting wrong took four minutes of every round
    await sql.query(`update clusters set write_tries = write_tries + 1,
       state = case when write_tries >= 2 then 'dropped' else state end,
       reason = case when write_tries >= 2 then 'not written in 3 tries' else reason end where id = $1`, [c.id]);
    return;
  }
  let w = res.written;
  const checked = res.checked;
  const id = `live-${c.id.slice(1)}`;
  // past the round's time: the story goes up now and its English and Hindi come with a later round (translations())
  const translated = needsTranslation(c.tier) && Date.now() < deadline;
  // both at once: neither needs the other's answer
  let [en, hi] = translated ? await Promise.all([translate(sql, w, "en", indiaDate()), translate(sql, w, "hi", indiaDate())]) : [null, null];
  let photo = await photoOf(sql, src, id);
  // why it has none, for the status page (4 Nov: four stories in five went up without a photo, and no one knew why)
  let photoWhy: string | null = photo ? null : src.some((s) => s.official && s.image) ? "the official photo couldn't be kept (too small, or the day's 50 uploads used)" : null;
  let fitted = false;
  // no official photo: a file photo or a symbolic one (wikiphoto.ts freePhoto; not for sensitive news)
  if (!photo && c.sensitive) photoWhy = "sensitive news: no file or symbolic photo";
  if (!photo && !c.sensitive) {
    const free = await freePhoto(sql, w, id, (why) => { photoWhy = why; });
    if (free) {
      photo = free.photo;
      photoWhy = null;
      fitted = true;
      w = { ...w, caption: free.caption.gu };
      if (en) en = { ...en, caption: free.caption.en };
      if (hi) hi = { ...hi, caption: free.caption.hi };
      log(`    photo: ${free.caption.en} (${free.photo.credit})`);
    }
  }
  if (!photo && !photoWhy) photoWhy = "no official photo";
  await saveLive(sql, { id, tier: c.tier, genres: c.genres, written: w, checked, src, importance: imp, status: "published",
                        holdReason: null, en, hi, translated, photo });
  // a photo checked against the story already isn't checked again (photoFit)
  await sql.query(`update stories set photo_tried = true, photo_why = $2, checks = case when $3 then coalesce(checks, '{}'::jsonb) || '{"photo_fit": true}' else checks end where id = $1`,
    [id, photoWhy, fitted]);
  await sql.query(`update clusters set state = $2, story_id = $3, reason = $4 where id = $1`, [c.id, "published", id, null]);
  await touched(sql);
  log(`    published${checked.cut ? ` (${checked.cut} unsupported line(s) cut)` : ""}: ${w.headline}`);
  // breaking news: an alert to the phones that asked (lib/push.ts)
  await alertBreaking(sql, { id, importance: imp, publishedAt: new Date().toISOString(), headline: { gu: w.headline, en: en?.headline ?? null, hi: hi?.headline ?? null } }, log)
    .catch((e) => log(`    no alert: ${e instanceof Error ? e.message : e}`));
}

/** Step 8: the last day and a half's stories that went up without a photo get a file photo,
 *  the most important first, each looked for once (engine/wikiphoto.ts). */
async function photos() {
  // once: the stories looked for before the lookup read Wikipedia's resized-copy addresses
  // and India's open licence (29 Oct) are looked for again
  // and again on 4 Nov, when file photos of things and places and symbolic photos came in (wikiphoto.ts freePhoto)
  const [again] = await sql.query(`select value from state where key = 'photo_retry_2'`);
  if (!again) {
    await sql.query(`update stories set photo_tried = false where origin = 'live' and photo is null and published_at > now() - interval '36 hours'`);
    await sql.query(`insert into state (key, value) values ('photo_retry_2', '1') on conflict (key) do nothing`);
  }
  const rows = await sql.query(
    `select s.id, s.kicker, s.headline, s.deck, s.body from stories s left join clusters c on c.story_id = s.id
      where s.origin = 'live' and s.status = 'published' and s.photo is null and not s.photo_tried and not coalesce(c.sensitive, false)
       and s.published_at > now() - interval '36 hours' order by s.importance desc nulls last, s.published_at desc limit 8`);
  let added = 0;
  for (const r of rows) {
    if (Date.now() > finish) break;
    let why: string | null = null;
    const free = await freePhoto(sql, { kicker: r.kicker, headline: r.headline, deck: r.deck, body: r.body, caption: "", model: "" }, r.id, (x) => { why = x; });
    await sql.query(
      `update stories set photo_tried = true, photo = coalesce($2::jsonb, photo), caption = coalesce($3, caption), photo_why = $6,
          checks = case when $2::jsonb is not null then coalesce(checks, '{}'::jsonb) || '{"photo_fit": true}' else checks end,
          en = case when en is not null and $4::text is not null then jsonb_set(en, '{caption}', to_jsonb($4::text)) else en end,
          hi = case when hi is not null and $5::text is not null then jsonb_set(hi, '{caption}', to_jsonb($5::text)) else hi end,
          updated_at = case when $2::jsonb is not null then now() else updated_at end
        where id = $1`,
      [r.id, free ? JSON.stringify(free.photo) : null, free?.caption.gu ?? null, free?.caption.en ?? null, free?.caption.hi ?? null, free ? null : why]);
    if (free) { added++; log(`    ${r.id}: photo, ${free.caption.en} (${free.photo.credit})`); }
  }
  if (added) await touched(sql);
  return added;
}

/** The last three days' file photos (Wikimedia Commons) checked against their stories, a few each run, early in the round:
 *  one that doesn't suit its story comes off (2 Nov: a fruit market in Hodeidah beside a strike on its port; the check
 *  is made before a photo goes up from now on, wikiphoto.ts). Each story's answer is kept in its checks. */
async function photoFit(until: number) {
  const rows = await sql.query(
    `select id, headline, deck, en->>'headline' as en_head, en->>'deck' as en_deck, en->>'caption' as en_cap from stories
      where origin = 'live' and status = 'published' and photo->>'credit' like '%Wikimedia Commons%' and checks->>'photo_fit' is null
        and published_at > now() - interval '3 days' order by published_at desc limit 8`);
  let off = 0;
  for (const r of rows) {
    if (Date.now() > until) break;
    const subject = String(r.en_cap ?? "").replace(/^File photo:\s*/i, "").trim();
    if (!subject) { await sql.query(`update stories set checks = coalesce(checks, '{}'::jsonb) || '{"photo_fit": "unknown"}' where id = $1`, [r.id]); continue; }
    const found = await leadPhoto(subject).catch(() => null);
    const fits = await fitsStory(sql, { headline: r.en_head || r.headline, deck: r.en_deck || r.deck }, subject, found?.about ?? "");
    if (fits === null) { log(`    ${r.id}: photo not checked, the free models are busy (next run)`); break; }
    await sql.query(
      `update stories set checks = coalesce(checks, '{}'::jsonb) || jsonb_build_object('photo_fit', $2::boolean),
          photo = case when $2 then photo else null end, caption = case when $2 then caption else '' end,
          en = case when $2 or en is null then en else jsonb_set(en, '{caption}', '""') end,
          hi = case when $2 or hi is null then hi else jsonb_set(hi, '{caption}', '""') end,
          photo_tried = true, updated_at = case when $2 then updated_at else now() end
        where id = $1`, [r.id, fits]);
    if (!fits) off++;
    log(`    ${r.id}: file photo ${fits ? "suits the story" : "taken off, it doesn't suit the story"} (${subject})`);
  }
  if (off) await touched(sql);
  return off;
}

/** Once (30 Oct, approvals removed): what was waiting for the editor is settled. Stories held only for being sensitive go up
 *  at their own time; anything that failed a check, or that a source corrected, goes to the removed list, where the editor
 *  can put it back. Articles waiting for a real picture stay: they come back by themselves. */
async function settleWaiting() {
  const [done] = await sql.query(`select value from state where key = 'no_approval_once'`);
  if (done) return;
  const up = await sql.query(
    `update stories set status = 'published', hold_reason = null, updated_at = now()
      where status = 'held' and hold_reason = 'સંવેદનશીલ સમાચાર' and jsonb_array_length(coalesce(checks->'problems', '[]')) = 0 returning id`);
  if (up.length) await sql.query(`update clusters set state = 'published', reason = null where story_id = any($1)`, [up.map((r) => r.id)]);
  const off = await sql.query(`update stories set status = 'withdrawn', updated_at = now() where status = 'held' returning id`);
  const arts = await sql.query(
    `update features set status = 'withdrawn', updated_at = now() where status = 'draft' or (status = 'held' and coalesce(checks->>'held_for', '') <> 'picture') returning id`);
  await sql.query(`insert into state (key, value) values ('no_approval_once', '1') on conflict (key) do nothing`);
  log(`waiting stories settled: ${up.length} up, ${off.length} removed; ${arts.length} waiting articles removed`);
  if (up.length) await touched(sql);
}

/** Once (29 Oct, and again 2 Nov with the wider check in sameEvent and the reports' headlines): a story that went up twice (Spain's train crash, the
 *  Asia Cup squad) keeps its first copy; the later one comes down. Early in the round, with a minute and a half of its own
 *  (run last, it began after the round's time and stopped at once). */
async function dedupe(until = deadline) {
  const [done] = await sql.query(`select value from state where key = 'dedupe_4'`);
  if (done) return 0;
  const rows = await sql.query(
    `select c.id, c.event, c.keys, c.first_seen, c.story_id from clusters c join stories s on s.id = c.story_id
      where s.status = 'published' and s.origin = 'live' and c.first_seen > now() - interval '48 hours' order by c.first_seen desc limit 40`);
  let removed = 0, unsure = 0;
  for (const r of rows) {
    if (Date.now() > until) { log(`  copies: out of time, ${removed} taken down, the rest next run`); return removed; }
    const twin = await sameEvent(sql, { id: r.id, event: r.event, keys: r.keys ?? [], before: new Date(r.first_seen).toISOString() });
    if (twin === "unsure") unsure++;
    if (!twin || twin === "unsure") continue;
    await sql.query(`update stories set status = 'withdrawn', hold_reason = $2, updated_at = now() where id = $1 and status = 'published'`,
      [r.story_id, `the same event as ${twin.story}`]);
    await sql.query(`update items set cluster_id = $2 where cluster_id = $1`, [r.id, twin.id]);
    await sql.query(`update clusters set state = 'dropped', reason = $2 where id = $1`, [r.id, `same event as ${twin.story}`]);
    removed++;
    log(`    a second copy taken down: ${r.story_id} (the same event as ${twin.story})`);
  }
  log(`  copies: ${rows.length} looked at, ${removed} taken down${unsure ? `, ${unsure} not answered (next run)` : ""}`);
  // done for good only when every one was answered
  if (!unsure) await sql.query(`insert into state (key, value) values ('dedupe_4', '1') on conflict (key) do nothing`);
  if (removed) await touched(sql);
  return removed;
}

/** Once (4 Nov): the last three days' stories with Russian, Greek, Arabic, Thai or East Asian letters in them, which the
 *  check didn't look for ("виста́р" in a headline), put into Gujarati letters and translated again; one that can't be
 *  mended comes down. */
async function mendPublished() {
  const [done] = await sql.query(`select value from state where key = 'mend_scripts_1'`);
  if (done) return 0;
  const rows = await sql.query(
    `select id, kicker, headline, deck, body, caption from stories where origin = 'live' and status = 'published' and published_at > now() - interval '3 days'
        and concat_ws(' ', kicker, headline, deck, body, caption) ~ '[\u0300-\u036F\u0370-\u03FF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]'`);
  let mended = 0, left = 0;
  for (const r of rows) {
    const w = await mendLetters(sql, { kicker: r.kicker, headline: r.headline, deck: r.deck, body: r.body, caption: r.caption, model: "" });
    const same = w.headline === r.headline && w.deck === r.deck && w.body === r.body && w.kicker === r.kicker && w.caption === r.caption;
    // no model answered: tried again next round
    if (same) { left++; continue; }
    if ([w.kicker, w.headline, w.deck, w.body, w.caption].some((x) => STRAY.test(x))) {
      await sql.query(`update stories set status = 'withdrawn', hold_reason = 'letters from another script', updated_at = now() where id = $1`, [r.id]);
      log(`    taken down, letters from another script: ${r.headline}`);
      continue;
    }
    await sql.query(`update stories set kicker = $2, headline = $3, deck = $4, body = $5, caption = $6, en_status = 'pending', hi_status = 'none',
        translate_fails = 0, updated_at = now() where id = $1`, [r.id, w.kicker, w.headline, w.deck, w.body, w.caption]);
    mended++;
    log(`    letters mended: ${w.headline}`);
  }
  if (!left) await sql.query(`insert into state (key, value) values ('mend_scripts_1', '1') on conflict (key) do nothing`);
  if (rows.length) await touched(sql);
  return mended;
}

/** Once (29 Oct): events filed under Gujarat whose sources are about somewhere else (Mumbai's airport)
 *  move to India, with their stories. (The first pass, 'tier_refile', read the model's own keywords.) */
async function refile() {
  const [done] = await sql.query(`select value from state where key = 'tier_refile_2'`);
  if (done) return 0;
  const rows = await sql.query(
    `select c.id, c.event, c.story_id, string_agg(i.title || ' ' || i.summary, ' ') as words
       from clusters c join items i on i.cluster_id = c.id
      where c.tier = 'gujarat' and c.first_seen > now() - interval '7 days' group by c.id, c.event, c.story_id`);
  let moved = 0;
  for (const r of rows) {
    if (placeTier("gujarat", r.words ?? "") === "gujarat") continue;
    await sql.query(`update clusters set tier = 'india' where id = $1`, [r.id]);
    if (r.story_id) await sql.query(`update stories set tier = 'india', updated_at = now() where id = $1 and tier = 'gujarat'`, [r.story_id]);
    moved++;
    log(`    to India: ${r.event}`);
  }
  await sql.query(`insert into state (key, value) values ('tier_refile_2', '1') on conflict (key) do nothing`);
  if (moved) await touched(sql);
  return moved;
}

/** The last three days' stories without their English or Hindi (Gujarat's news went without, before 29 Oct; or a
 *  translation failed) get them, the most important first, a few each run as the free allowance goes; then the
 *  printed paper's stories of the last month without Hindi (29 Oct: 70 of them; their English is the hourly run's,
 *  pipeline/run.ts, which makes no Hindi). Run early in the round, before the writing (2 Nov: run last, it began after
 *  the round's time every time and translated nothing, so a story whose translation failed stayed Gujarati on /en and
 *  /hi). The newest first, those tried in the last hour after the rest, so one that keeps failing doesn't hold the others back. A translation
 *  with Gujarati letters in it counts as none (2 Nov: models had given the Gujarati back and it was kept as done).
 *  A story whose translation failed before is tried only in the round's last step (`early` false), and not after four
 *  failures (4 Nov: two that kept failing took five minutes at the start of every round, the writing found its time gone
 *  and the news stopped for hours). */
async function translations(until = deadline, early = false) {
  const left = await aiLeft(sql);
  const can = Math.min(6, Math.floor((left - RESERVE) / 2));
  if (can <= 0) return 0;
  const gu = (c: "en" | "hi") => `concat_ws(' ', ${c}->>'kicker', ${c}->>'headline', ${c}->>'deck', ${c}->>'body') ~ '[઀-૿]'`;
  const rows = await sql.query(
    `select * from (select id, origin, kicker, headline, deck, body, caption, published_at, updated_at, translate_fails,
                           en_status = 'done' and not ${gu("en")} as en_ok, hi_status = 'done' and not ${gu("hi")} as hi_ok from stories
                     where status = 'published' and published_at > now() - interval '30 days') s
      where (origin = 'live' and published_at > now() - interval '3 days' and not (en_ok and hi_ok)
         or origin <> 'live' and not hi_ok) and translate_fails < $2
      order by origin = 'live' desc, updated_at > now() - interval '1 hour', published_at desc limit $1`, [can, early ? 1 : 4]);
  let done = 0;
  const one = async (r: (typeof rows)[number]) => {
    const w = { kicker: r.kicker, headline: r.headline, deck: r.deck, body: r.body, caption: r.caption, model: "" };
    const [en, hi] = await Promise.all([
      r.en_ok || r.origin !== "live" ? null : translate(sql, w, "en", indiaDate()),
      r.hi_ok ? null : translate(sql, w, "hi", indiaDate()),
    ]);
    const failed = (!r.en_ok && r.origin === "live" && !en) || (!r.hi_ok && !hi);
    await sql.query(
      `update stories set en = coalesce($2::jsonb, en), en_status = case when $2::jsonb is not null then 'done' else en_status end,
          hi = coalesce($3::jsonb, hi), hi_status = case when $3::jsonb is not null then 'done' else hi_status end, updated_at = now(),
          translate_fails = translate_fails + $4
        where id = $1`, [r.id, en ? JSON.stringify(en) : null, hi ? JSON.stringify(hi) : null, failed ? 1 : 0]);
    if (en || hi) done++;
    log(`  ${r.id}: ${[r.en_ok || r.origin !== "live" ? "" : en ? "English" : "no English", r.hi_ok ? "" : hi ? "Hindi" : "no Hindi"].filter(Boolean).join(", ")}`);
  };
  // three stories at a time, six requests: Flash Lite allows 15 a minute, shared with the writing and the desk
  for (let i = 0; i < rows.length && Date.now() <= until; i += 3) await Promise.all(rows.slice(i, i + 3).map(one));
  if (done) await touched(sql);
  return done;
}

/** The day's birthdays on the leaders list (lib/leaders.ts), told to the editor once, from 6 AM India time: the greeting
 *  picture and the email draft wait on the editor page. Nothing is sent to the leaders. */
async function birthdayNote() {
  if (Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false })) < 6) return;
  const first = await sql.query(`insert into state (key, value) values ($1, now()::text) on conflict (key) do nothing returning key`, [`birthdays:${indiaDate()}`]);
  if (!first.length) return;
  const { today } = birthdays(await leaders(sql));
  if (!today.length) return;
  log(`birthdays today: ${today.map((l) => l.nameEn || l.nameGu).join(", ")}`);
  await tell(`🎂 <b>આજે જન્મદિવસ:</b> ${today.map((l) => `${l.title} ${l.nameGu}`).join(", ")}\nશુભેચ્છા ફોટો અને ઈમેલનો મુસદ્દો સંપાદકના પાના પર તૈયાર છે: ${WEBSITE.url}/editor?tab=leaders`);
}

/** Once a day: the reports of more than three weeks ago go (4 Nov: kept for ever, they were most of the database, which is
 *  to fit a free plan's 500 MB). Nothing reads them: the checks look back two days, refiling a week, the fact-checks a
 *  month, so those are kept 45 days. A report without a date keeps its row, emptied, so the source listing it again
 *  isn't taken for new: the collector notes a dated old one and never uses it. */
async function prune() {
  const day = indiaDate();
  const [done] = await sql.query(`select value from state where key = 'pruned'`);
  if (done?.value === day) return;
  const old = `seen_at < now() - interval '21 days' and (cluster_id is distinct from 'factcheck' or seen_at < now() - interval '45 days')`;
  const [gone] = await sql.query(`with d as (delete from items where ${old} and published_at is not null returning 1) select count(*)::int as n from d`);
  await sql.query(`update items set summary = '', body = null where ${old} and published_at is null and (summary <> '' or body is not null)`);
  await sql.query(`insert into state (key, value) values ('pruned', $1) on conflict (key) do update set value = excluded.value`, [day]);
  log(`old reports deleted: ${gone?.n ?? 0}`);
}

/** Step 9: a published story's sources watched for 24 hours. */
async function watch() {
  const live = await sql.query(
    `select c.id, c.story_id, s.sources, s.updated_at, s.status from clusters c join stories s on s.id = c.story_id
      where c.state in ('published', 'held') and s.published_at > now() - interval '24 hours'
        and exists (select 1 from items i where i.cluster_id = c.id and i.seen_at > s.updated_at)`);
  for (const c of live) {
    const fresh = await sql.query(`select source, url, title, summary from items where cluster_id = $1 and seen_at > $2`, [c.id, c.updated_at]);
    if (!fresh.length) continue;
    const have = new Set((c.sources as { url: string }[]).map((s) => s.url));
    const add = fresh.filter((f) => !have.has(f.url));
    const corrected = fresh.find((f) => CORRECTION.test(`${f.title} ${f.summary}`));
    if (corrected && c.status === "published") {
      await sql.query(`update stories set status = 'withdrawn', hold_reason = $2, updated_at = now() where id = $1`,
        [c.story_id, `a source corrected or withdrew it: ${corrected.title}`]);
      await touched(sql);
      await tell(`⚠️ <b>સમાચાર રોક્યા:</b> સ્રોતે સુધારો કર્યો કે પાછા ખેંચ્યા.\n${corrected.title}\n${corrected.url}`);
      log(`    ${c.story_id}: taken down, a source corrected it`);
    } else if (add.length) {
      const { sourceById } = await import("./sources.ts");
      const more = add.map((f) => ({ name: sourceById.get(f.source)?.name ?? f.source, url: f.url, trust: sourceById.get(f.source)?.trust, group: sourceById.get(f.source)?.group }));
      await sql.query(`update stories set sources = sources || $2::jsonb, updated_at = now() where id = $1`, [c.story_id, JSON.stringify(more)]);
    }
  }
}

await ensureSchema(sql);
// the editor's stop switch (the editor page, lib/editor.ts): nothing collected, written or published
const [paused] = await sql.query(`select value from state where key = 'engine_paused'`);
if (paused?.value === "yes") { log("the editor has paused the engine: nothing to do"); process.exit(0); }
const [run] = await sql.query(`insert into runs (kind, started_at) values ('engine', now()) returning id`);
const details: Record<string, unknown> = { models: await freeModels() };
let ok = true;
// each step's start kept as it goes, and the round ended by itself at 13 minutes, so a slow step is named and the round still
// finishes (29 Oct: rounds cut off by the keeper's 14-minute limit left nothing saved to say why)
const steps: Record<string, number> = {};
const step = (name: string) => {
  steps[name] = Math.round((Date.now() - started) / 1000);
  return sql.query(`update runs set details = $2 where id = $1`, [run.id, JSON.stringify({ ...details, steps, log: lines })]).catch(() => null);
};
const guard = setTimeout(async () => {
  const at = Object.keys(steps).at(-1) ?? "start";
  await sql.query(`update runs set finished_at = now(), ok = false, details = $2 where id = $1`,
    [run.id, JSON.stringify({ ...details, steps, log: lines, error: `stopped after 13 minutes, still at "${at}"` })]).catch(() => null);
  await fetch(`${WEBSITE.url}/api/refresh`, { method: "POST", signal: AbortSignal.timeout(30_000) }).catch(() => null);
  log(`stopped after 13 minutes, still at "${at}"`);
  process.exit(1);
}, 13 * 60_000);
try {
  log(`engine run ${run.id}; free models: ${(details.models as string[]).join(", ")}${(await groqModels()).length ? `; for the short jobs: ${(await groqModels()).join(", ")}` : ""}`);
  await settleWaiting();
  await step("presses");
  details.presses = await pollUpdates(sql);
  log("sources:");
  await step("sources");
  details.collect = await collect(sql, log, started + 4 * 60_000);
  // the round's work side by side (4 Nov: one step after another, the sorting and the checks left the writing two or three
  // minutes and a round put up two or three stories): the stories already up without their English or Hindi (no batch
  // begun after a minute), the copies and the file photos, the writing of what earlier rounds confirmed, and the sorting
  // of the new items and their checks. Each has its own time; the free models take the requests in turn (ai.ts).
  await Promise.all([
    (async () => {
      log("translations:");
      await step("translations");
      details.translated = await translations(Date.now() + 60_000, true);
      await step("duplicates");
      details.deduped = await dedupe(Date.now() + 90_000);
    })(),
    (async () => {
      await step("photo check");
      details.photosOff = await photoFit(Date.now() + 60_000);
    })(),
    (async () => {
      log("writing:");
      await step("writing");
      await write(started + 5 * 60_000);
    })(),
    (async () => {
      log("triage:");
      await step("triage");
      const left = await aiLeft(sql);
      details.triage = await triage(sql, log, Math.max(0, Math.min(8, Math.floor((left - RESERVE) / 10))), Math.min(deadline - 60_000, started + 5 * 60_000));
      await cluster(sql, log);
      log("checks:");
      await step("checks");
      await advance();
    })(),
  ]);
  log("writing what was confirmed:");
  await step("writing again");
  await write();
  log("photos:");
  await step("refiling");
  details.refiled = await refile();
  details.mended = await mendPublished();
  await step("photos");
  const [photosAdded, again] = await Promise.all([photos(), translations(finish)]);
  details.photos = photosAdded;
  details.translated = (details.translated as number) + again;
  await step("watch");
  await watch();
  await step("birthdays");
  await birthdayNote();
  await step("old reports");
  await prune();
} catch (e) {
  ok = false;
  details.error = e instanceof Error ? `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}` : String(e);
  log(`failed: ${details.error}`);
}
clearTimeout(guard);
details.steps = steps;
details.log = lines;
details.aiRequests = aiUsed();
details.seconds = Math.round((Date.now() - started) / 1000);
await sql.query(`update runs set finished_at = now(), ok = $2, details = $3 where id = $1`, [run.id, ok, JSON.stringify(details)]);
const refreshed = await fetch(`${WEBSITE.url}/api/refresh`, { method: "POST", signal: AbortSignal.timeout(30_000) }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
log(`website refresh: ${JSON.stringify(refreshed)}; ${aiUsed()} free AI request(s), ${details.seconds}s`);
if (!ok) process.exit(1);
