// Instagram's sets (lib/insta.ts), run after each engine round (site-engine.yml): when an edition is due (8 in the
// morning, 7 in the evening, India time, made an hour ahead) it picks each section's most important stories of the last
// 12 hours, finds each a good photo, makes the cards' pictures with a real browser and tells the editor on Telegram;
// a set the editor changed on the editor page gets its pictures made again. Sets left unapproved go at the next edition,
// and the pictures of old ones leave the photo store after four days.
//   node --experimental-strip-types --no-warnings site/engine/insta.ts           (what is due)
//   node --experimental-strip-types --no-warnings site/engine/insta.ts --now     (an edition now, whatever the hour: to try)
import { createHash, randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { db, storiesIn } from "../lib/db.ts";
import {
  MAX_STORIES, MIN_STORIES, MIN_WIDTH, SITE, captionFor, cardsHtml, editionName, editionNow, recentSets, saveSet, setsIn,
  type Card, type CardPhoto, type InstaSet,
} from "../lib/insta.ts";
import { sectionName, TIERS } from "../lib/sections.ts";
import { tell } from "../lib/telegram.ts";
import type { Story, Tier } from "../lib/types.ts";
import { askGemini, type GeminiImage } from "./ai.ts";
import { UA as WIKI_UA, commonsAt, commonsPictures, subjectOf } from "./wikiphoto.ts";

type Sql = NeonQueryFunction<false, false>;
const log = (s: string) => console.log(s);

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

/** The photos fit for a story's card, best first (its own first): up to three, for the editor's "another photo". */
async function photosFor(sql: Sql, s: Story): Promise<CardPhoto[]> {
  const offers: Offer[] = [];
  if (s.photo && s.photo.width >= MIN_WIDTH) {
    offers.push({ photo: { url: s.photo.url, width: s.photo.width, height: s.photo.height, credit: s.photo.credit, representative: !!s.photo.credit },
                  fetchUrl: s.photo.url.startsWith("/") ? SITE + s.photo.url : s.photo.url, about: s.caption });
  }
  // file photos of the story's subject
  const who = await subjectOf(sql, { kicker: s.kicker, headline: s.en?.headline || s.headline, deck: s.en?.deck || s.deck, body: s.en?.body || s.body, caption: "", model: "" });
  if (who) {
    for (const p of (await commonsPictures(who.title, 8)).filter((p) => p.full >= 1080).slice(0, 4)) {
      const big = commonsAt(p, 1920);
      offers.push({ photo: { url: big.url, width: big.width, height: big.height, credit: p.credit, representative: true }, fetchUrl: commonsAt(p, 960).url, about: p.alt });
    }
  }
  if (!offers.length) return [];
  const images: GeminiImage[] = [];
  const shown: Offer[] = [];
  for (const o of offers) {
    const jpeg = await thumb(o.fetchUrl);
    await new Promise((r) => setTimeout(r, 250)); // Wikimedia asks programs not to rush it
    if (!jpeg) continue;
    shown.push(o);
    images.push({ label: `PHOTO ${shown.length} (${o.photo.representative ? "a file photo" : "the story's own"}; its description: ${o.about.slice(0, 160) || "none"})`, jpeg });
  }
  if (!images.length) return [];
  const res = await askGemini(sql, "lite", {
    system: JUDGE, user: `STORY: ${s.en?.headline || s.headline}\n${s.en?.deck || s.deck}`, images, maxTokens: 2000, temperature: 0.1,
  }, (v) => {
    const x = (v as { photos?: { n?: unknown; fits?: unknown; kind?: unknown; quality?: unknown }[] })?.photos;
    return Array.isArray(x) ? x.map((y) => ({ n: Number(y.n), fits: y.fits === true, kind: String(y.kind ?? ""), quality: Number(y.quality) || 0 })) : null;
  }, { wait: false, timeoutMs: 90_000 });
  if (!res.ok) {
    // the photos can't be looked at now: the story's own, as the site shows it, and no file photo unseen
    log(`    photos not looked at (${res.why.slice(0, 100)})`);
    return shown.filter((o) => !o.photo.representative).map((o) => o.photo);
  }
  const seen = new Map(res.value.map((x) => [x.n, x]));
  return shown
    .map((o, i) => ({ o, x: seen.get(i + 1) }))
    .filter(({ x }) => x && x.fits && x.kind === "photo" && x.quality >= 6)
    .sort((a, b) => Number(!!a.o.photo.representative) - Number(!!b.o.photo.representative) || b.x!.quality - a.x!.quality)
    .slice(0, 3)
    .map(({ o }) => o.photo);
}

// ---- a section's set

async function makeSet(sql: Sql, tier: Tier, edition: string): Promise<InstaSet | null> {
  const since = Date.now() - 12 * 3600_000;
  const stories = (await storiesIn(tier, 60))
    .filter((s) => new Date(s.publishedAt).getTime() >= since)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || b.publishedAt.localeCompare(a.publishedAt));
  const cards: Card[] = [];
  for (const s of stories.slice(0, 14)) {
    if (cards.length >= MAX_STORIES) break;
    const options = await photosFor(sql, s);
    log(`  ${s.headline.slice(0, 70)}: ${options.length} photo(s)`);
    if (options.length) cards.push({ storyId: s.id, headline: s.headline, deck: s.deck, options, pick: 0 });
  }
  log(`${sectionName(tier, "en")}: ${stories.length} stories in 12 hours, ${cards.length} with a good photo`);
  if (cards.length < MIN_STORIES) return null;
  return {
    id: `${edition}-${tier}-${randomBytes(3).toString("hex")}`, edition, tier, state: "making", cards,
    caption: captionFor(tier, edition, cards), image: null, madeAt: new Date().toISOString(), postedAt: null, postUrl: null, note: "",
  };
}

