// Steps 3 and 5 (ROADMAP §3, §3.1-3.2): is the event genuine, then a Gujarati
// story in the house style, checked claim by claim by a different free model,
// then English and Hindi for national and world news. Pure of the database:
// run.ts brings the cluster's items in and stores what comes out, and
// try.ts runs the same steps on live items without storing anything.
import { numbersNotIn, repeats } from "./text.ts";
import { askGemini, askJson, geminiRemaining } from "./ai.ts";
import { ask } from "./fetch.ts";
import { pageText } from "./feed.ts";
import { pibRelease } from "./pib.ts";
import { keySet, similarity, type Triage } from "./triage.ts";
import { sourceById, type SourceDef } from "./sources.ts";
import type { English, Tier } from "../lib/types.ts";
import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

export interface ClusterItem {
  id: string; source: string; url: string; title: string; summary: string; lang: string;
  publishedAt: string | null; seenAt: string; image: string | null; triage: Triage;
}
export interface Debunk { claim: string; keys: string[]; url: string; source: string }

// ---- §3.1: the checks before writing ----

/** Older than this, an item isn't today's news (old news going round again). */
export const STALE_H = 48;

export type Gate =
  | { state: "confirmed"; groups: string[]; official: boolean; why: string }
  | { state: "dropped" | "blocked"; why: string; debunk?: Debunk };

export function gate(items: ClusterItem[], debunks: Debunk[]): Gate {
  // step 3: only fresh items count; all stale = old news recirculating
  const fresh = items.filter((it) => Date.now() - Date.parse(it.publishedAt ?? it.seenAt) < STALE_H * 3600_000);
  if (!fresh.length) return { state: "dropped", why: "old news (every report is more than 2 days old)" };
  // step 6: already debunked by a fact-checker
  const keys = keySet(fresh.flatMap((it) => it.triage.keys));
  for (const d of debunks) {
    const s = similarity(keys, keySet(d.keys));
    if (s >= 0.6 && [...keySet(d.keys)].filter((k) => keys.has(k)).length >= 3) {
      return { state: "blocked", why: `a fact-checker (${d.source}) says this is false: ${d.claim}`, debunk: d };
    }
  }
  // steps 1 and 4: who said it. One listed source is enough (the user, 2 Nov: outlets no longer wait for a second one,
  // which dropped most of each day's news); the checks above and the story's own checks against its source still stand
  const defs = fresh.map((it) => sourceById.get(it.source)).filter((s): s is SourceDef => !!s);
  const official = defs.some((s) => s.trust === "official");
  const groups = [...new Set(defs.filter((s) => s.trust !== "factcheck").map((s) => s.group))];
  if (official) return { state: "confirmed", groups, official, why: "from an official source" };
  if (!groups.length) return { state: "dropped", why: "no listed news source reports it" };
  return { state: "confirmed", groups, official, why: groups.length === 1 ? "one listed outlet reports it" : `${groups.length} independent outlets report it` };
}

// ---- how big a story it is ----

export type Level = "lead" | "top" | "normal" | "brief";
export function importance(maxScore: number, tier: Tier, groups: number, official: boolean): number {
  const weight = tier === "gujarat" ? 1.15 : tier === "world" ? 0.85 : 1;
  return Math.round((maxScore * weight + Math.log2(Math.max(1, groups)) * 0.8 + (official ? 0.4 : 0)) * 10) / 10;
}
export const levelOf = (imp: number): Level | null => (imp >= 9.5 ? "lead" : imp >= 7.5 ? "top" : imp >= 5 ? "normal" : imp >= 3 ? "brief" : null);
// longer, like the sources themselves (the user, 29 Oct: "can't it have the original length?")
const WORDS: Record<Level, [number, number]> = { lead: [450, 700], top: [400, 600], normal: [250, 400], brief: [100, 160] };

// ---- gathering the facts ----

export interface SourceText { source: SourceDef; url: string; title: string; text: string; image: string | null; official: boolean;
  /** Wikipedia's lines on the story's subject: background only, never the news (engine/wikiphoto.ts background()) */
  background?: boolean }

