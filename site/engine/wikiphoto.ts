// A free photo for a story the official sources gave none (the user, 29 Oct: the
// front page's lead must be fresh and have a photo; the outlets' photos are theirs,
// never copied). A free model names the story's one recognisable subject (a public
// figure, a place, a thing); English Wikipedia's article on it gives its main photo,
// used only when that photo is on Wikimedia Commons under a free licence and its own
// name or description names the subject (29 Oct: "Anthropic"'s was an office building
// named for another company). It's captioned as a file photo and credited to its author.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Photo } from "../lib/types.ts";
import { authorName } from "../lib/photo.ts";
import { askJson } from "./ai.ts";
import type { SourceText, Written } from "./newsroom.ts";

type Sql = NeonQueryFunction<false, false>;
// Wikimedia asks programs to name themselves and a way to reach them
export const UA = "CapitalKranti-news/1.0 (https://www.capitalkranti.co.in; news photos from Wikimedia Commons)";
// free licences: Creative Commons (BY, BY-SA, 0), public domain, and the Government Open
// Data Licence – India (most PIB and ministry photos on Commons)
export const FREE = /^(cc0|cc[ -]by(-sa)?\b|public domain|pd\b|pd-|godl)/i;

export interface FreePhoto { photo: Photo; caption: { gu: string; en: string; hi: string } }
interface Subject { title: string; gu: string; en: string; hi: string }

const ASK = `You pick the photo subject for a news story on an Indian news website.
Name the ONE subject a reader would recognise in a photo and that the story is mainly about:
a well-known public figure (head of state or government, minister, party leader, famous sportsperson or artist),
a landmark, or a thing (a rocket, a ship, a train); a city or country only when the story is about the place itself,
not about something that happened there (an attack, a disaster, a crime). Not a company or an organisation.
Never a private person, a victim, someone accused of a crime, a child, or a dead person's body.
Give the exact title of its English Wikipedia article, and its name in Gujarati, English and Hindi.
If the story has no such subject, or you are not sure of the article, answer {"title": ""}.
Reply with JSON only: {"title": "", "gu": "", "en": "", "hi": ""}`;

export async function subjectOf(sql: Sql, w: Written): Promise<Subject | null> {
  const res = await askJson(sql, { system: ASK, user: `${w.headline}\n${w.deck}\n\n${w.body.slice(0, 1500)}`, maxTokens: 300, small: true }, (v) => {
    const x = v as Partial<Subject>;
    if (typeof x?.title !== "string") return null;
    return { title: x.title.trim(), gu: (x.gu ?? "").trim(), en: (x.en ?? "").trim(), hi: (x.hi ?? "").trim() };
  });
  return res.ok && res.value.title && res.value.gu ? res.value : null;
}

/** Wikipedia's opening lines on the story's subject, for a paragraph of background when the reports are only a few lines
 *  (4 Nov: a story from a feed's three lines came out two short paragraphs). Checked like any source, so nothing in the
 *  story is from nowhere. Null when there's no clear subject or no article. */
export async function background(sql: Sql, event: string, reports: string): Promise<SourceText | null> {
  const subject = await subjectOf(sql, { kicker: "", headline: event, deck: "", body: reports, caption: "", model: "" });
  if (!subject) return null;
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(subject.title.replace(/ /g, "_"))}`,
    { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const page = r?.ok ? ((await r.json().catch(() => null)) as { type?: string; title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } } | null) : null;
  if (page?.type !== "standard" || !page.extract || page.extract.split(/\s+/).length < 25) return null;
  return { source: { id: "wikipedia", name: "Wikipedia", url: "", trust: "outlet", group: "wikipedia", lang: "en", tier: "world", hosts: ["en.wikipedia.org"] },
           url: page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(subject.title)}`,
           title: page.title ?? subject.title, text: page.extract, image: null, official: false, background: true };
}

export const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