// ---- the pictures: the cards' page in a real browser (Gujarati's letters need one), each card a 1080×1350 picture, put
// one under another in a single JPEG (one upload a set; the site cuts out each card: app/media)

async function render(sql: Sql, sets: InstaSet[]) {
  const { chromium } = await import("playwright");
  // GitHub's machines have Chrome; Playwright's own browser where it was installed
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  try {
    for (const set of sets) {
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
      const old = set.image;
      set.image = `/media/${name}`;
      set.state = "waiting";
      set.note = "";
      await saveSet(sql, set);
      if (old && old !== set.image) await del(old.replace(/^\/media\//, "")).catch(() => {});
      log(`${set.id}: ${shots.length} cards, ${Math.round(tall.length / 1024)} KB`);
    }
  } finally {
    await browser.close();
  }
}

// ---- the run

const sql = db();
if (!sql) { console.log("no DATABASE_URL"); process.exit(0); }
if (!process.env.BLOB_READ_WRITE_TOKEN) { console.log("no BLOB_READ_WRITE_TOKEN: the pictures can't be kept"); process.exit(0); }

// --now: the edition of this half of the day, whatever the hour (to try it)
const t = new Date(Date.now() + 5.5 * 3600_000);
const edition = editionNow() ?? (process.argv.includes("--now") ? `${t.toISOString().slice(0, 10)}-${t.getUTCHours() < 13 ? "am" : "pm"}` : null);
const recent = await recentSets(sql, 40);

// sets left unapproved from an earlier edition go
for (const s of recent.filter((s) => s.edition !== edition && (s.state === "waiting" || s.state === "making"))) {
  s.state = "expired";
  await saveSet(sql, s);
  log(`${s.id}: expired`);
}
// the pictures of sets more than four days old leave the store (Instagram keeps its own copies)
for (const s of recent.filter((s) => s.image && Date.now() - new Date(s.madeAt).getTime() > 4 * 86_400_000)) {
  await del(s.image!.replace(/^\/media\//, "")).catch(() => {});
  s.image = null;
  await saveSet(sql, s);
}

const made: InstaSet[] = [];
if (edition && !recent.some((s) => s.edition === edition)) {
  log(`Edition ${edition}`);
  for (const tier of TIERS) {
    const set = await makeSet(sql, tier, edition);
    if (set) { await saveSet(sql, set); made.push(set); }
  }
  // no section had enough good stories: a set of none, so the edition counts as made and isn't tried every round
  if (!made.length) await saveSet(sql, { id: `${edition}-none`, edition, tier: "gujarat", state: "expired", cards: [], caption: "", image: null,
                                         madeAt: new Date().toISOString(), postedAt: null, postUrl: null, note: "too few stories with good photos" });
}

// pictures for the new sets and for those the editor changed
const toMake = await setsIn(sql, "making");
if (toMake.length) {
  try {
    await render(sql, toMake);
  } catch (e) {
    log(`the pictures weren't made: ${e instanceof Error ? e.message : e}`);
    for (const s of toMake) { s.note = `ચિત્રો બન્યાં નહીં; આગલા ચક્રમાં ફરી પ્રયાસ થશે.`; await saveSet(sql, s); }
  }
}

if (made.length) {
  const left = TIERS.filter((t) => !made.some((s) => s.tier === t)).map((t) => sectionName(t, "gu"));
  await tell(`<b>ઇન્સ્ટાગ્રામ: ${editionName(made[0].edition)}</b>\n${made.map((s) => `${sectionName(s.tier, "gu")}: ${s.cards.length} સમાચાર`).join("\n")}` +
    `${left.length ? `\n(${left.join(", ")}: સારા ફોટાવાળા પૂરતા સમાચાર નથી)` : ""}\n\nજોઈને મંજૂર કરો: ${SITE}/editor#insta`);
}
