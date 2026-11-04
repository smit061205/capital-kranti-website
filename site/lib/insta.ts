// Instagram (the user, 3 Nov): twice a day, one carousel each for Gujarat, India and the world, all in Gujarati. 5 to 7
// story cards (the most important stories of the last 12 hours) and a last card that points to the section; with fewer
// than 5 good ones that section is left out. Every card has a real photo (plain colour cards "are not acceptable"),
// at its own shape. The engine makes each set (engine/insta.ts) and the editor approves it on the editor page, where a
// card can be taken out, given another photo, and the caption changed; one left unapproved goes at the next edition.
// This file is shared by the site and the engine: the sets in the database, the cards' page and the caption.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { dateText, num } from "./format.ts";
import { sectionName, TIERS } from "./sections.ts";
import type { Tier } from "./types.ts";
import { prepared } from "./write.ts";

type Sql = NeonQueryFunction<false, false>;

export const MIN_STORIES = 5;
export const MAX_STORIES = 7;
/** the fewest cards the editor may leave in a set (Instagram's own least is 2) */
export const MIN_KEPT = 3;
/** a photo narrower than this would be blown up on the 1080-wide card, and look soft */
export const MIN_WIDTH = 1000;
export const SITE = "https://www.capitalkranti.co.in";

/** representative: a file photo of the story's subject (Wikimedia Commons), marked "ફાઇલ" on the card; symbolic: a photo of
 *  the kind of thing, marked "પ્રતીકાત્મક" as the site marks it */
export interface CardPhoto { url: string; width: number; height: number; credit?: string; representative?: boolean; symbolic?: boolean }
/** a story's card: the photos found for it, best first, and the one in use */
/** deck: the story's short summary, a small line under the headline (the user, 3 Nov) */
export interface Card { storyId: string; headline: string; deck?: string; options: CardPhoto[]; pick: number }
/** making: its pictures are being made (new, or changed by the editor); waiting: for the editor; approved: being posted */
export type SetState = "making" | "waiting" | "approved" | "posted" | "expired" | "failed";
export interface InstaSet {
  id: string; edition: string; tier: Tier; state: SetState; cards: Card[]; caption: string;
  /** the cards as one tall picture in the photo store, one under another (one upload a set: the store's free uploads are few) */
  image: string | null;
  madeAt: string; postedAt: string | null; postUrl: string | null; note: string;
  /** its post on the paper's Facebook Page (lib/facebook.ts), when it went up there */
  fbUrl: string | null;
}