/** How much of the sources the writer and the checker read: each one's start, up to these many letters, and all of them
 *  together (5 Nov: up to 24,000 letters went to both, most of a minute of a Gemma's 16,000 tokens for one story, twice;
 *  the facts are in a report's first paragraphs, an official release's a little further down) */
const SOURCE_CHARS = { official: 6000, outlet: 4000 };
const ALL_CHARS = 14_000;

/** Each report's text: an official page's start; an outlet's article as facts
 * only (its summary, and its page where robots.txt allows). At most 5. */
export async function gather(items: ClusterItem[]): Promise<SourceText[]> {
  const byTrust = [...items].sort((a, b) =>
    Number(sourceById.get(b.source)?.trust === "official") - Number(sourceById.get(a.source)?.trust === "official"));
  const seenGroups = new Set<string>();
  const out: SourceText[] = [];
  for (const it of byTrust) {
    const source = sourceById.get(it.source);
    if (!source || source.trust === "factcheck") continue;
    if (seenGroups.has(source.group) && out.length >= 2) continue;
    seenGroups.add(source.group);
    let text = it.summary;
    let image: string | null = null;
    if (it.url.includes("pib.gov.in")) {
      const r = await pibRelease(it.url);
      if (r) { text = r.text; image = r.photos[0] ?? null; }
    } else {
      const page = await ask(it.url);
      if (page.status === 200) {
        const p = pageText(page.text);
        if (p.text.length > text.length) text = p.text;
        image = p.image;
      }
    }
    // pictures only from official sources (§2): an outlet's photo is never used
    const room = ALL_CHARS - out.reduce((n, s) => n + s.text.length, 0);
    const cut = Math.min(room, source.trust === "official" ? SOURCE_CHARS.official : SOURCE_CHARS.outlet);
    out.push({ source, url: it.url, title: it.title, text: clip(text, cut), image: source.trust === "official" ? image : null, official: source.trust === "official" });
    if (out.length >= 5 || room - out[out.length - 1].text.length < 800) break;
  }
  return out;
}

/** a text's start, ended at a paragraph or a sentence rather than mid-word */
function clip(text: string, most: number): string {
  if (text.length <= most) return text;
  const head = text.slice(0, most);
  const end = Math.max(head.lastIndexOf("\n\n"), head.lastIndexOf(". "), head.lastIndexOf("। "));
  return end > most * 0.6 ? head.slice(0, end + 1).trim() : head;
}

const sourcesBlock = (src: SourceText[]) => src.map((s, k) => s.background
  ? `SOURCE ${k + 1} (BACKGROUND from Wikipedia, about ${s.title}: for one short paragraph of who or what this is; never today's news):\n${s.text}`
  : `SOURCE ${k + 1} (${s.source.name}, ${s.official ? "official" : "news outlet"}, ${s.source.lang}):\n${s.title}\n${s.text}`).join("\n\n---\n\n");

// ---- step 5: the Gujarati story ----

export interface Written { kicker: string; headline: string; deck: string; body: string; caption: string; model: string }

/** How long the story is: at least as long as its longest source (the user, 29 Oct), never shorter than its
 *  level asks, and up to 1,200 words (as much as a free model writes well in one answer). */
const wordsIn = (s: SourceText) => s.text.split(/\s+/).filter(Boolean).length;
/** the news sources' longest, in words (the background isn't news) */
const longestNews = (src: SourceText[]) => Math.max(0, ...src.filter((s) => !s.background).map(wordsIn));
/** Its sources are shorter than its level's story (a feed's few lines): more is looked for before it's written (engine/run.ts). */
export const thin = (level: Level, src: SourceText[]) => longestNews(src) < WORDS[level][0];

export function lengthFor(level: Level, src: SourceText[]): [number, number] {
  const longest = longestNews(src);
  // a paragraph of background, when Wikipedia gave some (4 Nov: a story from a feed's three lines was two short paragraphs)
  const bg = src.find((s) => s.background);
  const extra = bg ? Math.min(120, Math.round(wordsIn(bg) * 0.5)) : 0;
  // sources shorter than the level's length (a feed's three-line summary): the story as long as they are, not padded out to
  // the level's (4 Nov: 250 words asked from 60, the writer filled them with lines no source said and the check failed
  // over half the stories)
  if (longest < WORDS[level][0]) {
    const lo = Math.max(WORDS.brief[0] * 0.8, Math.round(longest * 0.9) + extra);
    return [lo, Math.round(lo * 1.4)];
  }
  const lo = Math.min(1200, longest);
  return [lo, Math.min(1500, Math.max(WORDS[level][1], Math.round(lo * 1.25)))];
}

