// "Listen" (19 Nov, the Buildathon deck): the words a story or the day's brief is read out with, in parts. Gemini's
// speech model reads each part (app/api/listen, WEBSITE.listen); the reader's phone reads them when it can't
// (components/Listen.tsx).
import { latestStories, storyById } from "./db.ts";
import { words, inLang } from "../components/cards.tsx";
import { WEBSITE } from "./config.ts";
import { t } from "./i18n.ts";
import type { Lang, Story } from "./types.ts";

/** Gemini's voice is on: the paper's AI Studio key is set and the switch is on */
export const serverVoice = () => !!process.env.GOOGLE_AI_KEY && WEBSITE.listen.on;

/** a story's words as read aloud: headline, sub-heading, then its paragraphs (no headings' marks, no links) */
export function storyText(s: Story, lang: Lang): string[] {
  const w = words(s, lang);
  const body = w.body.split(/\n+/).map((p) => p.replace(/^#+\s*/, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim()).filter(Boolean);
  return [`${w.headline}.${w.deck ? ` ${w.deck}` : ""}`, ...body];
}

/** the day's brief: the eight biggest of the latest day's stories, each headline and its sub-heading */
export async function briefText(lang: Lang): Promise<string[]> {
  const all = inLang(await latestStories(200), lang);
  const day = all[0]?.issueDate;
  const top = all.filter((s) => s.issueDate === day)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 8);
  if (!top.length) return [];
  const lines = top.map((s, i) => { const w = words(s, lang); return `${i ? `${t(lang, "briefNext")} ` : ""}${w.headline}. ${w.deck ?? ""}`.trim(); });
  return [t(lang, "briefIntro"), ...lines, t(lang, "briefEnd")];
}

/** paragraphs gathered into parts of about 600 letters (half a minute to a minute of speech each, a small WAV), long
 *  ones cut between sentences */
export function parts(paras: string[], max = 600): string[] {
  const out: string[] = [];
  let cur = "";
  const add = (x: string) => { if (cur && cur.length + x.length + 1 > max) { out.push(cur); cur = x; } else cur = cur ? `${cur}\n${x}` : x; };
  for (const p of paras) {
    if (p.length <= max) { add(p); continue; }
    for (const sent of p.split(/(?<=[.!?।])\s+/)) {
      let rest = sent;
      while (rest.length > max) { add(rest.slice(0, max)); rest = rest.slice(max); }
      add(rest);
    }
  }
  if (cur) out.push(cur);
  return out;
}

export async function listenParts(id: string | null, lang: Lang): Promise<string[]> {
  if (!id) return parts(await briefText(lang));
  const s = await storyById(id);
  return s ? parts(storyText(s, lang)) : [];
}