/** The article's main photo, when it's a free one on Commons: its address (1600 px wide), its credit and what it shows. */
export async function leadPhoto(title: string): Promise<{ url: string; width: number; height: number; credit: string; about: string } | null> {
  const get = async (u: string) => {
    const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) });
    return r.ok ? r.json() : null;
  };
  const page = (await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)) as
    { type?: string; originalimage?: { source?: string } } | null;
  const src = page?.originalimage?.source;
  // only Commons: a photo kept on English Wikipedia itself may be someone's, used there as "fair use"
  if (!page || page.type !== "standard" || !src || !src.includes("/wikipedia/commons/")) return null;
  // the file's own name: the address may be a resized copy's, ".../thumb/d/db/<file>/3840px-<file>"
  const parts = new URL(src).pathname.split("/");
  const file = decodeURIComponent(parts.includes("thumb") ? parts.at(-2)! : parts.at(-1)!);
  if (!/\.(jpe?g|png|webp)$/i.test(file)) return null;
  // 1920 wide, a width Commons makes (4 Nov: Google shows a story's photo large only from 1200 wide)
  const q = new URLSearchParams({ action: "query", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1920", format: "json", origin: "*" });
  const info = (await get(`https://commons.wikimedia.org/w/api.php?${q}`)) as
    { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; width?: number; height?: number; url?: string; extmetadata?: Record<string, { value?: string }> }[] }> } } | null;
  const ii = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const licence = plain(meta.LicenseShortName?.value ?? "");
  if (!ii || !FREE.test(licence)) return null;
  // the photo itself must be of the subject: a word of its name in the file's name or description
  const bare = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const about = bare(`${file} ${plain(meta.ImageDescription?.value ?? "")} ${plain(meta.ObjectName?.value ?? "")}`);
  if (!bare(title).split(/[\s_(),-]+/).some((word) => word.length >= 4 && about.includes(word))) return null;
  const artist = authorName(plain(meta.Artist?.value ?? ""));
  return { url: ii.thumburl ?? ii.url!, width: ii.thumbwidth ?? ii.width ?? 0, height: ii.thumbheight ?? ii.height ?? 0, credit: `${artist}, ${licence}, Wikimedia Commons`,
           about: `${file.replace(/\.\w+$/, "").replace(/_/g, " ")}. ${plain(meta.ImageDescription?.value ?? "")}`.slice(0, 400) };
}

const FIT = `You check a file photo for a news story on a news website. You get the story's headline and summary, the
photo's subject, and the photo's own description from Wikimedia Commons. Answer whether the photo fits the story and
would not mislead a reader: it shows the person, place or thing the story is about, and its scene suggests nothing the
story doesn't say (a busy market or a festival beside a story about an attack or a disaster, another event, another
place of the same name). A plain portrait of a public figure in the story fits. A map, a satellite view or a general
view of a place fits a story about that place. Reply with JSON only: {"fits": true} or {"fits": false}.`;

/** Whether a file photo suits the story (2 Nov: a fruit market in Hodeidah beside a strike on its port); null when the
 *  free models couldn't say. */
const SEARCHED = `
This photo was found by searching, not taken from the subject's own article, so be strict: answer false if it shows war,
soldiers in battle, wounded, sick, dead or grieving people, a stretcher, weapons being used, an arrest, a disaster, a
historical or archive scene (old, black and white), or anything a reader could find offensive or upsetting beside this
story; false if it shows another country's or another time's version of the thing; false when unsure.`;

export async function fitsStory(sql: Sql, w: { headline: string; deck: string }, subject: string, about: string, searched = false): Promise<boolean | null> {
  const res = await askJson(sql, { system: searched ? FIT + SEARCHED : FIT, user: `STORY: ${w.headline}\n${w.deck}\n\nPHOTO SUBJECT: ${subject}\nPHOTO DESCRIPTION: ${about || "(none)"}`, maxTokens: 40, small: true },
    (v) => (typeof (v as { fits?: unknown })?.fits === "boolean" ? (v as { fits: boolean }).fits : null));
  return res.ok ? res.value : null;
}