const WRITER = (lo: number, hi: number) => {
  return `તમે ગાંધીનગરના ગુજરાતી દૈનિક "કેપિટલ ક્રાંતિ"ની વેબસાઇટના ઉપતંત્રી છો.
You write ONE news story in Gujarati from the sources given, for the website.
Rules:
- Use ONLY facts stated in the sources. Never add a fact, number, name, quote or cause that isn't in them. If sources differ, say so or use the official one.
- Write in your own words: never copy a sentence from a source. Quote people only where a source quotes them, and keep the quote's meaning exactly.
- House style: headline (active, specific, no exclamation marks, up to 12 words) > deck (one line: the next most important fact) > body.
- Body: ${lo}-${hi} words, the most important fact first, short paragraphs separated by a blank line. Plain, clear Gujarati.
  Tell the whole story the sources tell, at least as fully as the longest source: every fact, the background they give,
  what happens next, who said what. A reader should not need to open the sources. Never pad with anything not in them.
- A BACKGROUND source (Wikipedia) is for one short paragraph near the end on who or what the subject is (their role, past
  record), in the past tense. Never present it as today's news, and never mix its facts into the news itself.
- kicker: 1-3 words naming the topic or place, or "".
- caption: one line for the photo if a source has an official photo, else "".
- Numbers in Gujarati digits (૦-૯) as the paper prints them, with ₹, કરોડ and લાખ as Indian papers write them. Keep every number exactly as the source has it.
- Never mention AI, and never say "according to sources" vaguely: name the source (e.g. "PIB મુજબ", "બીબીસીના અહેવાલ મુજબ").
Reply with JSON only: {"kicker":"","headline":"","deck":"","body":"","caption":""}`;
};

const checkWritten = (v: unknown) => {
  const x = v as Partial<Written>;
  if (!x?.headline || typeof x.body !== "string" || x.body.length < 80) return null;
  const g = (s: unknown) => String(s ?? "").trim();
  const gu = (x.headline + x.body).match(/[઀-૿]/g)?.length ?? 0;
  if (gu < (x.headline + x.body).replace(/\s/g, "").length * 0.5) return null; // not in Gujarati
  return { kicker: g(x.kicker), headline: g(x.headline), deck: g(x.deck), body: g(x.body).replace(/\n{3,}/g, "\n\n"), caption: g(x.caption) };
};

/** Word runs of 7 a story shares with one Gujarati source, as a share of the story's: copied wording. */
export function copiedShare(story: string, source: string): number {
  const runs = (t: string) => { const w = t.split(/\s+/).filter(Boolean); const out = new Set<string>(); for (let i = 0; i + 7 <= w.length; i++) out.add(w.slice(i, i + 7).join(" ")); return out; };
  const a = runs(story), b = runs(source);
  if (!a.size) return 0;
  let both = 0;
  for (const r of a) if (b.has(r)) both++;
  return both / a.size;
}

export interface Claim { claim: string; supported: boolean; where: string; sentence?: string }
export interface Checked { ok: boolean; problems: string[]; claims: Claim[]; model?: string; busy?: boolean; cut?: number }

const CHECKER = `You are the fact-checking desk of Capital Kranti, a Gujarati newspaper.
You get a Gujarati news story, each sentence marked with its label ([K] kicker, [H] headline, [D] deck, [S1], [S2] ... the
body, [C] caption), and the sources it was written from. List every checkable claim in the story (who, what, where, when,
how many, quotes) in English, and for each say whether the sources clearly support it and which sentence makes it.
A claim is supported only if a source states it (numbers must match exactly). Be strict: anything added, exaggerated, or guessed is NOT supported.
Reply with JSON only: {"claims":[{"claim":"...","supported":true,"where":"SOURCE 1","sentence":"S3"}],"all_supported":true}`;

