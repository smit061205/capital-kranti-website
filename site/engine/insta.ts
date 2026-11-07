// Instagram's sets (lib/insta.ts), run by their own watcher (engine/instawatch.ts, site-insta.yml) the moment there's
// work: when an edition is due (at the editor's times, India time, made an hour
// ahead) or the editor asked for one, it picks each section's most important stories of the last
// 12 hours, finds each a good photo, makes the cards' pictures with a real browser and tells the editor on Telegram;
// a set the editor changed on the editor page gets its pictures made again. A set left unapproved goes when a newer one of
// its section is made, or after 12 hours, and the pictures of old ones leave the photo store after four days.
//   node --experimental-strip-types --no-warnings site/engine/insta.ts           (what is due)
//   node --experimental-strip-types --no-warnings site/engine/insta.ts --now     (an edition now, whatever the hour: to try)
//   node --experimental-strip-types --no-warnings site/engine/insta.ts --asked   (only if the editor asked for a set)
import { createHash, randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { db, storiesIn } from "../lib/db.ts";
import {
  MAX_STORIES, MIN_STORIES, MIN_WIDTH, SITE, askDone, captionFor, cardsHtml, editionAt, editionName, editionNow, instaAsk, instaLog, instaSettings,
  putInstaNews, putInstaProgress, recentSets, saveSet, setsIn, type Card, type CardPhoto, type InstaProgress, type InstaSet,
} from "../lib/insta.ts";
import { num } from "../lib/format.ts";
import { sectionName, TIERS } from "../lib/sections.ts";
import { tell } from "../lib/telegram.ts";
import { count } from "../lib/write.ts";
import type { Story, Tier } from "../lib/types.ts";
import { askGemini, type GeminiImage } from "./ai.ts";
import { UA as WIKI_UA, commonsAt, commonsPictures, subjectOf } from "./wikiphoto.ts";

type Sql = NeonQueryFunction<false, false>;
// each line also goes to the editor page's log (lib/insta.ts), written before the run ends
const logged: Promise<void>[] = [];
const log = (s: string) => {
  console.log(s);
  if (sql) logged.push(instaLog(sql, "engine", s.trim()));
};

// ---- a photo for each story: its own when it's good, else free photos of its subject from Wikimedia Commons, each looked at

const JUDGE = `You are the picture editor of a Gujarati news website's Instagram page. You get a news story and the photos on
offer for its card, each after a line naming it. Look at each photo itself and say:
- "fits": true only if it shows what the story is about: its event, place, people, organisation, or a file photo of the
  very person, place or thing named (a portrait of the minister named, the dam named, the country's parliament); false for a
  generic or unrelated picture, another place or person, or anything a reader could take for something else;
- "kind": "photo" (taken by a camera), "illustration", "generated" (looks made by an AI image generator), "diagram", "chart",
  "screenshot", "logo" or "text" (mostly words, a poster, a document);
- "quality": 0 to 10: sharp, well lit, well composed and striking 8-10; ordinary but clear 6-7; blurry, small, dark, cluttered
  or mostly words 0-4.
Reply with JSON only: {"photos":[{"n":1,"fits":true,"kind":"photo","quality":0}]}`;

interface Offer { photo: CardPhoto; fetchUrl: string; about: string }

async function thumb(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": WIKI_UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    return (await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: 640, height: 640, fit: "inside" }).jpeg({ quality: 72 }).toBuffer()).toString("base64");
  } catch {
    return null;
  }
}

/** The photos fit for a story's card, best first: up to three, for the editor's "another photo". The photo the story has on
 *  the site comes first and is trusted (the news engine already chose it for this story, and a symbolic one is labelled);
 *  only when it has none are file photos of its subject looked for, each looked at by Gemini (4 Nov: the stories' own
 *  Commons photos were judged again and mostly turned down, and with Gemini busy none were kept, so no set was made). */