/** Free-licence photos from a Wikipedia article (Aavtikal's explainers, the user, 29 Oct: several pictures in each),
 * shown from Wikimedia's own servers (they allow it), so they take none of the site's daily uploads: a photo or a
 * diagram, not a logo, icon, flag or map symbol, with its description for the writer and its credit. */
type CommonsPage = { title: string; index?: number; imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }[] };

/** The free-licence photos among Commons files: a photo or a diagram, not a logo, icon, flag or map symbol. */
/** A free Commons picture: a 1280-pixel copy (url, width, height) and its original's width (`full`), which says how
 *  large a copy a cover can have (bigger, below). */
export interface CommonsPicture { url: string; width: number; height: number; full: number; alt: string; credit: string }

function freeOnes(pages: CommonsPage[], max: number): CommonsPicture[] {
  const out: CommonsPicture[] = [];
  for (const pg of pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    const ii = pg.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const licence = plain(meta.LicenseShortName?.value ?? "");
    if (!ii?.thumburl || !ii.thumbwidth || !ii.thumbheight || (ii.width ?? 0) < 500 || !FREE.test(licence)) continue;
    if (!/\.(jpe?g|png)$/i.test(pg.title) || /logo|icon|flag|symbol|seal|emblem|signature|coat of arms|wordmark|map of|locator/i.test(pg.title)) continue;
    // and by what it shows (4 Nov: "National Livestock Mission logo" under a plain file name went up as a story's photo)
    if (/\b(logo|logotype|icon|emblem|seal|insignia|coat of arms|wordmark|banner|poster|infographic|screenshot)\b/i.test(plain(meta.ImageDescription?.value ?? ""))) continue;
    if (ii.thumbheight > ii.thumbwidth * 1.6 || ii.thumbwidth > ii.thumbheight * 3.5) continue;
    const alt = plain(meta.ImageDescription?.value ?? "").slice(0, 160) || pg.title.replace(/^File:|\.\w+$/g, "");
    const artist = authorName(plain(meta.Artist?.value ?? ""));
    out.push({ url: ii.thumburl, width: ii.thumbwidth, height: ii.thumbheight, full: ii.width ?? ii.thumbwidth, alt, credit: `${artist}, ${licence}, Wikimedia Commons` });
    if (out.length >= max) break;
  }
  return out;
}

/** Free-licence photos from a Wikipedia article (Aavtikal's explainers, the user, 29 Oct: several pictures in each),
 * shown from Wikimedia's own servers (they allow it), so they take none of the site's daily uploads, with their
 * descriptions for the writer and their credits. */