/** A story's body as sentences, each with its paragraph: a piece of fewer than three words (an abbreviation's "ડૉ.")
 *  stays with the next. */
export function sentencesOf(body: string): { p: number; text: string }[] {
  const out: { p: number; text: string }[] = [];
  body.split(/\n\s*\n/).forEach((para, p) => {
    let carry = "";
    for (const piece of para.trim().split(/(?<=[.!?।])\s+/)) {
      const t = carry ? `${carry} ${piece}` : piece;
      if (t.split(/\s+/).length < 3) { carry = t; continue; }
      out.push({ p, text: t });
      carry = "";
    }
    if (carry) out.length && out[out.length - 1].p === p ? (out[out.length - 1].text += ` ${carry}`) : out.push({ p, text: carry });
  });
  return out;
}

/** The story with each sentence labelled, for the checker. */
const labelled = (w: Written) => [
  w.kicker && `[K] ${w.kicker}`, `[H] ${w.headline}`, w.deck && `[D] ${w.deck}`,
  sentencesOf(w.body).map((x, i) => `[S${i + 1}] ${x.text}`).join(" "), w.caption && `[C] ${w.caption}`,
].filter(Boolean).join("\n\n");

/** The story without the sentences the check found unsupported (4 Nov: rewritten whole, a story cost two more requests and
 *  often failed again; most failures were a line or two of padding). Null when it can't be done by cutting: an unsupported
 *  claim in the headline or the deck, one the checker didn't place, or too little left. */
export function cutUnsupported(w: Written, claims: Claim[], least: number): { written: Written; cut: number } | null {
  const bad = claims.filter((c) => !c.supported);
  if (!bad.length) return null;
  const at = bad.map((c) => String(c.sentence ?? "").trim().toUpperCase().replace(/^\[|\]$/g, ""));
  if (at.some((x) => !/^(S\d+|K|C)$/.test(x))) return null;
  const sents = sentencesOf(w.body);
  const drop = new Set(at.filter((x) => x.startsWith("S")).map((x) => Number(x.slice(1)) - 1));
  if ([...drop].some((i) => i < 0 || i >= sents.length)) return null;
  const kept = sents.filter((_, i) => !drop.has(i));
  const body = [...new Set(kept.map((x) => x.p))].map((p) => kept.filter((x) => x.p === p).map((x) => x.text).join(" ")).join("\n\n");
  if (body.split(/\s+/).filter(Boolean).length < least) return null;
  return { written: { ...w, body, kicker: at.includes("K") ? "" : w.kicker, caption: at.includes("C") ? "" : w.caption }, cut: drop.size };
}

// Gujarati doubles some words on purpose ("ધીમે ધીમે", "જુદા જુદા"); any other word twice in a row in a headline or
// summary is a model's slip (5 Nov: "વિધિસર વિધિસર" reached a summary)
const MEANT_TWICE = new Set(["ધીમે", "જુદા", "જુદી", "જુદાં", "અલગ", "અલગ-અલગ", "સાથે", "ઘર", "ગામ", "ઠેર", "વારે", "ક્યારે", "કોઈ", "જેમ",
  "થોડા", "થોડું", "થોડી", "નવા", "નવી", "મોટા", "મોટી", "રોજ", "ફરી", "દૂર", "આગળ", "પાસે", "ઉપર", "નીચે", "હાથ", "જ્યાં", "ત્યાં", "બે", "એક"]);
export function doubledWord(text: string): string | null {
  for (const line of text.split("\n")) {
    const ws = line.split(/\s+/).map((x) => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "")).filter(Boolean);
    for (let i = 1; i < ws.length; i++) if (ws[i] === ws[i - 1] && ws[i].length > 1 && !MEANT_TWICE.has(ws[i])) return ws[i];
  }
  return null;
}