async function photosFor(sql: Sql, s: Story): Promise<CardPhoto[]> {
  const short = `“${s.headline.slice(0, 60)}”`;
  if (s.photo && s.photo.width >= MIN_WIDTH) {
    return [{ url: s.photo.url, width: s.photo.width, height: s.photo.height, credit: s.photo.credit, representative: !!s.photo.credit,
              symbolic: /^પ્રતીકાત્મક/.test(s.caption ?? "") }];
  }
  const offers: Offer[] = [];
  // file photos of the story's subject
  const who = await subjectOf(sql, { kicker: s.kicker, headline: s.en?.headline || s.headline, deck: s.en?.deck || s.deck, body: s.en?.body || s.body, caption: "", model: "" });
  if (!who) log(`${short}: પોતાનો મોટો ફોટો નથી, અને ફાઇલ ફોટા માટે કોઈ વિષય (વ્યક્તિ/સ્થળ) ન મળ્યો`);
  if (who) {
    for (const p of (await commonsPictures(who.title, 8)).filter((p) => p.full >= 1080).slice(0, 4)) {
      const big = commonsAt(p, 1920);
      offers.push({ photo: { url: big.url, width: big.width, height: big.height, credit: p.credit, representative: true }, fetchUrl: commonsAt(p, 960).url, about: p.alt });
    }
  }
  if (who && !offers.length) log(`${short}: “${who.title}”ના મોટા ફાઇલ ફોટા વિકિમીડિયા પર નથી`);
  if (!offers.length) return [];
  const images: GeminiImage[] = [];
  const shown: Offer[] = [];
  for (const o of offers) {
    const jpeg = await thumb(o.fetchUrl);
    await new Promise((r) => setTimeout(r, 250)); // Wikimedia asks programs not to rush it
    if (!jpeg) continue;
    shown.push(o);
    images.push({ label: `PHOTO ${shown.length} (a file photo; its description: ${o.about.slice(0, 160) || "none"})`, jpeg });
  }
  if (!images.length) return [];
  const res = await askGemini(sql, "lite", {
    system: JUDGE, user: `STORY: ${s.en?.headline || s.headline}\n${s.en?.deck || s.deck}`, images, maxTokens: 2000, temperature: 0.1,
  }, (v) => {
    const x = (v as { photos?: { n?: unknown; fits?: unknown; kind?: unknown; quality?: unknown }[] })?.photos;
    return Array.isArray(x) ? x.map((y) => ({ n: Number(y.n), fits: y.fits === true, kind: String(y.kind ?? ""), quality: Number(y.quality) || 0 })) : null;
  }, { wait: false, timeoutMs: 90_000 });
  if (!res.ok) {
    // the photos can't be looked at now: no file photo unseen
    log(`${short}: ફોટા તપાસાયા નહીં, AI વ્યસ્ત (${res.why.slice(0, 160)})`);
    return [];
  }
  const seen = new Map(res.value.map((x) => [x.n, x]));
  const good = shown.filter((_, i) => { const x = seen.get(i + 1); return x && x.fits && x.kind === "photo" && x.quality >= 6; }).length;
  log(`${short}: “${who!.title}”ના ${shown.length} ફાઇલ ફોટા AI (${res.model})એ જોયા, ${good} ચાલે એવા`);
  return shown
    .map((o, i) => ({ o, x: seen.get(i + 1) }))
    .filter(({ x }) => x && x.fits && x.kind === "photo" && x.quality >= 6)
    .sort((a, b) => b.x!.quality - a.x!.quality)
    .slice(0, 3)
    .map(({ o }) => o.photo);
}

// ---- a section's set

/** The stories and photos already in a set of the last four days (a story is at most a day old when it's picked), so no
 *  set repeats an earlier one (5 Nov, the user: a set made nine hours after another had the same pictures; the most
 *  important stories of the last 24 hours were the same). A set that failed never went up, so its stories can be used. */