export async function commonsPictures(title: string, max = 6): Promise<CommonsPicture[]> {
  const q = new URLSearchParams({ action: "query", generator: "images", titles: title, gimlimit: "40", redirects: "1",
    prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1200", format: "json", origin: "*" });
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return [];
    return freeOnes(Object.values(((await r.json()) as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages ?? {}), max);
  } catch {
    return [];
  }
}

/** Free-licence photos found by searching Wikimedia Commons itself, for a subject whose Wikipedia articles have none. */
export async function commonsSearch(query: string, max = 4, width = 1200): Promise<CommonsPicture[]> {
  const q = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20",
    prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: String(width), format: "json", origin: "*" });
  try {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return [];
    return freeOnes(Object.values(((await r.json()) as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages ?? {}), max);
  } catch {
    return [];
  }
}

const PLAN = `You find a photo for a news story on an Indian news website, when the story has no photo of its own.
Answer two ways, each with a short search (2-5 English words) and what the photo shows, as a caption in Gujarati,
English and Hindi (a few words):
1. "file": a real photo on Wikimedia Commons of the ONE organisation, place or thing NAMED in the story: that company's
   own aircraft, building or product, that government body's headquarters, the named city or district for a story about
   the place itself, the named dam, train or ship. The search must contain that name. A photo of the kind of thing (any
   pharmaceutical plant, any ethanol plant, any farmer) is not a file photo: that is "symbolic". null for an accident, a
   crime, a death, a disaster, a victim, a private person, or when no such photo would be accurate.
2. "symbolic": a stock photo of the story's general topic, printed as a symbolic picture as Indian papers do: a court's
   gavel, a stock market screen, a farmer's field, a hospital ward, a classroom, rupee notes, rain on a road. Never a
   person's face, never a scene that could be taken for the event itself (no crash, wreckage, fire, blood, injured or
   dead people, no police arrest). null when nothing suits.
Reply with JSON only: {"file": {"search": "", "gu": "", "en": "", "hi": ""} or null, "symbolic": {"search": "", "gu": "", "en": "", "hi": ""} or null}`;

/** What a searched photo must never show beside the news: war, wounds, death, arrests, disasters, and old archive scenes
 *  (4 Nov: "Indian Army soldiers carry a wounded officer on a stretcher in France", a First World War photo, went up beside
 *  a story on the Agniveers' new recruitment rules). Read from the file's name and its description. */
export const UNFIT = /\b(war|wars|wartime|battle|battlefield|combat|wounded|injur\w*|casualt\w*|stretcher|corpse\w*|dead|death\w*|died|dying|killed|funeral|cremat\w*|burial|grave\w*|cemetery|memorial|martyr\w*|blood\w*|bomb\w*|blast|explosion|riot\w*|massacre|terror\w*|attack\w*|prisoner\w*|captive\w*|arrest\w*|execution|hanging|refugee\w*|famine|flood\w*|disaster|accident|crash\w*|wreck\w*|fire|burning|ruins|trench\w*|ww1|wwi|ww2|wwii|1[0-8]\d\d|19[0-7]\d|historic\w*|archive\w*|archival|vintage|black and white|monochrome)\b/i;

interface Idea { search: string; gu: string; en: string; hi: string }
const ideaOf = (v: unknown): Idea | null => {
  const x = v as Partial<Idea> | null;
  return x && typeof x.search === "string" && x.search.trim() && x.gu && x.en ? { search: x.search.trim(), gu: String(x.gu), en: String(x.en), hi: String(x.hi || x.en) } : null;
};

const SYMBOLIC_FIT = `You check a stock photo to print as a clearly labelled symbolic picture beside a news story. You get the
story's headline and summary and the photo's description. Answer whether it suits the story's topic and could not mislead:
no identifiable person who could be taken for someone in the story, nothing suggesting an event or a place the story
doesn't name. Reply with JSON only: {"fits": true} or {"fits": false}.`;

/** Free stock photos from Pexels (its own servers, which it allows; 4 Nov, the user: symbolic pictures as the papers print
 *  them), when the PEXELS_API_KEY secret is set; landscape, at least 1200 wide. */
async function pexels(search: string): Promise<{ url: string; width: number; height: number; alt: string; credit: string }[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query: search, per_page: "8", orientation: "landscape" })}`,
    { headers: { authorization: key }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) return [];
  const photos = ((await r.json().catch(() => null)) as { photos?: { width: number; height: number; alt?: string; photographer?: string; src?: { original?: string } }[] } | null)?.photos ?? [];
  return photos.filter((p) => p.src?.original && p.width >= 1200).map((p) => {
    const w = Math.min(1600, p.width);
    return { url: `${p.src!.original}?auto=compress&cs=tinysrgb&w=${w}`, width: w, height: Math.round(p.height * (w / p.width)), alt: p.alt ?? "",
             credit: `${(p.photographer ?? "").slice(0, 60) || "Photographer"}, Pexels` };
  });
}

/** Free stock photos from Unsplash (4 Nov: Pexels gave the user no key; Unsplash gives one at once, for a free developer
 *  app), when the UNSPLASH_ACCESS_KEY secret is set; landscape, at least 1200 wide, shown from Unsplash's own servers as
 *  its rules ask. `used` tells Unsplash a photo was chosen (its rules ask for that too). */
async function unsplash(search: string): Promise<{ url: string; width: number; height: number; alt: string; credit: string; creditUrl?: string; used: () => void }[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const head = { authorization: `Client-ID ${key}`, "accept-version": "v1" };
  const r = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query: search, per_page: "8", orientation: "landscape", content_filter: "high" })}`,
    { headers: head, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) return [];
  type Hit = { width: number; height: number; alt_description?: string | null; description?: string | null; user?: { name?: string; links?: { html?: string } }; urls?: { raw?: string }; links?: { download_location?: string } };
  const hits = ((await r.json().catch(() => null)) as { results?: Hit[] } | null)?.results ?? [];
  return hits.filter((p) => p.urls?.raw && p.width >= 1200).map((p) => {
    const w = Math.min(1600, p.width);
    const url = new URL(p.urls!.raw!);
    for (const [k, v] of Object.entries({ w: String(w), q: "80", fm: "jpg", fit: "max" })) url.searchParams.set(k, v);
    return { url: url.href, width: w, height: Math.round(p.height * (w / p.width)), alt: p.alt_description || p.description || "",
             credit: `${(p.user?.name ?? "").slice(0, 60) || "Photographer"}, Unsplash`,
             creditUrl: p.user?.links?.html ? `${p.user.links.html}?utm_source=capital_kranti&utm_medium=referral` : undefined,
             used: () => { if (p.links?.download_location) void fetch(p.links.download_location, { headers: head, signal: AbortSignal.timeout(10_000) }).catch(() => null); } };
  });
}

