// Instagram (the user, 3 Nov): twice a day, one carousel each for Gujarat, India and the world, all in Gujarati. 5 to 7
// story cards (the most important stories of the last 12 hours) and a last card that points to the section; with fewer
// than 5 good ones that section is left out. Every card has a real photo (plain colour cards "are not acceptable"),
// at its own shape. The engine makes each set (engine/insta.ts) and the editor approves it on the editor page, where a
// card can be taken out, given another photo, and the caption changed; one left unapproved goes at the next edition.
// This file is shared by the site and the engine: the sets in the database, the cards' page and the caption.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { dateText, num } from "./format.ts";
import { sectionName } from "./sections.ts";
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

/** representative: a file photo of the story's subject (Wikimedia Commons), marked "ફાઇલ" on the card */
export interface CardPhoto { url: string; width: number; height: number; credit?: string; representative?: boolean }
/** a story's card: the photos found for it, best first, and the one in use */
export interface Card { storyId: string; headline: string; options: CardPhoto[]; pick: number }
/** making: its pictures are being made (new, or changed by the editor); waiting: for the editor; approved: being posted */
export type SetState = "making" | "waiting" | "approved" | "posted" | "expired" | "failed";
export interface InstaSet {
  id: string; edition: string; tier: Tier; state: SetState; cards: Card[]; caption: string;
  /** the cards as one tall picture in the photo store, one under another (one upload a set: the store's free uploads are few) */
  image: string | null;
  madeAt: string; postedAt: string | null; postUrl: string | null; note: string;
}