async function usedBefore(sql: Sql): Promise<{ stories: Set<string>; photos: Set<string> }> {
  const rows = await sql.query(`select cards from insta_sets where made_at > now() - interval '4 days' and state <> 'failed'`);
  const cards = rows.flatMap((r) => (r.cards as Card[]) ?? []);
  return { stories: new Set(cards.map((c) => c.storyId)), photos: new Set(cards.flatMap((c) => c.options.map((o) => photoKey(o.url)))) };
}
const photoKey = (url: string) => url.replace(/[?#].*$/, "");

async function makeSet(sql: Sql, tier: Tier, edition: string, seen: (looked: number, of: number, cards: number) => Promise<void>): Promise<InstaSet | null> {
  // the last 12 hours' most important first, then the 12 hours before (4 Nov: Gujarat had 14 stories in 12 hours and 4 with
  // a photo, so no set was made)
  const at = (s: Story) => new Date(s.publishedAt).getTime();
  const byWeight = (a: Story, b: Story) => (b.importance ?? 0) - (a.importance ?? 0) || b.publishedAt.localeCompare(a.publishedAt);
  const used = await usedBefore(sql);
  const fresh = (await storiesIn(tier, 80, true)).filter((s) => at(s) >= Date.now() - 24 * 3600_000);
  const all = fresh.filter((s) => !used.stories.has(s.id));
  if (all.length < fresh.length) log(`${sectionName(tier, "gu")}: ${fresh.length - all.length} સમાચાર પહેલાંના સેટમાં આવી ગયા છે, તે ફરી નહીં લેવાય`);
  const stories = [...all.filter((s) => at(s) >= Date.now() - 12 * 3600_000).sort(byWeight), ...all.filter((s) => at(s) < Date.now() - 12 * 3600_000).sort(byWeight)];
  const cards: Card[] = [];
  const looking = stories.slice(0, 20);
  log(`${sectionName(tier, "gu")}: સમાચાર પસંદ થાય છે (${looking.length} સૌથી મહત્ત્વના જોવાશે)`);
  // three stories at a time (each waits on Wikimedia and two AI answers): a section in a few minutes, not ten
  for (let i = 0; i < looking.length && cards.length < MAX_STORIES; i += 3) {
    const batch = looking.slice(i, i + 3);
    // a photo already in an earlier set (a file photo of the same leader for another story) isn't offered again
    const found = (await Promise.all(batch.map((s) => photosFor(sql, s).catch(() => [] as CardPhoto[]))))
      .map((options) => options.filter((o) => !used.photos.has(photoKey(o.url))));
    for (const [k, s] of batch.entries()) {
      if (found[k].length) log(`“${s.headline.slice(0, 60)}”: ${found[k].length} ફોટો, કાર્ડ ${cards.length < MAX_STORIES ? "બન્યું" : "નહીં (સેટ ભરાઈ ગયો)"}`);
      if (found[k].length && cards.length < MAX_STORIES) cards.push({ storyId: s.id, headline: s.headline, deck: s.deck, options: found[k], pick: 0 });
    }
    await seen(Math.min(i + 3, looking.length), looking.length, cards.length);
  }
  log(`${sectionName(tier, "gu")}: ૨૪ કલાકમાં ${stories.length} સમાચાર, ${looking.length} જોયા, ${cards.length} સારા ફોટાવાળા` +
    (cards.length < MIN_STORIES ? `: ઓછામાં ઓછા ${MIN_STORIES} જોઈએ, તેથી સેટ ન બન્યો` : ""));
  if (cards.length < MIN_STORIES) return null;
  return {
    id: `${edition}-${tier}-${randomBytes(3).toString("hex")}`, edition, tier, state: "making", cards,
    caption: captionFor(tier, edition, cards), image: null, madeAt: new Date().toISOString(), postedAt: null, postUrl: null, note: "", fbUrl: null,
  };
}

// ---- the pictures: the cards' page in a real browser (Gujarati's letters need one), each card a 1080×1350 picture, put
// one under another in a single JPEG (one upload a set; the site cuts out each card: app/media)

async function render(sql: Sql, sets: InstaSet[], report = true) {
  const { chromium } = await import("playwright");
  // GitHub's machines have Chrome; Playwright's own browser where it was installed
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  try {
    for (const [i, set] of sets.entries()) {
      if (progress && report) await step(`ચિત્રો બની રહ્યાં છે: ${sectionName(set.tier, "gu")} (${num(i + 1, "gu")}/${num(sets.length, "gu")})`,
                               progress.total - (sets.length - i));
      log(`${sectionName(set.tier, "gu")}: ${set.cards.length + 1} કાર્ડનાં ચિત્રો બને છે`);
      const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
      await page.setExtraHTTPHeaders({ "user-agent": WIKI_UA });
      await page.setContent(cardsHtml(set), { waitUntil: "networkidle", timeout: 90_000 });
      await page.evaluate(() => document.fonts.ready);
      const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
      if (broken.length) throw new Error(`photos that didn't load: ${broken.join(", ")}`);
      const shots: Buffer[] = [];
      for (const el of await page.locator("section[data-card]").all()) shots.push(await el.screenshot({ type: "png" }));
      await page.close();
      const tall = await sharp({ create: { width: 1080, height: 1350 * shots.length, channels: 3, background: "#000" } })
        .composite(shots.map((input, i) => ({ input, left: 0, top: i * 1350 })))
        .jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      const name = `instagram/${set.edition.slice(0, 10)}/${set.id}-${createHash("sha256").update(tall).digest("hex").slice(0, 10)}.jpg`;
      await put(name, tall, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
      await count(sql, "insta_upload");
      const old = set.image;
      set.image = `/media/${name}`;
      set.state = "waiting";
      set.note = "";
      await saveSet(sql, set);
      if (old && old !== set.image) await del(old.replace(/^\/media\//, "")).catch(() => {});
      log(`${sectionName(set.tier, "gu")}: ${shots.length} કાર્ડનાં ચિત્રો તૈયાર (${Math.round(tall.length / 1024)} KB): મંજૂરીની રાહ`);
    }
  } finally {
    await browser.close();
  }
}

// ---- the editor page's bar: a section's stories are most of the work, its pictures the rest

let progress: InstaProgress | null = null;
async function step(text: string, done: number) {
  if (!progress) return;
  progress = { ...progress, at: new Date().toISOString(), step: text, done: Math.min(done, progress.total) };
  await putInstaProgress(sql!, progress).catch(() => {});
}
const PER_SET = MAX_STORIES + 1;

// ---- the run

const sql = db();
if (!sql) { console.log("no DATABASE_URL"); process.exit(0); }
if (!process.env.BLOB_READ_WRITE_TOKEN) { console.log("no BLOB_READ_WRITE_TOKEN: the pictures can't be kept"); process.exit(0); }

const settings = await instaSettings(sql);
// one run at a time (the watcher, engine/instawatch.ts, and until 4 Nov's change reaches it the engine's round too): a
// run that died leaves its mark for at most 16 minutes, the longest a run is given
const [lock] = await sql.query(`insert into state (key, value) values ('insta_lock', $1) on conflict (key) do update set value = excluded.value
  where state.value < $2 returning key`, [new Date().toISOString(), new Date(Date.now() - 16 * 60_000).toISOString()]);
if (!lock) { console.log("another Instagram run is at work"); process.exit(0); }
const ending = async () => { await Promise.all(logged); };
const ask = await instaAsk(sql);
// --asked: only a set the editor asked for (the round's first step); nothing else when there's none
if (process.argv.includes("--asked") && !ask) { await sql.query(`delete from state where key = 'insta_lock'`); process.exit(0); }
if (ask) log(`${ask.by || "સંપાદક"}એ માગેલો સેટ (${ask.tiers.map((t) => sectionName(t, "gu")).join(", ")}): કામ શરૂ`);
const recent = await recentSets(sql, 40);

// the pictures of sets more than four days old leave the store (Instagram keeps its own copies)
for (const s of recent.filter((s) => s.image && Date.now() - new Date(s.madeAt).getTime() > 4 * 86_400_000)) {
  await del(s.image!.replace(/^\/media\//, "")).catch(() => {});
  s.image = null;
  await saveSet(sql, s);
}
// sets left unapproved for 12 hours go
for (const s of recent.filter((s) => (s.state === "waiting" || s.state === "making") && Date.now() - new Date(s.madeAt).getTime() > 12 * 3600_000)) {
  s.state = "expired";
  await saveSet(sql, s);
  log(`${sectionName(s.tier, "gu")}નો ${editionName(s.edition)}નો સેટ ૧૨ કલાક મંજૂર ન થયો: હટાવ્યો`);
}

/** an edition's sets for these sections; a newer set takes the place of its section's older one not yet up */
async function edition(edition: string, tiers: typeof TIERS): Promise<{ made: InstaSet[]; left: string[] }> {
  log(`સેટ બનવાનું શરૂ: ${editionName(edition)} (${tiers.map((t) => sectionName(t, "gu")).join(", ")})`);
  const made: InstaSet[] = [];
  const at = new Date().toISOString();
  progress = { started: at, at, step: "સમાચાર પસંદ થઈ રહ્યા છે", done: 0, total: tiers.length * PER_SET };
  await putInstaProgress(sql!, progress).catch(() => {});
  for (const [n, tier] of tiers.entries()) {
    const name = sectionName(tier, "gu");
    const set = await makeSet(sql!, tier, edition, (looked, of, cards) =>
      step(`${name}: ${num(looked, "gu")}/${num(of, "gu")} સમાચારના ફોટા જોયા, ${num(cards, "gu")} કાર્ડ તૈયાર`, n * PER_SET + Math.min(cards, MAX_STORIES)));
    if (!set) continue;
    await saveSet(sql!, set);
    made.push(set);
    // its pictures at once, so the editor sees each section's set while the next is made
    await step(`ચિત્રો બની રહ્યાં છે: ${name}`, n * PER_SET + MAX_STORIES);
    await render(sql!, [set], false).catch((e) => log(`${name}: ચિત્રો હજી ન બન્યાં (${e instanceof Error ? e.message : e}); ફરી પ્રયાસ થશે`));
    for (const old of recent.filter((o) => o.tier === tier && (o.state === "waiting" || o.state === "making"))) {
      old.state = "expired";
      await saveSet(sql!, old);
      log(`${name}નો જૂનો સેટ (${editionName(old.edition)}) હટાવ્યો: નવો આવ્યો`);
    }
    recent.unshift(set);
  }
  return { made, left: tiers.filter((t) => !made.some((s) => s.tier === t)).map((t) => sectionName(t, "gu")) };
}
const told: { made: InstaSet[]; left: string[] }[] = [];

// the editor's times; --now: one now, whatever the hour (to try it)
const due = settings.auto && settings.times.length ? editionNow(settings.times) : null;
const now = due ?? (process.argv.includes("--now") ? editionAt() : null);
const dueNew = now && !recent.some((s) => s.edition === now) ? now : null;
const none = (edition: string) => saveSet(sql, { id: `${edition}-none`, edition, tier: "gujarat", state: "expired", cards: [], caption: "", image: null,
                                                madeAt: new Date().toISOString(), postedAt: null, postUrl: null, fbUrl: null, note: "too few stories with good photos" });
if (ask) {
  // a set the editor asked for; when an edition is due as well, the asked one is that edition (made once, not twice)
  const r = ask.tiers.length ? await edition(dueNew ?? editionAt(), ask.tiers) : { made: [], left: [] };
  await putInstaNews(sql, { at: new Date().toISOString(), text: [
    ...r.made.map((s) => `${sectionName(s.tier, "gu")}: ${s.cards.length} સમાચાર`),
    ...(r.left.length ? [`${r.left.join(", ")}: છેલ્લા ૨૪ કલાકમાં ફોટાવાળા પૂરતા (૫) સમાચાર નથી`] : []),
  ].join("; ") });
  await askDone(sql, ask);
  if (dueNew && !r.made.length) await none(dueNew);
} else if (dueNew) {
  const r = await edition(dueNew, settings.tiers);
  told.push(r);
  // no section had enough good stories: a set of none, so the edition counts as made and isn't tried every round
  if (!r.made.length) await none(dueNew);
}

// pictures for the new sets and for those the editor changed
const toMake = await setsIn(sql, "making");
if (toMake.length) {
  if (!progress) {
    const at = new Date().toISOString();
    progress = { started: at, at, step: "ચિત્રો બની રહ્યાં છે", done: 0, total: toMake.length };
  }
  try {
    await render(sql, toMake);
  } catch (e) {
    log(`ચિત્રો ન બન્યાં: ${e instanceof Error ? e.message : e}; આગલી વખતે ફરી પ્રયાસ થશે`);
    for (const s of toMake) { s.note = `ચિત્રો બન્યાં નહીં; આગલા ચક્રમાં ફરી પ્રયાસ થશે.`; await saveSet(sql, s); }
  }
}

for (const { made, left } of told.filter((r) => r.made.length)) {
  await tell(`<b>ઇન્સ્ટાગ્રામ: ${editionName(made[0].edition)}</b>\n${made.map((s) => `${sectionName(s.tier, "gu")}: ${s.cards.length} સમાચાર`).join("\n")}` +
    `${left.length ? `\n(${left.join(", ")}: સારા ફોટાવાળા પૂરતા સમાચાર નથી)` : ""}\n\nજોઈને મંજૂર કરો: ${SITE}/editor?tab=insta`);
}
await putInstaProgress(sql, null).catch(() => {});
await sql.query(`delete from state where key = 'insta_lock'`);
await ending();