/** A photo for a story without one, shown from Wikimedia's, Unsplash's or Pexels' own servers (4 Nov: storing each took one of the
 *  site's 50 uploads a day, while some 700 stories went up, and four in five had no photo):
 *  1. the subject's own photo, as before (a public figure, a landmark: its Wikipedia article's photo);
 *  2. a Commons photo of the organisation, place or thing the story is about;
 *  3. a stock photo of its topic, labelled symbolic.
 *  Each is checked against the story before it goes up. `note` hears why there's none. */
export async function freePhoto(sql: Sql, w: Written, storyId: string, note: (why: string) => void = () => {}): Promise<FreePhoto | null> {
  void storyId;
  const story = { headline: w.headline, deck: w.deck };
  try {
    const who = await subjectOf(sql, w);
    if (who) {
      const found = await leadPhoto(who.title);
      if (found && found.width && (await fitsStory(sql, story, who.en || who.title, found.about)) === true) {
        return { photo: { url: found.url, width: found.width, height: found.height, credit: found.credit },
                 caption: { gu: `ફાઇલ ફોટો: ${who.gu}`, en: `File photo: ${who.en || who.title}`, hi: `फ़ाइल फ़ोटो: ${who.hi || who.en || who.title}` } };
      }
    }
    const plan = await askJson(sql, { system: PLAN, user: `${w.headline}\n${w.deck}\n\n${w.body.slice(0, 1200)}`, maxTokens: 400, small: true },
      (v) => (v && typeof v === "object" ? { file: ideaOf((v as { file?: unknown }).file), symbolic: ideaOf((v as { symbolic?: unknown }).symbolic) } : null));
    if (!plan.ok) { note("the free models were busy"); return null; }
    const { file, symbolic } = plan.value;
    if (file) {
      const found = await commonsSearch(file.search, 6, 1920);
      // the widest first: from 1200, Google shows a story's photo large
      for (const p of found.filter((p) => !UNFIT.test(`${p.url.replace(/%[0-9a-f]{2}|[_/]/gi, " ")} ${p.alt}`))
        .sort((a, b) => Number(b.full >= 1200) - Number(a.full >= 1200)).slice(0, 2)) {
        if ((await fitsStory(sql, story, file.en, `${p.alt} (file: ${(p.url.split("/").pop() ?? "").replace(/%[0-9a-f]{2}|_/gi, " ")})`, true)) !== true) continue;
        const big = commonsAt(p, 1920);
        return { photo: { url: big.url, width: big.width, height: big.height, credit: p.credit },
                 caption: { gu: `ફાઇલ ફોટો: ${file.gu}`, en: `File photo: ${file.en}`, hi: `फ़ाइल फ़ोटो: ${file.hi}` } };
      }
    }
    if (symbolic) {
      // Pexels' stock photos when its key is set, and free Commons photos of the kind of thing either way (4 Nov: a
      // Pennsylvania drug plant went up as a "file photo" beside an Indian drug maker's story; it is a symbolic picture)
      // two at most asked about (4 Nov: up to ten questions a story, for sixteen stories a round, used up the free models)
      const stock: { url: string; width: number; height: number; alt: string; credit: string; creditUrl?: string; used?: () => void }[] = [
        ...(await unsplash(symbolic.search)).slice(0, 2), ...(await pexels(symbolic.search)).slice(0, 2),
        ...(await commonsSearch(symbolic.search, 4, 1920)).sort((a, b) => Number(b.full >= 1200) - Number(a.full >= 1200)).slice(0, 2)
          .map((p) => ({ ...commonsAt(p, 1920), alt: p.alt, credit: p.credit }))];
      for (const p of stock.filter((p) => !UNFIT.test(`${p.url.replace(/%[0-9a-f]{2}|[_/]/gi, " ")} ${p.alt}`)).slice(0, 2)) {
        const ok = await askJson(sql, { system: SYMBOLIC_FIT + SEARCHED, user: `STORY: ${w.headline}\n${w.deck}\n\nPHOTO: ${p.alt || symbolic.en}`, maxTokens: 40, small: true },
          (v) => (typeof (v as { fits?: unknown })?.fits === "boolean" ? (v as { fits: boolean }).fits : null));
        if (!ok.ok || !ok.value) continue;
        p.used?.();
        return { photo: { url: p.url, width: p.width, height: p.height, credit: p.credit, ...(p.creditUrl ? { creditUrl: p.creditUrl } : {}) },
                 caption: { gu: `પ્રતીકાત્મક તસવીર: ${symbolic.gu}`, en: `Representative image: ${symbolic.en}`, hi: `प्रतीकात्मक तस्वीर: ${symbolic.hi}` } };
      }
      note(file ? "no file or symbolic photo suited" : `no symbolic photo suited${process.env.UNSPLASH_ACCESS_KEY || process.env.PEXELS_API_KEY ? "" : " (the stock photos wait for their key)"}`);
      return null;
    }
    note(file ? "no file photo suited, and no symbolic one fits this story" : "no photo would be accurate (an accident, a crime, a person)");
    return null;
  } catch (e) {
    note(`failed: ${e instanceof Error ? e.message : e}`.slice(0, 80));
    return null;
  }
}

/** A Commons copy of another width, from Wikimedia's steps (960 for a look, 1920 for a cover; 30 Oct: 640 and 2560
 *  are refused): the original itself when it is narrower. */
export function commonsAt(p: { url: string; width: number; height: number; full: number }, w: 960 | 1920): { url: string; width: number; height: number } {
  if (!/\/thumb\//.test(p.url) || !/\/\d+px-/.test(p.url)) return p;
  if (p.full <= w) {
    // originals are only on upload.wikimedia.org (30 Oct: thumb.wikimedia.org sends them to Commons' front page, a broken picture)
    const orig = p.url.replace("//thumb.wikimedia.org/", "//upload.wikimedia.org/").replace("/thumb/", "/").replace(/\/\d+px-[^/]+$/, "").replace(/\?.*$/, "");
    return { url: orig, width: p.full, height: Math.round(p.height * (p.full / p.width)) };
  }
  return { url: p.url.replace(/\/\d+px-/, `/${w}px-`).replace(/\?.*$/, ""), width: w, height: Math.round(p.height * (w / p.width)) };
}
