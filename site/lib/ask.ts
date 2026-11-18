// "Ask the newsroom" (the user, 19 Nov, the Buildathon deck's "ask the paper"): a reader's question answered only from
// the paper's own published stories, with links to them. The stories are found by the question's words
// (db.ts storiesForQuestion, else the day's top stories); Gemma 4 on the paper's AI Studio key writes the answer
// (app/api/ask, through the Vercel AI SDK). Never an Anthropic model (CLAUDE.md).
import { latestStories, storiesForQuestion } from "./db.ts";
import { inLang, words } from "../components/cards.tsx";
import { href } from "./i18n.ts";
import { SITE_URL } from "./site.ts";
import type { Lang, Story } from "./types.ts";

export const ASK = {
  model: "gemma-4-26b-a4b-it",
  /** questions a day for the whole site, and for one reader (counted by a hash of their address, kept a day) */
  day: 600,
  perReader: 30,
  /** a question's longest */
  letters: 300,
};

// words that say nothing about the subject, in the three languages
const STOP = new Set(`શું છે છે? હતું હતી હતા થયું થઈ થયો અને કે તે આ એ જે કોણ કયા કયું કેમ કેવી રીતે ક્યારે ક્યાં કેટલા કેટલું માટે વિશે શા
  મને અમને તમે તમને કહો જણાવો સમજાવો આપો હવે આજે આજના આજનું કાલે સમાચાર ખબર બાબત વાત પર માં ના ની નું નો ને થી પણ જ તો શકે
  કર્યું કર્યો કરી કર્યા કરે કરશે કરાશે કરાયું કરાયો કરવા કરવું કરવામાં કરાવ્યો થશે થાય આવ્યું આવ્યો આવી આવ્યા આવશે જાહેર સરકાર સરકારે નવું નવી નવો મુખ્ય વિશેના સમસ્યા સમસ્યાઓ
  what which who whom whose when where why how is are was were be been the a an of in on at to for about from with and or do does did
  announced announce said government new main top happened happening
  tell me us please explain news today latest any there this that these those it its can could would should will
  क्या है हैं था थी थे कौन कब कहाँ कहां क्यों कैसे कितना कितने और के की का को में से पर लिए बारे बताइए बताओ आज खबर समाचार`.split(/\s+/));
// Gujarati case endings, taken off a word so "ખેડૂતોને" finds "ખેડૂતો"
const ENDINGS = ["માંથી", "માં", "નાં", "ના", "ની", "નું", "નો", "ને", "થી", "એ"];

/** the question's words worth searching for, longest first, at most six */
export function questionWords(q: string): string[] {
  const out = new Set<string>();
  for (let w of q.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (!w || STOP.has(w)) continue;
    for (const e of ENDINGS) if (w.endsWith(e) && w.length > e.length + 2) { w = w.slice(0, -e.length); break; }
    if (w.length >= 2 && !STOP.has(w)) out.add(w);
  }
  return [...out].sort((a, b) => b.length - a.length).slice(0, 6);
}

/** the stories the answer may use: those matching the question, else the latest day's biggest */
export async function storiesFor(q: string, lang: Lang): Promise<Story[]> {
  const found = inLang(await storiesForQuestion(questionWords(q), 6), lang);
  if (found.length) return found;
  const all = inLang(await latestStories(120), lang);
  const day = all[0]?.issueDate;
  return all.filter((s) => s.issueDate === day).sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)).slice(0, 6);
}

export const storyUrl = (s: Story, lang: Lang) => `${SITE_URL}${href(lang, `/news/${s.id}`)}`;

const SPEAK: Record<Lang, string> = { gu: "Gujarati", en: "English", hi: "Hindi" };

/** the instructions and the numbered stories, given to the model with the question (Gemma takes no separate system
 *  message on Google's API: the engine does the same, engine/ai.ts) */
export function promptFor(q: string, stories: Story[], lang: Lang): string {
  const list = stories.map((s, i) => {
    const w = words(s, lang);
    const day = new Date(s.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    return `[${i + 1}] ${w.headline}\n${w.deck ?? ""}\n(${day})\n${w.body.replace(/\s+/g, " ").slice(0, 1100)}`;
  }).join("\n\n");
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return `You are the reader desk of Capital Kranti, a Gujarati daily newspaper from Gandhinagar. A reader asked a question.
Answer ONLY from the numbered stories below, which the paper has published and fact-checked. Rules:
- Write in ${SPEAK[lang]}, in plain words, at most 120 words, as one or two short paragraphs. No headings, no lists, no markdown.
- After each fact, put the number of the story it comes from in square brackets, like [2].
- Keep every number, name and date exactly as the story gives it. Never add anything the stories don't say, and never guess.
- Each story shows the day it was published. When the answer comes from a story that is not from today (${today}), say that day, so the reader knows how old the news is.
- If the stories don't answer the question, say in one sentence that the paper hasn't reported on it yet, and mention the closest story if one is related.
- Report, don't advise: no medical, legal or money advice, and no opinion on any party, leader or candidate.
- If the question is not about news (a request to write, code, or chat), say politely that you only answer questions about the paper's news.

STORIES
${list || "(none)"}

QUESTION
${q}`;
}