/** the last card's photo, one for each section: free photos from Wikimedia Commons, credited (the user picks them by eye) */
export interface Landmark extends CardPhoto { title: string; short: string }
export const LANDMARKS: Record<Tier, Landmark> = {
  gujarat: { title: "ગુજરાતના આજના બધા સમાચાર", short: "capitalkranti.co.in/insta", credit: "Rahilarious, CC BY-SA 4.0", width: 1280, height: 1644,
             url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg/1280px-Foot_bridge_at_Ahmedabad_Sabarmati_Riverfront.jpg" },
  india: { title: "દેશના આજના બધા સમાચાર", short: "capitalkranti.co.in/insta", credit: "A.Savin, FAL", width: 1280, height: 1600,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/India_Gate_in_New_Delhi_03-2016.jpg/1280px-India_Gate_in_New_Delhi_03-2016.jpg" },
  world: { title: "વિશ્વના આજના બધા સમાચાર", short: "capitalkranti.co.in/insta", credit: "NASA, Apollo 17", width: 1280, height: 1281,
           url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/1280px-The_Earth_seen_from_Apollo_17.jpg" },
};

// ---- editions: 8 in the morning and 7 in the evening, India time; each is made an hour ahead, for the editor to look at

const india = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000);
/** the edition being made or shown now ("2026-11-03-am"), or null between them */
export function editionNow(now = new Date()): string | null {
  const t = india(now), h = t.getUTCHours(), day = t.toISOString().slice(0, 10);
  return h >= 7 && h < 13 ? `${day}-am` : h >= 18 && h < 23 ? `${day}-pm` : null;
}
export function editionName(edition: string): string {
  return `${dateText(edition.slice(0, 10), "gu")}, ${edition.endsWith("am") ? "સવાર" : "સાંજ"}`;
}

// ---- the sets in the database

const setOf = (r: Record<string, unknown>): InstaSet => ({
  id: r.id as string, edition: r.edition as string, tier: r.tier as Tier, state: r.state as SetState,
  cards: r.cards as Card[], caption: r.caption as string, image: (r.image as string) ?? null,
  madeAt: new Date(r.made_at as string).toISOString(), postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null,
  postUrl: (r.post_url as string) ?? null, note: (r.note as string) ?? "",
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
    `insert into insta_sets (id, edition, tier, state, cards, caption, image, made_at, posted_at, post_url, note)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (id) do update set state = excluded.state, cards = excluded.cards, caption = excluded.caption, image = excluded.image,
       posted_at = excluded.posted_at, post_url = excluded.post_url, note = excluded.note`,
    [s.id, s.edition, s.tier, s.state, JSON.stringify(s.cards), s.caption, s.image, s.madeAt, s.postedAt, s.postUrl, s.note]);
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
    "દરેક સમાચાર વિગતે વાંચવા: પ્રોફાઇલમાંની લિંક (capitalkranti.co.in/insta)",
    ...(credits.length ? ["", `ફોટો: ${credits.join("; ")}${credits.length ? " (Wikimedia Commons)" : ""}`] : []),
    "",
    `${TAGS[tier]} #ગુજરાતીસમાચાર #CapitalKranti #કેપિટલક્રાંતિ`,
  ].join("\n");
}

// ---- the cards' page: the chosen look (3 Nov, design 1), every size the real 1080×1350. A browser saves each card as a
// picture (engine/insta.ts); /cards/<section> shows it to look at.

const CSS = `
body{margin:0;background:#e9e4da}
.set{display:flex;flex-direction:column;gap:40px;padding:40px;font-family:'Anek Gujarati',sans-serif}
.small{zoom:.25;flex-direction:row;flex-wrap:wrap;width:4560px}
.c{position:relative;width:1080px;height:1350px;overflow:hidden;background:#0d0910;color:#fff;flex:none}
.fill{position:absolute;inset:-80px;background-size:cover;background-position:center;filter:blur(70px) brightness(.8) saturate(1.3)}
.pic{position:absolute;left:0;top:0;width:1080px;height:auto;display:block}
.wide .pic{mask-image:linear-gradient(180deg,#000 75%,transparent);-webkit-mask-image:linear-gradient(180deg,#000 75%,transparent)}
.cover{height:1350px;object-fit:cover}
.top{position:absolute;left:64px;right:64px;top:52px;display:flex;justify-content:space-between;align-items:center;text-shadow:0 1px 10px rgba(0,0,0,.55)}
.logo{font-size:44px;font-weight:800;font-stretch:80%}
.n{font-size:34px;font-weight:600;opacity:.85}
.body{position:absolute;left:0;right:0;bottom:0;padding:120px 64px 44px;background:linear-gradient(180deg,rgba(13,9,16,0) 0,rgba(13,9,16,.32) 110px,rgba(13,9,16,.48) 100%)}
.tag{display:inline-block;background:#7f3894;color:#fff;font-size:36px;font-weight:700;padding:8px 26px 4px;border-radius:6px;margin-bottom:26px}
.hl{font-size:80px;font-weight:750;font-stretch:88%;line-height:1.18;text-wrap:balance;text-shadow:0 2px 4px rgba(0,0,0,.55),0 4px 22px rgba(0,0,0,.6)}
.long{font-size:70px}.longer{font-size:62px}
.foot{margin-top:30px;color:rgba(255,255,255,.88);font-size:28px;display:flex;justify-content:space-between;gap:24px;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.endt{font-size:96px;font-weight:800;font-stretch:85%;line-height:1.1;text-shadow:0 2px 4px rgba(0,0,0,.55),0 4px 22px rgba(0,0,0,.6)}
.endu{margin-top:32px;font-size:54px;font-weight:700;text-shadow:0 1px 6px rgba(0,0,0,.7)}
.endn{margin-top:24px;font-size:40px;opacity:.9;text-shadow:0 1px 6px rgba(0,0,0,.7)}`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** a photo's address a browser anywhere can open: the site's own ones with its address in front */
const abs = (u: string) => (u.startsWith("/") ? SITE + u : u);
const wideOf = (p: CardPhoto) => (1080 * p.height) / p.width < 1350;
// a headline's size by its length, so a long one stays in the card's lower half
const size = (h: string) => (h.length > 95 ? " longer" : h.length > 70 ? " long" : "");

function picture(p: CardPhoto, cover = false): string {
  if (cover) return `<img class="pic cover" src="${esc(abs(p.url))}" alt="">`;
  return `${wideOf(p) ? `<div class="fill" style="background-image:url('${esc(abs(p.url))}')"></div>` : ""}<img class="pic" src="${esc(abs(p.url))}" alt="">`;
}

/** The whole set's page: a card per story, then the last card; `small` shows them at a quarter, to look at. */
export function cardsHtml(set: { tier: Tier; edition: string; cards: Card[] }, small = false): string {
  const total = set.cards.length + 1;
  const date = dateText(set.edition.slice(0, 10), "gu");
  const tag = `<span class="tag">${esc(sectionName(set.tier, "gu"))}</span>`;
  const top = (i: number) => `<div class="top"><span class="logo">કેપિટલ ક્રાંતિ</span><span class="n">${num(i, "gu")}/${num(total, "gu")}</span></div>`;
  const cards = set.cards.map((c, i) => {
    const p = photoOfCard(c);
    const credit = p.credit ? `ફોટો: ${p.representative ? "ફાઇલ · " : ""}${p.credit.replace(/, Wikimedia Commons$/, "")}` : "capitalkranti.co.in";
    return `<section data-card="${i + 1}" class="c${wideOf(p) ? " wide" : ""}">${picture(p)}${top(i + 1)}
      <div class="body">${tag}<div class="hl${size(c.headline)}">${esc(c.headline)}</div>
      <div class="foot"><span>${esc(date)}</span><span>${esc(credit)}</span></div></div></section>`;
  });
  const end = LANDMARKS[set.tier];
  cards.push(`<section data-card="${total}" class="c">${picture(end, true)}${top(total)}
    <div class="body">${tag}<div class="endt">${esc(end.title)}</div><div class="endu">${esc(end.short)}</div>
    <div class="endn">લિંક પ્રોફાઇલમાં ↑</div><div class="foot"><span></span><span>ફોટો: ${esc(end.credit!)}</span></div></div></section>`);
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wdth,wght@75..125,100..800&display=block">
<style>${CSS}</style></head><body><main class="set${small ? " small" : ""}">${cards.join("\n")}</main></body></html>`;
}