/** Steps 5 and 7: the story's numbers by code, then every claim by a different free model. */
export async function check(sql: Sql | null, w: Written, src: SourceText[], date: string): Promise<Checked> {
  const problems: string[] = [];
  const all = src.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  const text = [w.kicker, w.headline, w.deck, w.body, w.caption].join("\n\n");
  // an outlet's own name counts as known: the 9 of "ટીવી9" is no figure (1 Nov: it failed story after story)
  const wrong = numbersNotIn(text, `${all}\n\n${src.map((s) => s.source.name).join("\n")}`, date);
  if (wrong.length) problems.push(`numbers not in any source: ${wrong.join(", ")}`);
  if (repeats(w.body)) problems.push("says the same thing twice");
  const doubled = doubledWord(`${w.headline}\n${w.deck}`);
  if (doubled) problems.push(`the same word twice in a row in the headline or summary: "${doubled} ${doubled}"`);
  // letters from another script inside the Gujarati (29 Oct: Telugu letters mid-sentence) are a model's slip
  // and English letters after Gujarati ones in a word (1 Nov: "નini" for "નવ" reached a headline; "CCIની" is fine)
  // and Russian, Greek, Arabic, Thai, Chinese, Japanese or Korean letters, or a stray accent (4 Nov: "виста́р" reached a headline)
  const stray = `${w.headline} ${w.deck} ${w.body}`.match(new RegExp(`[${OTHER}_]+|[\u0A80-\u0AFF]+[A-Za-z]+`, "g"));
  if (stray) problems.push(`letters from another script: ${[...new Set(stray)].slice(0, 3).join(", ")}`);
  for (const s of src.filter((s) => s.source.lang === "gu")) {
    const share = copiedShare(w.body, s.text);
    if (share > 0.12) problems.push(`copies ${Math.round(share * 100)}% of ${s.source.name}'s wording`);
  }
  // the code's own checks failed: the story goes back now, without a model's minutes on a version that can't go up
  if (problems.length) return { ok: false, problems, claims: [] };
  const ask = { system: CHECKER, user: `STORY:\n${labelled(w)}\n\n===\n\n${sourcesBlock(src)}`, role: "checker" as const, avoid: w.model, maxTokens: 6000 };
  const read = (v: unknown) => {
    const x = v as { claims?: Claim[] };
    if (!Array.isArray(x?.claims) || !x.claims.length) return null;
    return x.claims.map((c) => ({ claim: String(c.claim ?? ""), supported: c.supported === true, where: String(c.where ?? ""), sentence: String(c.sentence ?? "") }));
  };
  // every Gemma down or its day used up: Gemini Flash checks, before the paid Gemma, a different model from the Flash Lite that writes, keeping
  // Aavtikal's last ten (4 Nov: Google's Gemmas said "exceeded your current quota" in the evening, and stories written by
  // Flash Lite waited for a check that no model gave)
  const res = await askJson(sql, ask, read, async () => (sql && (await geminiRemaining(sql, "writer")) > WRITER_KEPT
    ? askGemini(sql, "writer", ask, read, { wait: false, timeoutMs: 90_000 }) : null));
  if (!res.ok) return { ok: false, problems: [...problems, `the second check didn't answer (${res.why})`], claims: [], busy: res.busy || /busy/.test(res.why) };
  const unsupported = res.value.filter((c) => !c.supported);
  for (const c of unsupported) problems.push(`not in the sources: ${c.claim}`);
  return { ok: problems.length === 0, problems, claims: res.value, model: res.model };
}

/** letters no Gujarati story has: Indian scripts but Gujarati, and Russian, Greek, Arabic, Thai, East Asian, a loose accent */
const OTHER = "\\u0300-\\u036F\\u0370-\\u03FF\\u0400-\\u04FF\\u0600-\\u06FF\\u0900-\\u097F\\u0980-\\u0A7F\\u0B00-\\u0DFF\\u0E00-\\u0E7F\\u3040-\\u30FF\\u4E00-\\u9FFF\\uAC00-\\uD7AF";
export const STRAY = new RegExp(`[${OTHER}]|[\\u0A80-\\u0AFF][A-Za-z]`);
const MEND = `You fix Gujarati spelling. You get a JSON list of words from a Gujarati news story that slipped into another script.
Write each one in Gujarati letters, keeping its sound: names stay the same names. Change nothing else.
Reply with JSON only: {"words":{"the word as given":"the word in Gujarati letters"}}`;