/** the last card's photo, one for each section: free photos from Wikimedia Commons, credited (the user picks them by eye) */
export interface Landmark extends CardPhoto { title: string; short: string }
export const LANDMARKS: Record<Tier, Landmark> = {
  gujarat: { title: "ગુજરાતના આજના બધા સમાચાર", short: "capitalkranti.co.in", credit: "Rahilarious, CC BY-SA 4.0", width: 1280, height: 1644,
             url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg/1280px-Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg" },
  india: { title: "દેશના આજના બધા સમાચાર", short: "capitalkranti.co.in", credit: "A.Savin, FAL", width: 1280, height: 1600,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/India_Gate_in_New_Delhi_03-2016.jpg/1280px-India_Gate_in_New_Delhi_03-2016.jpg" },
  world: { title: "વિશ્વના આજના બધા સમાચાર", short: "capitalkranti.co.in", credit: "NASA, Apollo 17", width: 1280, height: 1281,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/1280px-The_Earth_seen_from_Apollo_17.jpg" },
};

// ---- editions: at the editor's times (8 in the morning and 7 in the evening at first), India time; each is made an hour
// ahead, for the editor to look at. The editor can also ask for a set at any hour ("make one now"), and change the times,
// the sections and whether sets come by themselves (the user, 4 Nov: the editor "can't even change the timing").

const india = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000);
/** the editor's choices, kept in the state table */
export interface InstaSettings { auto: boolean; times: string[]; tiers: Tier[] }
export const DEFAULT_SETTINGS: InstaSettings = { auto: true, times: ["08:00", "19:00"], tiers: [...TIERS] };
export const MAX_TIMES = 4;
/** made this long before an edition's time, and the edition's sets kept this long after it */
const AHEAD = 60, AFTER = 4 * 60;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`;

/** the edition being made or shown now ("2026-11-03-0800"), or null between them */
export function editionNow(times = DEFAULT_SETTINGS.times, now = new Date()): string | null {
  const t = india(now), at = t.getUTCHours() * 60 + t.getUTCMinutes();
  const day = (d: number) => new Date(t.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  // yesterday's, today's and tomorrow's times in minutes from today's midnight (an 00:30 one is made the evening before)
  const all = [-1, 0, 1].flatMap((d) => [...new Set(times)].map(minutes).map((m) => ({ d, m, a: d * 1440 + m }))).sort((x, y) => x.a - y.a);
  for (const [i, e] of all.entries()) {
    // from an hour before its time until four hours after, or until the next one starts being made
    const next = all[i + 1]?.a ?? Infinity;
    if (at >= e.a - AHEAD && at < Math.min(e.a + AFTER, next - AHEAD)) return `${day(e.d)}-${hhmm(e.m)}`;
  }
  return null;
}
/** an edition of this minute, for a set the editor asked for */
export function editionAt(now = new Date()): string {
  const t = india(now);
  return `${t.toISOString().slice(0, 10)}-${hhmm(t.getUTCHours() * 60 + t.getUTCMinutes())}`;
}
/** "સવારે ૮:૦૦" for "08:00" */
export function timeName(t: string, lang: "gu" | "en" = "gu"): string {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5), h12 = h % 12 || 12;
  if (lang === "en") return `${h12}:${m} ${h < 12 ? "am" : "pm"}`;
  const part = h >= 4 && h < 12 ? "સવારે" : h >= 12 && h < 16 ? "બપોરે" : h >= 16 && h < 20 ? "સાંજે" : "રાત્રે";
  return `${part} ${num(`${h12}:${m}`, "gu")}`;
}
export function editionName(edition: string): string {
  const date = dateText(edition.slice(0, 10), "gu"), end = edition.slice(11);
  // the first sets were named by half of the day
  if (end === "am" || end === "pm") return `${date}, ${end === "am" ? "સવાર" : "સાંજ"}`;
  return `${date}, ${timeName(`${end.slice(0, 2)}:${end.slice(2, 4)}`)}`;
}

// ---- the log: each step of making and posting a set, newest first on the editor page; kept three days

export interface InstaLogLine { at: string; who: string; line: string }
/** a line in the log; "who" is what did it: the editor's name, "engine" or "instagram". Never fails what it's logging. */
export async function instaLog(sql: Sql, who: string, line: string) {
  try {
    await prepared(sql);
    await sql.query(`insert into insta_log (who, line) values ($1, $2)`, [who.slice(0, 40), line.slice(0, 500)]);
    if (Math.random() < 0.02) await sql.query(`delete from insta_log where at < now() - interval '3 days'`);
  } catch (e) {
    // the log is a help, not the work: its failure is told, not thrown
    console.error(`instaLog: ${e instanceof Error ? e.message : e}`);
  }
}
export async function instaLogs(sql: Sql, n = 80): Promise<InstaLogLine[]> {
  await prepared(sql);
  const rows = await sql.query(`select at, who, line from insta_log order by id desc limit $1`, [n]);
  return rows.map((r) => ({ at: new Date(r.at as string).toISOString(), who: r.who as string, line: r.line as string }));
}

// ---- the editor's choices and asks, in the state table

async function stateOf(sql: Sql, key: string): Promise<unknown> {
  await prepared(sql);
  const [r] = await sql.query(`select value from state where key = $1`, [key]);
  try { return r ? JSON.parse(r.value as string) : null; } catch { return null; }
}
async function putState(sql: Sql, key: string, value: unknown) {
  await prepared(sql);
  await sql.query(`insert into state (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [key, JSON.stringify(value)]);
}
const isTime = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
/** times as the editor typed them: real times only, each once, in order, at most four */
export const cleanTimes = (list: unknown[]): string[] => [...new Set(list.filter(isTime))].sort().slice(0, MAX_TIMES);
export const cleanTiers = (list: unknown[]): Tier[] => TIERS.filter((t) => list.includes(t));

export async function instaSettings(sql: Sql): Promise<InstaSettings> {
  const v = (await stateOf(sql, "insta_settings")) as Partial<InstaSettings> | null;
  if (!v) return DEFAULT_SETTINGS;
  const tiers = cleanTiers(Array.isArray(v.tiers) ? v.tiers : []);
  return { auto: v.auto !== false, times: cleanTimes(Array.isArray(v.times) ? v.times : []), tiers: tiers.length ? tiers : [...TIERS] };
}
export const saveInstaSettings = (sql: Sql, s: InstaSettings) => putState(sql, "insta_settings", s);

/** a set the editor asked for, made by the engine within minutes (engine/listen.ts) */
export interface InstaAsk { tiers: Tier[]; at: string; by: string }
export async function instaAsk(sql: Sql): Promise<InstaAsk | null> {
  const v = (await stateOf(sql, "insta_ask")) as InstaAsk | null;
  return v && Array.isArray(v.tiers) && typeof v.at === "string" ? { ...v, tiers: cleanTiers(v.tiers) } : null;
}
export const askInsta = (sql: Sql, ask: InstaAsk) => putState(sql, "insta_ask", ask);
/** the ask done: taken away only if it's still the same one (the editor may have asked again meanwhile) */
export async function askDone(sql: Sql, ask: InstaAsk) {
  await sql.query(`delete from state where key = 'insta_ask' and value::jsonb ->> 'at' = $1`, [ask.at]);
}
/** what the last ask came to, for the editor page: "ગુજરાત: ૬ સમાચાર; વિશ્વ: પૂરતા સમાચાર નથી" */
export interface InstaNews { at: string; text: string }
export const instaNews = async (sql: Sql) => (await stateOf(sql, "insta_news")) as InstaNews | null;
export const putInstaNews = (sql: Sql, n: InstaNews) => putState(sql, "insta_news", n);
/** how far the engine is with the sets it's making, for the editor page's bar: renewed at every story and picture */
export interface InstaProgress { started: string; at: string; step: string; done: number; total: number }
export const instaProgress = async (sql: Sql) => (await stateOf(sql, "insta_progress")) as InstaProgress | null;
export async function putInstaProgress(sql: Sql, p: InstaProgress | null) {
  if (p) await putState(sql, "insta_progress", p);
  else await sql.query(`delete from state where key = 'insta_progress'`);
}

// ---- the sets in the database

const setOf = (r: Record<string, unknown>): InstaSet => ({
  id: r.id as string, edition: r.edition as string, tier: r.tier as Tier, state: r.state as SetState,
  cards: r.cards as Card[], caption: r.caption as string, image: (r.image as string) ?? null,
  madeAt: new Date(r.made_at as string).toISOString(), postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null,
  postUrl: (r.post_url as string) ?? null, note: (r.note as string) ?? "", fbUrl: (r.fb_url as string) ?? null,
});

/** the latest sets, newest first (the editor page shows the current edition's and the last few posted) */
export async function recentSets(sql: Sql, limit = 12): Promise<InstaSet[]> {
  await prepared(sql);
  return (await sql.query(`select * from insta_sets order by made_at desc limit $1`, [limit])).map(setOf);
}
export async function setsIn(sql: Sql, state: SetState): Promise<InstaSet[]> {
  await prepared(sql);
  return (await sql.query(`select * from insta_sets where state = $1 order by made_at`, [state])).map(setOf);
}
export async function getSet(sql: Sql, id: string): Promise<InstaSet | null> {
  await prepared(sql);
  const [r] = await sql.query(`select * from insta_sets where id = $1`, [id]);
  return r ? setOf(r) : null;
}
export async function saveSet(sql: Sql, s: InstaSet) {
  await prepared(sql);
  await sql.query(
    `insert into insta_sets (id, edition, tier, state, cards, caption, image, made_at, posted_at, post_url, note, fb_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (id) do update set state = excluded.state, cards = excluded.cards, caption = excluded.caption, image = excluded.image,
       posted_at = excluded.posted_at, post_url = excluded.post_url, note = excluded.note, fb_url = excluded.fb_url`,
    [s.id, s.edition, s.tier, s.state, JSON.stringify(s.cards), s.caption, s.image, s.madeAt, s.postedAt, s.postUrl, s.note, s.fbUrl ?? null]);
}

// ---- what goes up

export const photoOfCard = (c: Card): CardPhoto => c.options[Math.min(c.pick, c.options.length - 1)];

const TAGS: Record<Tier, string> = { gujarat: "#ગુજરાત #ગુજરાતસમાચાર", india: "#ભારત #દેશ", world: "#વિશ્વ #દુનિયા" };
const HEAD: Record<Tier, string> = { gujarat: "ગુજરાતના મુખ્ય સમાચાર", india: "દેશના મુખ્ય સમાચાર", world: "વિશ્વના મુખ્ય સમાચાર" };

/** The post's words: the headlines in order (Instagram's links can't be tapped, so the profile's link page has them). */
export function captionFor(tier: Tier, edition: string, cards: Card[]): string {
  const credits = [...new Set(cards.map(photoOfCard).filter((p) => p.credit).map((p) => p.credit!.replace(/, Wikimedia Commons$/, "")))];
  return [
    `${HEAD[tier]} · ${editionName(edition)}`,
    "",
    ...cards.map((c, i) => `${num(i + 1, "gu")}. ${c.headline}`),
    "",
    "દરેક સમાચાર વિગતે વાંચવા: પ્રોફાઇલમાંની લિંક (capitalkranti.co.in)",
    ...(credits.length ? ["", `ફોટો: ${credits.join("; ")}${credits.length ? " (Wikimedia Commons)" : ""}`] : []),
    "",
    `${TAGS[tier]} #ગુજરાતીસમાચાર #CapitalKranti #કેપિટલક્રાંતિ`,
  ].join("\n");
}

// ---- the cards' page: the chosen look (3 Nov, design 1), every size the real 1080×1350. A browser saves each card as a
// picture (engine/insta.ts); /cards/<section> shows it to look at. The photo fills the whole card, never stretched (a wide
// one loses its sides), with the words straight on it: the user (3 Nov) had the blurred copy below a wide photo, the shade
// behind the words and then the black under a wide photo taken out. A shadow on the letters keeps them readable.

const CSS = `
body{margin:0;background:#e9e4da}
.set{display:flex;flex-direction:column;gap:40px;padding:40px;font-family:'Anek Gujarati',sans-serif}
.small{zoom:.25;flex-direction:row;flex-wrap:wrap;width:4560px}
.c{position:relative;width:1080px;height:1350px;overflow:hidden;background:#0d0910;color:#fff;flex:none}
.pic{position:absolute;left:0;top:0;width:1080px;height:1350px;object-fit:cover;display:block}
.top{position:absolute;left:64px;right:64px;top:52px;display:flex;justify-content:space-between;align-items:center;text-shadow:0 1px 10px rgba(0,0,0,.55)}
.logo{font-size:44px;font-weight:800;font-stretch:80%}
.n{font-size:34px;font-weight:600;opacity:.85}
.body{position:absolute;left:0;right:0;bottom:0;padding:120px 64px 44px}
.tag{display:inline-block;background:#7f3894;color:#fff;font-size:36px;font-weight:700;padding:8px 26px 4px;border-radius:6px;margin-bottom:26px}
.hl{font-size:80px;font-weight:750;font-stretch:88%;line-height:1.18;text-wrap:balance;text-shadow:0 2px 3px rgba(0,0,0,.8),0 3px 14px rgba(0,0,0,.75),0 6px 34px rgba(0,0,0,.6)}
.long{font-size:70px}.longer{font-size:62px}
.dek{margin-top:18px;font-size:34px;font-weight:500;line-height:1.35;color:rgba(255,255,255,.94);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 1px 3px rgba(0,0,0,.85),0 2px 12px rgba(0,0,0,.7)}
.foot{margin-top:30px;color:rgba(255,255,255,.88);font-size:28px;display:flex;justify-content:space-between;gap:24px;text-shadow:0 1px 3px rgba(0,0,0,.85),0 2px 12px rgba(0,0,0,.7)}
.endt{font-size:96px;font-weight:800;font-stretch:85%;line-height:1.1;text-shadow:0 2px 3px rgba(0,0,0,.8),0 3px 14px rgba(0,0,0,.75),0 6px 34px rgba(0,0,0,.6)}
.endu{margin-top:32px;font-size:54px;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.85),0 2px 12px rgba(0,0,0,.7)}
.endn{margin-top:24px;font-size:40px;opacity:.9;text-shadow:0 1px 3px rgba(0,0,0,.85),0 2px 12px rgba(0,0,0,.7)}`;


/** The ways of keeping the words readable on any photo, for the user to pick by eye (3 Nov: the bare words were lost on
 *  light photos); each is added over the look above. /cards shows them side by side. */
const DARK_ON_LIGHT = `.hl,.dek,.foot,.endt,.endu,.endn{text-shadow:none!important;color:#141118}.dek,.endn{color:#3b3542}.foot{color:#6b6470}`;
const STRIP = `box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:2px 14px;text-shadow:none`;
const LINES = `.hl{line-height:1.32}.dek{display:block;-webkit-line-clamp:unset;margin-top:22px;line-height:1.55}.foot{text-shadow:0 1px 3px #000,0 0 12px #000}`;
export const LOOKS: { name: string; css: string }[] = [
  { name: "Words only", css: "" },
  { name: "Soft fade at the bottom", css: `.body{background:linear-gradient(180deg,rgba(0,0,0,0) 0,rgba(0,0,0,.25) 45%,rgba(0,0,0,.6) 100%)}` },
  { name: "Dark strip behind each line", css: `.hl span,.dek span,.endt span{background:rgba(10,8,14,.72);${STRIP}}${LINES}` },
  { name: "Purple strip behind each line", css: `.hl span,.endt span{background:rgba(127,56,148,.92);${STRIP}}.dek span{background:rgba(20,10,26,.8);${STRIP}}.tag{background:#fff;color:#7f3894}${LINES}` },
  { name: "White box, dark letters", css: `.body{left:40px;right:40px;bottom:40px;padding:36px 40px 28px;background:rgba(255,255,255,.93);border-radius:22px}.hl{font-size:66px}.endt{font-size:80px}${DARK_ON_LIGHT}` },
  { name: "Frosted glass box", css: `.body{left:40px;right:40px;bottom:40px;padding:36px 40px 28px;background:rgba(20,14,26,.38);backdrop-filter:blur(26px) saturate(1.4);-webkit-backdrop-filter:blur(26px) saturate(1.4);border-radius:22px;border:1px solid rgba(255,255,255,.18)}.hl{font-size:66px}.endt{font-size:80px}` },
  { name: "Blur strip, no dark", css: `.body{backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);mask-image:linear-gradient(180deg,transparent 0,#000 70px);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 70px);background:rgba(0,0,0,.12)}` },
  { name: "Outlined letters", css: `.hl,.endt{-webkit-text-stroke:10px rgba(0,0,0,.85);paint-order:stroke fill;text-shadow:0 4px 20px rgba(0,0,0,.6)}.dek,.foot,.endu,.endn{-webkit-text-stroke:6px rgba(0,0,0,.85);paint-order:stroke fill}` },
  { name: "Darker edges", css: `.c::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 30%,transparent 40%,rgba(0,0,0,.55) 100%),linear-gradient(180deg,transparent 55%,rgba(0,0,0,.35));pointer-events:none}.body,.top{z-index:1}` },
  { name: "Purple band at the bottom", css: `.body{background:linear-gradient(180deg,rgba(127,56,148,0) 0,rgba(90,30,110,.75) 120px,rgba(70,20,88,.92) 100%)}.tag{background:#fff;color:#7f3894}` },
  { name: "Newspaper strip", css: `.body{background:#fbf8f2;padding:30px 56px 26px;border-top:8px solid #7f3894}.hl{font-size:64px}.endt{font-size:80px}.tag{margin-bottom:16px}${DARK_ON_LIGHT}` },
];
/** the look the cards go up with: the soft fade at the bottom, the user's pick on the test page (3 Nov) */
export const LOOK = 1;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** a photo's address a browser anywhere can open: the site's own ones with its address in front */
const abs = (u: string) => (u.startsWith("/") ? SITE + u : u);
// a headline's size by its length, so a long one stays in the card's lower half
const size = (h: string) => (h.length > 95 ? " longer" : h.length > 70 ? " long" : "");

function picture(p: CardPhoto): string {
  return `<img class="pic" src="${esc(abs(p.url))}" alt="">`;
}

/** The whole set's page: a card per story, then the last card; `small` shows them at a quarter, to look at. */
export function cardsHtml(set: { tier: Tier; edition: string; cards: Card[] }, small = false, look = LOOK): string {
  const total = set.cards.length + 1;
  const date = dateText(set.edition.slice(0, 10), "gu");
  const tag = `<span class="tag">${esc(sectionName(set.tier, "gu"))}</span>`;
  const top = (i: number) => `<div class="top"><span class="logo">કેપિટલ ક્રાંતિ</span><span class="n">${num(i, "gu")}/${num(total, "gu")}</span></div>`;
  const cards = set.cards.map((c, i) => {
    const p = photoOfCard(c);
    const credit = p.credit ? `ફોટો: ${p.symbolic ? "પ્રતીકાત્મક · " : p.representative ? "ફાઇલ · " : ""}${p.credit.replace(/, Wikimedia Commons$/, "")}` : "capitalkranti.co.in";
    return `<section data-card="${i + 1}" class="c">${picture(p)}${top(i + 1)}
      <div class="body">${tag}<div class="hl${size(c.headline)}"><span>${esc(c.headline)}</span></div>${c.deck ? `<div class="dek"><span>${esc(c.deck)}</span></div>` : ""}
      <div class="foot"><span>${esc(date)}</span><span>${esc(credit)}</span></div></div></section>`;
  });
  const end = LANDMARKS[set.tier];
  cards.push(`<section data-card="${total}" class="c">${picture(end)}${top(total)}
    <div class="body">${tag}<div class="endt"><span>${esc(end.title)}</span></div><div class="endu">${esc(end.short)}</div>
    <div class="endn">લિંક પ્રોફાઇલમાં ↑</div><div class="foot"><span></span><span>ફોટો: ${esc(end.credit!)}</span></div></div></section>`);
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wdth,wght@75..125,100..800&display=block">
<style>${CSS}${LOOKS[look]?.css ?? ""}</style></head><body><main class="set${small ? " small" : ""}">${cards.join("\n")}</main></body></html>`;
}
