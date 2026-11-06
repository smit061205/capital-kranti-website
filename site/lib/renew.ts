// Which kept-ready pages are renewed when the news changes (6 Nov: every page under the site's layout was marked stale
// with each round, up to four times an hour, and each of the ~4,500 then made again at its next visit, mostly by search
// engines' crawlers; that went past Vercel's free 200,000 "ISR writes" a month). Now only the pages that list stories are
// renewed, and a story's own page only when it's new or was changed; the rest renew themselves once a day (news/[id]).
// Marked stale, not expired: the reader gets the kept page at once while the new one is made behind them.
import { revalidateTag } from "next/cache";
import { SECTIONS } from "./sections.ts";

const LANGS = ["", "/en", "/hi"];
/** India's date today, for the day's archive page */
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** the pages that list stories, in the three languages (a section's topic pages, its further pages, its feed and the
 *  city and district pages, seldom visited, renew themselves) */
export const listPaths = (): string[] => LANGS.flatMap((l) => [
  l || "/", `${l}/latest`, `${l}/archive`, `${l}/archive/${today()}`, `${l}/rss.xml`, ...SECTIONS.map((k) => `${l}/section/${k}`),
]);
/** a story's own page, in the three languages */
export const storyPaths = (id: string): string[] => LANGS.map((l) => `${l}/news/${id}`);
export const classifiedPaths = (): string[] => LANGS.map((l) => `${l}/classifieds`);

/** These pages marked stale: each is made again at its next visit (the tag Next gives every page for its address). */
export function renew(paths: string[]) {
  for (const p of new Set(paths)) revalidateTag(`_N_T_${p}`, "max");
}
