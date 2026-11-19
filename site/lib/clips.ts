// A Reel from the paper's own video (the user, 19 Nov: real clips of what happened, with our headline; other outlets'
// clips aren't used, since credit isn't permission). The editor picks a story, chooses a video from his phone (it goes
// straight to the photo store: app/(gu)/editor/ClipForm.tsx) and says the paper filmed it or has written permission; the
// Instagram runner makes it a 9:16 Reel with the headline, the paper's name and "વીડિયો: <who filmed it>" over it and its
// own sound (engine/clips.ts); he sees it on the Instagram tab and posts it. Shared by the site and the engine.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { prepared } from "./write.ts";

type Sql = NeonQueryFunction<false, false>;

/** making: the runner is making the Reel; waiting: for the editor; approved: going up; failed: the reason in note */
export type ClipState = "making" | "waiting" | "approved" | "posted" | "failed" | "expired";
export interface Clip {
  id: string; storyId: string | null; headline: string; credit: string; caption: string; state: ClipState; note: string;
  /** the video as the editor uploaded it (deleted once the Reel is made), and the Reel (instagram/<date>/clip-….mp4) */
  raw: string | null; reel: string | null;
  by: string; madeAt: string; postedAt: string | null; reelUrl: string | null;
}

export const CLIP = {
  /** the longest video taken (MB) and the most a day */
  maxMB: 300, perDay: 10,
  /** the Reel's longest (seconds; a longer video is cut there) and shortest (Instagram's least is 3) */
  maxSeconds: 90, minSeconds: 3,
  /** what the phones send */
  types: ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-m4v", "video/x-matroska"],
};
export const CLIP_EXT = /^(mp4|mov|webm|3gp|m4v|mkv)$/;

const clipOf = (r: Record<string, unknown>): Clip => ({
  id: r.id as string, storyId: (r.story_id as string) ?? null, headline: r.headline as string, credit: r.credit as string,
  caption: r.caption as string, state: r.state as ClipState, note: (r.note as string) ?? "", raw: (r.raw as string) ?? null,
  reel: (r.reel as string) ?? null, by: (r.by_name as string) ?? "", madeAt: new Date(r.made_at as string).toISOString(),
  postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null, reelUrl: (r.reel_url as string) ?? null,
});

export async function recentClips(sql: Sql, limit = 10): Promise<Clip[]> {
  await prepared(sql);
  return (await sql.query(`select * from insta_clips order by made_at desc limit $1`, [limit])).map(clipOf);
}
export async function clipsIn(sql: Sql, state: ClipState): Promise<Clip[]> {
  await prepared(sql);
  return (await sql.query(`select * from insta_clips where state = $1 order by made_at`, [state])).map(clipOf);
}
export async function getClip(sql: Sql, id: string): Promise<Clip | null> {
  await prepared(sql);
  const [r] = await sql.query(`select * from insta_clips where id = $1`, [id]);
  return r ? clipOf(r) : null;
}
export async function saveClip(sql: Sql, c: Clip) {
  await prepared(sql);
  await sql.query(
    `insert into insta_clips (id, story_id, headline, credit, caption, state, note, raw, reel, by_name, made_at, posted_at, reel_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (id) do update set headline = excluded.headline, credit = excluded.credit, caption = excluded.caption, state = excluded.state,
       note = excluded.note, raw = excluded.raw, reel = excluded.reel, posted_at = excluded.posted_at, reel_url = excluded.reel_url`,
    [c.id, c.storyId, c.headline, c.credit, c.caption, c.state, c.note, c.raw, c.reel, c.by, c.madeAt, c.postedAt, c.reelUrl]);
}

/** the post's words: the headline first (Instagram's "already up?" check reads the first line: lib/instagram.ts) */
export function clipCaption(headline: string, credit: string, deck?: string): string {
  return [
    headline,
    ...(deck ? ["", deck] : []),
    "",
    `વીડિયો: ${credit}`,
    "પૂરા સમાચાર: પ્રોફાઇલમાંની લિંક (capitalkranti.co.in)",
    "",
    "#ગુજરાતીસમાચાર #ગુજરાત #CapitalKranti #કેપિટલક્રાંતિ",
  ].join("\n");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** What goes over the video, 1080×1920 with a clear background (a real browser draws it, for Gujarati's letters:
 *  engine/clips.ts): the paper's name at the top, the headline and the credit low down, both kept clear of Instagram's
 *  own buttons and words (the right edge and the bottom fifth). A soft shade behind each keeps them readable. */
export function clipOverlayHtml(c: Pick<Clip, "headline" | "credit">): string {
  const size = c.headline.length > 90 ? 58 : c.headline.length > 60 ? 66 : 76;
  return `<!doctype html><html lang="gu"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Gujarati:wdth,wght@75..125,100..800&display=block">
<style>
html,body{margin:0;background:transparent}
.o{position:relative;width:1080px;height:1920px;font-family:'Anek Gujarati',sans-serif;color:#fff;overflow:hidden}
.top{position:absolute;left:0;right:0;top:0;height:300px;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0))}
.logo{position:absolute;left:64px;top:110px;font-size:52px;font-weight:800;font-stretch:80%;text-shadow:0 1px 10px rgba(0,0,0,.6)}
.low{position:absolute;left:0;right:0;bottom:0;height:980px;background:linear-gradient(180deg,rgba(0,0,0,0) 0,rgba(0,0,0,.45) 40%,rgba(0,0,0,.72) 100%)}
.body{position:absolute;left:64px;right:170px;bottom:400px}
.tag{display:inline-block;background:#7f3894;font-size:34px;font-weight:700;padding:8px 24px 4px;border-radius:6px;margin-bottom:24px}
.hl{font-size:${size}px;font-weight:750;font-stretch:88%;line-height:1.2;text-wrap:balance;text-shadow:0 2px 3px rgba(0,0,0,.8),0 3px 14px rgba(0,0,0,.7)}
.cr{margin-top:26px;font-size:32px;font-weight:500;opacity:.92;text-shadow:0 1px 3px rgba(0,0,0,.85)}
</style></head><body><div class="o"><div class="top"></div><div class="logo">કેપિટલ ક્રાંતિ</div><div class="low"></div>
<div class="body"><span class="tag">સમાચાર</span><div class="hl">${esc(c.headline)}</div><div class="cr">વીડિયો: ${esc(c.credit)} · capitalkranti.co.in</div></div>
</div></body></html>`;
}
