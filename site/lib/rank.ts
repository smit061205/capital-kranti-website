// What the front page puts at its top (4 Nov: the big headline was the engine's most important story, but the pair and the
// row of three under it were simply the newest stories with a photo, so a car launch sat above four deaths in Manipur; and
// two stories of one event, or four of one section, could fill the top). One score for every story, from how much it
// matters, how fresh it is and how many outlets report it; then the top picked one by one, so each story there is a
// different event and no section crowds the rest out.
import type { Story } from "./types.ts";

/** What a story of the evening paper counts for, which the engine hasn't scored: its place in the paper. */
const paperWeight = (s: Story) => (s.page === 1 ? (s.rank === 1 ? 8 : 7) : 5.5);

/** Outlets reporting it (the engine adds those that report it after it went up), not counting fact-checkers. */
const outlets = (s: Story) => new Set((s.sources ?? []).filter((x) => x.trust !== "factcheck").map((x) => x.name)).size;

/** How much a story deserves the top now: its importance (the engine's, 0-11), a little more for each doubling of the
 *  outlets reporting it, and a point less for every three hours since it went up (a day's lead is still above a fresh
 *  ordinary story for about six hours), faster after a day. */
export function topScore(s: Story, now = Date.now()): number {
  const hours = Math.max(0, (now - Date.parse(s.publishedAt)) / 3600_000);
  const decay = hours <= 24 ? hours / 3 : 8 + (hours - 24) / 2;
  return (s.importance ?? paperWeight(s)) + Math.log2(Math.max(1, outlets(s))) * 0.3 - decay;
}

const STOP = new Set(["with", "from", "that", "this", "after", "over", "into", "will", "have", "been", "their", "says", "said",
  "amid", "about", "more", "than", "india", "indian", "gujarat", "government", "govt", "first", "year", "years", "crore", "lakh"]);
/** a headline's own words, in English when it has its English (the same event is told in different Gujarati words) */
const wordsOf = (s: Story) => new Set(((s.en?.headline || s.headline).toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [])
  .filter((w) => w.length >= 4 && !STOP.has(w)));

/** Two stories of one event or one person's one day (4 Nov: Kohli's 13,000 runs and his chase record, side by side): the
 *  same file photo, or half their headline words in common. */
export function sameStory(a: Story, b: Story): boolean {
  if (a.photo && b.photo && a.photo.url.replace(/^.*[-/]/, "") === b.photo.url.replace(/^.*[-/]/, "")) return true;
  const wa = wordsOf(a), wb = wordsOf(b);
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both >= 3 || (both >= 2 && both / Math.min(wa.size, wb.size) >= 0.5);
}

/** the desk a story belongs to at the top: its first subject (sport, economy, ...) or else its place */
const desk = (s: Story) => s.genres[0] ?? s.tier;

/** The stories for the top, best first: within the first six, each a different event, at most two from one desk and three
 *  from one place (Gujarat, India, the world), and Gujarat's best among them when it's near enough (the paper is Gujarat's). */
export function ranked(stories: Story[], now = Date.now(), size = 12): Story[] {
  // the last day and a half; older only when there's nothing newer (the paper alone, the engine stopped)
  const recent = stories.filter((s) => now - Date.parse(s.publishedAt) < 36 * 3600_000);
  const pool = (recent.length >= 6 ? recent : stories).map((s) => ({ s, score: topScore(s, now) })).sort((a, b) => b.score - a.score);
  const top: { s: Story; score: number }[] = [];
  const later: { s: Story; score: number }[] = [];
  for (const x of pool) {
    if (top.length >= size) break;
    if ([...top, ...later].some((y) => sameStory(x.s, y.s))) continue;
    if (top.length < 6 && (top.filter((y) => desk(y.s) === desk(x.s)).length >= 2 || top.filter((y) => y.s.tier === x.s.tier).length >= 3)) { later.push(x); continue; }
    top.push(x);
  }
  // too few for six within the limits: the places left go first to those that keep a desk to two, then to the best
  const crowds = (x: { s: Story }, among: { s: Story }[]) => among.filter((y) => desk(y.s) === desk(x.s)).length >= 2;
  while (top.length < 6 && later.length) {
    const i = Math.max(0, later.findIndex((x) => !crowds(x, top.slice(0, 6))));
    top.splice(Math.min(6, top.length), 0, ...later.splice(i, 1));
  }
  // the first six as picked, then the rest best first (those held back by the limits among them)
  const out = [...top.slice(0, 6), ...[...top.slice(6), ...later].sort((a, b) => b.score - a.score)];
  if (out.length >= 6 && !out.slice(0, 6).some((x) => x.s.tier === "gujarat")) {
    const at = out.findIndex((x, i) => i >= 6 && x.s.tier === "gujarat");
    if (at >= 0 && out[at].score >= out[5].score - 2.5) out.splice(5, 0, ...out.splice(at, 1));
  }
  return out.slice(0, size).map((x) => x.s);
}

/** The front page's top: the lead (a story with a wide photo when one is nearly as important as the first), a pair (with
 *  photos when two different ones are near the top), and a row of three. */
export function frontTop(stories: Story[], has: { strong: (s: Story) => boolean; decent: (s: Story) => boolean }, now = Date.now()) {
  const list = ranked(stories, now);
  if (!list.length) return { lead: undefined, pair: [] as Story[], three: [] as Story[], order: list };
  const best = topScore(list[0], now);
  const lead = list.slice(0, 4).find((s) => has.strong(s) && topScore(s, now) >= best - 1.5) ?? list[0];
  const rest = list.filter((s) => s !== lead);
  const pics = rest.slice(0, 5).filter(has.decent);
  const second = pics.slice(1).find((s) => !sameStory(s, pics[0]));
  const pair = second ? [pics[0], second] : rest.slice(0, 2);
  const three = rest.filter((s) => !pair.includes(s)).slice(0, 3);
  return { lead, pair, three, order: list };
}