/** Hindi letters as Gujarati ones: the two alphabets sit in the same order, so this needs no model (2 Nov: "नीलेकणि" failed a story
 *  when it reads નીલેકણિ). A Hindi full stop becomes a full stop. */
export const toGujarati = (s: string) => s.replace(/[\u0964\u0965]/g, ".").replace(/[\u0900-\u097F]/g, (c) => {
  const g = String.fromCharCode(c.charCodeAt(0) + 0x180);
  return /\p{Script=Gujarati}/u.test(g) ? g : c;
});

/** A few words in another script (1 Nov: Hindi names in a Gujarati story, one failure in four) put into Gujarati letters, at
 *  once, instead of the whole story being thrown away. The story is checked afterwards like any other. */
export async function mendLetters(sql: Sql | null, written: Written): Promise<Written> {
  const w = { ...written, kicker: toGujarati(written.kicker), headline: toGujarati(written.headline), deck: toGujarati(written.deck), body: toGujarati(written.body), caption: toGujarati(written.caption) };
  const words = [...new Set([w.kicker, w.headline, w.deck, w.body, w.caption].join(" ").split(/[\s,.;:!?()'"‘’“”।—-]+/).filter((x) => STRAY.test(x)))];
  if (!sql || !words.length) return w;
  const res = await askGemini(sql, "lite", { system: MEND, user: JSON.stringify(words), maxTokens: 2000, temperature: 0 }, (v) => {
    const map = (v as { words?: Record<string, unknown> })?.words;
    return map ? Object.fromEntries(Object.entries(map).filter(([k, x]) => words.includes(k) && typeof x === "string" && x && !STRAY.test(x))) as Record<string, string> : null;
  }, { wait: false, timeoutMs: 30_000 });
  if (!res.ok) return w;
  const swap = (s: string) => Object.entries(res.value).reduce((t, [x, y]) => t.split(x).join(y), s);
  return { ...w, kicker: swap(w.kicker), headline: swap(w.headline), deck: swap(w.deck), body: swap(w.body), caption: swap(w.caption) };
}

const FACTS = `You take notes for a news writer. From the sources given, list every fact as a short note in English, in your own words:
who, what, where, when, how many, why, what happens next, who said what. Keep every number exactly, and write people's and places' names
as the source writes them. Leave nothing out and add nothing. Reply with JSON only: {"facts":["..."]}`;

/** The sources as notes (2 Nov: with one Gujarati source to go on, the writer copied its sentences, up to 69%, in story after
 *  story; it can't copy wording it never sees). The story is still checked against the sources themselves. */
async function factsOf(sql: Sql, src: SourceText[]): Promise<string | null> {
  const res = await askGemini(sql, "lite", { system: FACTS, user: sourcesBlock(src), maxTokens: 6000, temperature: 0.1 }, (v) => {
    const facts = (v as { facts?: unknown })?.facts;
    return Array.isArray(facts) && facts.length >= 3 && facts.every((f) => typeof f === "string") ? (facts as string[]) : null;
  }, { wait: false, timeoutMs: 60_000 });
  return res.ok ? `NOTES ON THE FACTS (from ${src.map((s) => s.source.name).join(", ")}; use all of them and only them):\n${res.value.map((f) => `- ${f}`).join("\n")}` : null;
}

/** Write, check, and (once) rewrite with the problems named. */
/** Flash Lite requests left for Aavtikal and the translations before the news goes back to writing with a Gemma */
const LITE_KEPT = 300;
/** below the 300, Flash Lite still writes when every Gemma is down, down to its last 100 (4 Nov: a busy afternoon left 287,
 *  Google's Gemmas answered "500 Internal error" all evening, and no story went up for two hours) */
const LITE_FLOOR = 100;
/** Gemini Flash requests kept for Aavtikal's articles when it checks the news */
const WRITER_KEPT = 10;

export async function writeChecked(sql: Sql | null, src: SourceText[], level: Level, date: string, event: string) {
  const [lo, hi] = lengthFor(level, src);
  let note = "";
  let last: { w: Written; c: Checked } | null = null;
  const lite = !!sql && (await geminiRemaining(sql, "lite")) > LITE_KEPT;
  const brief = (lite && src.some((s) => s.source.lang === "gu") && (await factsOf(sql, src))) || sourcesBlock(src);
  for (let attempt = 0; attempt < 2; attempt++) {
    const ask = { system: WRITER(lo, hi), user: `EVENT: ${event}\n\n${brief}${note}`, role: "writer" as const, temperature: 0.3, maxTokens: 12000 };
    // Flash Lite writes, a Gemma when it can't (the user, 1 Nov: a Gemma took minutes a story and often failed); never the
    // last of its day, which Aavtikal shares. A Gemma still does the checking, so the checker is never the writer.
    const res = lite
      ? await askGemini(sql, "lite", ask, checkWritten, { wait: false, timeoutMs: 90_000 }).then((r) => (r.ok ? r : askJson(sql, ask, checkWritten)))
      : await askJson(sql, ask, checkWritten, async () => (sql && (await geminiRemaining(sql, "lite")) > LITE_FLOOR
        ? askGemini(sql, "lite", ask, checkWritten, { wait: false, timeoutMs: 90_000 }) : null));
    if (!res.ok) return { ok: false as const, why: res.why, stop: res.stop, retry: res.busy };
    const w = await mendLetters(sql, { ...res.value, model: res.model });
    // far shorter than the sources allow (29 Oct: a £10 billion package told in two paragraphs): written again once, before checking
    const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
    if (attempt === 0 && words(w.body) < lo * 0.75) {
      note = `\n\nYOUR LAST VERSION WAS ONLY ${words(w.body)} WORDS. The sources say much more: write the full story, ${lo} words or more, with every fact from them.`;
      continue;
    }
    const c = await check(sql, w, src, date);
    // the checker couldn't run (every Gemma busy): the event waits for the next run, not the editor
    if (c.busy) return { ok: false as const, why: c.problems.join("; "), retry: true };
    last = { w, c };
    if (c.ok) return { ok: true as const, written: w, checked: c };
    // only a few lines the sources don't hold (the code's own checks passed): those lines come out and the rest goes up
    const trimmed = c.problems.every((p) => p.startsWith("not in the sources:")) ? cutUnsupported(w, c.claims, Math.max(WORDS.brief[0] * 0.6, lo * 0.5)) : null;
    if (trimmed) return { ok: true as const, written: trimmed.written,
      checked: { ...c, ok: true, problems: [], claims: c.claims.filter((x) => x.supported), cut: trimmed.cut } };
    note = `\n\nYOUR LAST VERSION HAD THESE PROBLEMS -- fix every one, using only what the sources say:\n- ${c.problems.join("\n- ")}`;
  }
  return { ok: false as const, why: last!.c.problems.join("; "), written: last!.w, checked: last!.c };
}

// ---- §3.2: English and Hindi for every story (the user, 29 Oct: the other languages show everything in them) ----

const TRANSLATE = (lang: "en" | "hi") => `You translate a Gujarati news story for Capital Kranti's website into ${lang === "en" ? "English, in the style of a careful Indian English newspaper" : "Hindi (Devanagari), in the style of a careful Hindi newspaper"}.
Keep every fact, name and number exactly; write numbers in figures as the Gujarati does (₹8,941 crore, 2.5 lakh${lang === "hi" ? "; Hindi uses करोड़ and लाख" : ""}); keep paragraphs separated by a blank line; translate an empty field as "". Add nothing, leave nothing out.
Reply with JSON only: {"kicker":"","headline":"","deck":"","body":"","caption":""}`;

export const needsTranslation = (_tier: Tier) => true;
/** a Gujarati letter: in an English or Hindi translation, a sign the model didn't translate */
export const GUJARATI = /[઀-૿]/;

const TRANSLATE_BOTH = `You translate a Gujarati news story for Capital Kranti's website into English, in the style of a careful Indian English
newspaper, and into Hindi (Devanagari), in the style of a careful Hindi newspaper.
Keep every fact, name and number exactly; write numbers in figures as the Gujarati does (₹8,941 crore, 2.5 lakh; Hindi uses करोड़ and
लाख); keep paragraphs separated by a blank line; translate an empty field as "". Add nothing, leave nothing out.
Reply with JSON only: {"en":{"kicker":"","headline":"","deck":"","body":"","caption":""},"hi":{"kicker":"","headline":"","deck":"","body":"","caption":""}}`;

/** A translation as given, or null when it isn't one: still Gujarati, wholly or in part (2 Nov: a model gave the Gujarati back,
 *  it was kept as the English and Hindi, and the story stayed Gujarati on /en and /hi), or Hindi with no Devanagari */
function translationOf(v: unknown, lang: "en" | "hi"): English | null {
  const x = v as Partial<English>;
  if (!x?.headline || typeof x.body !== "string") return null;
  if (GUJARATI.test([x.kicker, x.headline, x.deck, x.body].join(" "))) return null;
  if (lang === "hi" && !(/[ऀ-ॿ]/.test(x.headline) && /[ऀ-ॿ]/.test(x.body))) return null;
  return { kicker: x.kicker ?? "", headline: x.headline, deck: x.deck ?? "", body: x.body, caption: x.caption ?? "" };
}

/** English and Hindi in one request (5 Nov: one each was two of Flash Lite's 1,000 a day for every story); a language that
 *  comes back wrong, or with numbers the Gujarati hasn't, is asked for again on its own. */
export async function translateBoth(sql: Sql | null, w: Written, date: string): Promise<{ en: English | null; hi: English | null }> {
  const source = [w.kicker, w.headline, w.deck, w.body, w.caption].join("\n\n");
  const a = { system: TRANSLATE_BOTH, user: JSON.stringify({ kicker: w.kicker, headline: w.headline, deck: w.deck, body: w.body, caption: w.caption }), maxTokens: 20000 };
  const take = (v: unknown) => {
    const x = v as { en?: unknown; hi?: unknown };
    const en = translationOf(x?.en, "en"), hi = translationOf(x?.hi, "hi");
    return en || hi ? { en, hi } : null;
  };
  const res = sql && (await geminiRemaining(sql, "lite")) > LITE_KEPT ? await askGemini(sql, "lite", a, take, { wait: false, timeoutMs: 90_000 }).then((r) => (r.ok ? r : askJson(sql, a, take))) : await askJson(sql, a, take);
  const right = (t: English | null) => t && !numbersNotIn([t.kicker, t.headline, t.deck, t.body, t.caption].join("\n\n"), source, date).length ? t : null;
  const en = res.ok ? right(res.value.en) : null, hi = res.ok ? right(res.value.hi) : null;
  // nothing came back at all (every model busy): no second request for each, the round tries again later
  if (!res.ok) return { en: null, hi: null };
  return { en: en ?? await translate(sql, w, "en", date), hi: hi ?? await translate(sql, w, "hi", date) };
}

export async function translate(sql: Sql | null, w: Written, lang: "en" | "hi", date: string): Promise<English | null> {
  const source = [w.kicker, w.headline, w.deck, w.body, w.caption].join("\n\n");
  let note = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = { system: TRANSLATE(lang), user: JSON.stringify({ kicker: w.kicker, headline: w.headline, deck: w.deck, body: w.body, caption: w.caption }) + note, maxTokens: 12000 };
    const take = (v: unknown) => translationOf(v, lang);
    // Gemini Flash Lite first (29 Oct: a Gemma's 16,000 tokens a minute is shared with the writing and checking, and
    // made the engine's rounds run past their time), a Gemma when it can't
    // never waiting on it: when it's busy (the desk shares its 15 requests a minute) the others at once
    // and the last of its day stays Aavtikal's, as in the writing (2 Nov: the news used 378 in three hours)
    const res = sql && (await geminiRemaining(sql, "lite")) > LITE_KEPT ? await askGemini(sql, "lite", a, take, { wait: false, timeoutMs: 90_000 }).then((r) => (r.ok ? r : askJson(sql, a, take))) : await askJson(sql, a, take);
    if (!res.ok) return null;
    const out = res.value;
    const wrong = numbersNotIn([out.kicker, out.headline, out.deck, out.body, out.caption].join("\n\n"), source, date);
    if (!wrong.length) return out;
    note = `\n\nYour last translation had numbers that are not in the Gujarati: ${wrong.join(", ")}. Translate again and keep every number exactly.`;
  }
  return null;
}
