// Local checking only (CK_SAMPLE=1 npm run dev): 22 Oct 2026's real stories
// from the design sample stand in for the database, so pages can be looked at
// on a computer without the website's keys. Never used on the live site.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Issue, Story, Tier } from "./types.ts";

const SEC: Record<string, Tier | [Tier, string]> = {
  p2326788: "gujarat", p2326576: "world", p2326589: "world", p2326600: "world", p2326774: "world", p2326646: "world",
  p2326794: ["india", "farm"], p2326879: ["india", "farm"], p2326374: ["india", "farm"], p2326715: ["india", "farm"],
  p2326779: ["india", "economy"], p2326850: ["india", "economy"], p2326873: ["india", "economy"], p2326498: ["india", "economy"],
  p2326691: ["india", "tech"], p2326728: ["india", "tech"], p2326762: ["india", "tech"], p2326872: ["india", "health"],
  p2326743: ["india", "sport"], p2326749: ["india", "sport"],
};

let cache: { stories: Story[]; issues: Issue[] } | null = null;
export function sample() {
  if (cache) return cache;
  // a redesign looked at on real news: a snapshot of the live site's public pages, kept outside the repository
  if (process.env.CK_SAMPLE_FILE) {
    const raw = JSON.parse(readFileSync(process.env.CK_SAMPLE_FILE, "utf8")) as { id: string; k: string; h: string; d: string; body: string; cap: string; img: string | null; w: number | null; ht: number | null; at: string | null; secs: string[]; crumbs?: string[]; rank: number }[];
    const tiers = ["gujarat", "india", "world"];
    const stories = raw.filter((r) => r.at).map((r): Story => {
      const keys = [...new Set([...(r.crumbs ?? []), ...r.secs])];
      return {
        id: r.id, issueDate: r.at!.slice(0, 10), publishedAt: r.at!, updatedAt: r.at!, tier: (keys.find((k) => tiers.includes(k)) ?? "india") as Tier,
        genres: keys.filter((k) => !tiers.includes(k)) as never[], kicker: r.k, headline: r.h, deck: r.d, body: r.body, caption: r.cap,
        photo: r.img ? { url: r.img.startsWith("/") ? `https://www.capitalkranti.co.in${r.img}` : r.img, width: r.w ?? 1200, height: r.ht ?? 800 } : null,
        source: { kind: "pib", name: "PIB", url: "" }, checked: true, page: null, rank: null, en: null, hi: null, corrections: [], origin: "live", sources: [],
        importance: r.rank === 0 ? 9 : r.rank < 8 ? 8 : 6, gallery: [],
      };
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    cache = { stories, issues: [{ date: stories[0].issueDate, number: 271, pdf: null, publishedAt: stories[0].publishedAt, storyIds: stories.map((s) => s.id), pages: [] }] };
    return cache;
  }
  const root = path.join(process.cwd(), "..");
  const raw = JSON.parse(readFileSync(path.join(root, "docs/website/sample/full-img.json"), "utf8")) as
    { id: string; k: string; h: string; d: string; body: string; cap: string; src: string; img?: string }[];
  const stories = raw.map((r, i): Story => {
    const sec = SEC[r.id] ?? "india";
    const [tier, genre] = Array.isArray(sec) ? sec : [sec, undefined];
    return {
      id: r.id, issueDate: "2026-10-22", publishedAt: "2026-10-22T14:40:00.000Z", updatedAt: "2026-10-22T14:40:00.000Z",
      tier, genres: genre ? [genre as never] : [], kicker: r.k, headline: r.h, deck: r.d, body: r.body.replace(/^[^\n]*::\s*\n?/, ""), caption: r.cap,
      photo: r.img ? { url: r.img, width: 1200, height: 800 } : null,
      source: { kind: "pib", name: "પત્ર સૂચના કાર્યાલય (PIB)", url: r.src }, checked: true,
      page: Math.floor(i / 8) + 1, rank: i % 8, en: i % 3 === 0 ? null : null, corrections: [], hi: null, origin: "paper", sources: [], importance: null, gallery: [],
    };
  });
  const issues: Issue[] = [{ date: "2026-10-22", number: 271, pdf: null, publishedAt: "2026-10-22T14:40:00.000Z", storyIds: stories.map((s) => s.id), pages: [] }];
  cache = { stories, issues };
  return cache;
}
export const sampleOn = () => process.env.CK_SAMPLE === "1" && !process.env.DATABASE_URL;
