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

export interface SourceText { source: SourceDef; url: string; title: string; text: string; image: string | null; official: boolean }

/** Each report's text: an official page in full; an outlet's article as facts
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
    out.push({ source, url: it.url, title: it.title, text: text.slice(0, 14000), image: source.trust === "official" ? image : null, official: source.trust === "official" });
    if (out.length >= 5) break;
  }
  // all the sources together stay near 24,000 letters, so one request stays within the free plan's text a minute:
  // the longest keeps its length (the story is written as long as it), the others share what's left
  const longest = out.reduce((a, s, i) => (s.text.length > out[a].text.length ? i : a), 0);
  const rest = Math.max(2000, Math.floor((24_000 - (out[longest]?.text.length ?? 0)) / Math.max(1, out.length - 1)));
  return out.map((s, i) => (i === longest ? s : { ...s, text: s.text.slice(0, rest) }));
}

const sourcesBlock = (src: SourceText[]) => src.map((s, k) =>
  `SOURCE ${k + 1} (${s.source.name}, ${s.official ? "official" : "news outlet"}, ${s.source.lang}):\n${s.title}\n${s.text}`).join("\n\n---\n\n");

// ---- step 5: the Gujarati story ----

export interface Written { kicker: string; headline: string; deck: string; body: string; caption: string; model: string }

/** How long the story is: at least as long as its longest source (the user, 29 Oct), never shorter than its
 *  level asks, and up to 1,200 words (as much as a free model writes well in one answer). */
export function lengthFor(level: Level, src: SourceText[]): [number, number] {
  const longest = Math.max(0, ...src.map((s) => s.text.split(/\s+/).filter(Boolean).length));
  // sources shorter than the level's length (a feed's three-line summary): the story as long as they are, not padded out to
  // the level's (4 Nov: 250 words asked from 60, the writer filled them with lines no source said and the check failed
  // over half the stories)
  if (longest < WORDS[level][0]) {
    const lo = Math.max(WORDS.brief[0] * 0.8, Math.round(longest * 0.9));
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

/** Steps 5 and 7: the story's numbers by code, then every claim by a different free model. */
export async function check(sql: Sql | null, w: Written, src: SourceText[], date: string): Promise<Checked> {
  const problems: string[] = [];
  const all = src.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  const text = [w.kicker, w.headline, w.deck, w.body, w.caption].join("\n\n");
  // an outlet's own name counts as known: the 9 of "ટીવી9" is no figure (1 Nov: it failed story after story)
  const wrong = numbersNotIn(text, `${all}\n\n${src.map((s) => s.source.name).join("\n")}`, date);
  if (wrong.length) problems.push(`numbers not in any source: ${wrong.join(", ")}`);
  if (repeats(w.body)) problems.push("says the same thing twice");
  // letters from another script inside the Gujarati (29 Oct: Telugu letters mid-sentence) are a model's slip
  // and English letters after Gujarati ones in a word (1 Nov: "નini" for "નવ" reached a headline; "CCIની" is fine)
  const stray = `${w.headline} ${w.deck} ${w.body}`.match(/[\u0900-\u097F\u0980-\u0A7F\u0B00-\u0DFF_]+|[\u0A80-\u0AFF]+[A-Za-z]+/g);
  if (stray) problems.push(`letters from another script: ${[...new Set(stray)].slice(0, 3).join(", ")}`);
  for (const s of src.filter((s) => s.source.lang === "gu")) {
    const share = copiedShare(w.body, s.text);
    if (share > 0.12) problems.push(`copies ${Math.round(share * 100)}% of ${s.source.name}'s wording`);
  }
  // the code's own checks failed: the story goes back now, without a model's minutes on a version that can't go up
  if (problems.length) return { ok: false, problems, claims: [] };
  const res = await askJson(sql, { system: CHECKER, user: `STORY:\n${labelled(w)}\n\n===\n\n${sourcesBlock(src)}`, role: "checker", avoid: w.model, maxTokens: 6000 },
    (v) => {
      const x = v as { claims?: Claim[] };
      if (!Array.isArray(x?.claims) || !x.claims.length) return null;
      return x.claims.map((c) => ({ claim: String(c.claim ?? ""), supported: c.supported === true, where: String(c.where ?? ""), sentence: String(c.sentence ?? "") }));
    });
  if (!res.ok) return { ok: false, problems: [...problems, `the second check didn't answer (${res.why})`], claims: [], busy: res.busy || /busy/.test(res.why) };
  const unsupported = res.value.filter((c) => !c.supported);
  for (const c of unsupported) problems.push(`not in the sources: ${c.claim}`);
  return { ok: problems.length === 0, problems, claims: res.value, model: res.model };
}

const STRAY = /[\u0900-\u097F\u0980-\u0A7F\u0B00-\u0DFF]|[\u0A80-\u0AFF][A-Za-z]/;
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
async function mendLetters(sql: Sql | null, written: Written): Promise<Written> {
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
      : await askJson(sql, ask, checkWritten);
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

export async function translate(sql: Sql | null, w: Written, lang: "en" | "hi", date: string): Promise<English | null> {
  const source = [w.kicker, w.headline, w.deck, w.body, w.caption].join("\n\n");
  let note = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = { system: TRANSLATE(lang), user: JSON.stringify({ kicker: w.kicker, headline: w.headline, deck: w.deck, body: w.body, caption: w.caption }) + note, maxTokens: 12000 };
    const take = (v: unknown) => {
      const x = v as Partial<English>;
      if (!x?.headline || typeof x.body !== "string") return null;
      // still Gujarati, wholly or in part (2 Nov: a model gave the Gujarati back, it was kept as the English and Hindi,
      // and the story stayed Gujarati on /en and /hi)
      if (GUJARATI.test([x.kicker, x.headline, x.deck, x.body].join(" "))) return null;
      if (lang === "hi" && !(/[ऀ-ॿ]/.test(x.headline) && /[ऀ-ॿ]/.test(x.body))) return null;
      return { kicker: x.kicker ?? "", headline: x.headline, deck: x.deck ?? "", body: x.body, caption: x.caption ?? "" };
    };
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
