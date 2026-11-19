// Reels from the paper's own videos (lib/clips.ts), made on the Instagram runner (engine/insta.ts runs this; the watcher,
// engine/instawatch.ts, starts it as soon as the editor uploads one). The video, whatever its shape, is set in a 9:16 frame
// over a blurred copy of itself (a wide one high up, so the headline below doesn't cover it), with the paper's name, the
// headline and "વીડિયો: <who filmed it>" over it (drawn by a real browser for Gujarati's letters) and its own sound; at most
// CLIP.maxSeconds. The uploaded video leaves the store once the Reel is made.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { del, get, put } from "@vercel/blob";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { CLIP, clipOverlayHtml, clipsIn, saveClip, type Clip } from "../lib/clips.ts";
import { tell } from "../lib/telegram.ts";
import { count } from "../lib/write.ts";
import { ffmpegHere } from "./reel.ts";

type Sql = NeonQueryFunction<false, false>;
const W = 1080, H = 1920;
/** the Reel's largest: Instagram takes far more, but the site passes it on to each phone that plays it */
const MAX_BYTES = 40 * 1024 * 1024;

/** the video's length, its size as it's watched, whether it has sound, and how it must be turned (ffprobe) */
export interface Probe { seconds: number; width: number; height: number; sound: boolean; turn: number }
export function probe(file: string): Probe | null {
  const run = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height:stream_side_data=rotation",
    "-of", "json", file], { encoding: "utf8" });
  if (run.status !== 0) return null;
  try {
    const j = JSON.parse(run.stdout) as { format?: { duration?: string }; streams?: { codec_type?: string; width?: number; height?: number; side_data_list?: { rotation?: number }[] }[] };
    const v = j.streams?.find((x) => x.codec_type === "video");
    if (!v?.width || !v.height) return null;
    // a phone held upright often records the picture on its side and marks how to turn it (ffprobe's "rotation")
    const turn = ((Math.round(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 360) + 360) % 360;
    const turned = turn === 90 || turn === 270;
    return { seconds: Number(j.format?.duration ?? 0), width: turned ? v.height : v.width, height: turned ? v.width : v.height,
             sound: !!j.streams?.some((x) => x.codec_type === "audio"), turn };
  } catch {
    return null;
  }
}

/** The ffmpeg arguments for the Reel: the video at `input`, the words over it at `words` (a clear 1080×1920 PNG). */
export function clipArgs(input: string, words: string, out: string, v: Probe, rate = 3500, old = false): string[] {
  const seconds = Math.min(v.seconds, CLIP.maxSeconds);
  // the video's height in the frame, and where it sits: a wide one high up (under the paper's name), a tall one in the middle
  const h = Math.min(H, Math.round((W * v.height) / v.width / 2) * 2);
  const y = h < 1300 ? 330 : Math.round((H - h) / 2 / 2) * 2;
  // turned here, with the mark taken off: ffmpeg's own turning kept the mark, so a phone turned the Reel again (19 Nov)
  // (an ffmpeg older than 6 hasn't the option: it turns the video itself, as it did then without keeping the mark)
  const turn = old ? "" : v.turn === 90 ? "transpose=cclock," : v.turn === 270 ? "transpose=clock," : v.turn === 180 ? "hflip,vflip," : "";
  const graph = [
    `[0:v]${turn}split[a][b]`,
    // the background: the same video, made small, blurred and darker, then filled out (blurring it small is far quicker)
    `[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=12:2,eq=brightness=-0.18,scale=${W}:${H},setsar=1[bg]`,
    `[b]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg]`,
    `[bg][fg]overlay=(W-w)/2:${y}[base]`,
    `[base][1:v]overlay=0:0,fps=30,format=yuv420p[v]`,
  ];
  return ["-y", "-hide_banner", "-loglevel", "error", ...(old ? [] : ["-display_rotation", "0"]), "-t", seconds.toFixed(2), "-i", input, "-loop", "1", "-framerate", "30", "-i", words,
    ...(v.sound ? [] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]),
    "-filter_complex", graph.join(";"), "-map", "[v]", "-map", v.sound ? "0:a:0" : "2:a", "-t", seconds.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-crf", "23", "-maxrate", `${rate}k`, "-bufsize", `${rate * 2}k`,
    "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", out];
}

/** the words over the video, drawn by a real browser */
async function overlay(c: Clip): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.setContent(clipOverlayHtml(c), { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.locator(".o").screenshot({ type: "png", omitBackground: true });
  } finally {
    await browser.close();
  }
}

async function makeOne(sql: Sql, c: Clip, log: (s: string) => void) {
  const short = `“${c.headline.slice(0, 50)}”`;
  const fail = async (why: string) => {
    c.state = "failed";
    c.note = why.slice(0, 300);
    await saveClip(sql, c);
    log(`વીડિયોની રીલ ${short} ન બની: ${why}`);
  };
  if (!c.raw) return fail("અપલોડ કરેલો વીડિયો મળ્યો નહીં");
  if (!ffmpegHere()) return fail("ffmpeg નથી");
  const dir = mkdtempSync(join(tmpdir(), "clip-"));
  try {
    log(`વીડિયોની રીલ બને છે: ${short}`);
    const got = await get(c.raw, { access: "private" }).catch(() => null);
    if (!got || got.statusCode !== 200) return fail("અપલોડ કરેલો વીડિયો ફોટો-સ્ટોરમાં મળ્યો નહીં; ફરી અપલોડ કરો");
    const input = join(dir, `in.${c.raw.split(".").pop()}`);
    writeFileSync(input, Buffer.from(await new Response(got.stream).arrayBuffer()));
    const v = probe(input);
    if (!v) return fail("આ ફાઇલ વીડિયો તરીકે વંચાઈ નહીં (બીજા ફોર્મેટમાં અપલોડ કરો)");
    if (v.seconds < CLIP.minSeconds) return fail(`વીડિયો ${CLIP.minSeconds} સેકન્ડથી ટૂંકો છે; ઇન્સ્ટાગ્રામ નહીં લે`);
    const words = join(dir, "words.png");
    writeFileSync(words, await overlay(c));
    const out = join(dir, "reel.mp4");
    for (const rate of [3500, 2200, 1400]) {
      let run = spawnSync("ffmpeg", clipArgs(input, words, out, v, rate), { encoding: "utf8", timeout: 12 * 60_000 });
      if (run.status !== 0 && /display_rotation/.test(run.stderr ?? "")) run = spawnSync("ffmpeg", clipArgs(input, words, out, v, rate, true), { encoding: "utf8", timeout: 12 * 60_000 });
      if (run.status !== 0) return fail(`ffmpeg: ${(run.stderr || run.error?.message || "failed").slice(-200)}`);
      if (statSync(out).size <= MAX_BYTES) break;
    }
    const mp4 = readFileSync(out);
    if (mp4.length > MAX_BYTES) return fail(`રીલ ${Math.round(mp4.length / 1048576)} MB થઈ, ઘણી મોટી`);
    const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const name = `instagram/${day}/${c.id}-${createHash("sha256").update(mp4).digest("hex").slice(0, 10)}.mp4`;
    await put(name, mp4, { access: "private", contentType: "video/mp4", addRandomSuffix: false, allowOverwrite: true });
    await count(sql, "insta_upload");
    await del(c.raw).catch(() => {});
    c.raw = null;
    c.reel = `/media/${name}`;
    c.state = "waiting";
    c.note = v.seconds > CLIP.maxSeconds ? `વીડિયો ${Math.round(v.seconds)} સેકન્ડનો હતો; પહેલી ${CLIP.maxSeconds} સેકન્ડ લીધી.` : "";
    await saveClip(sql, c);
    log(`વીડિયોની રીલ તૈયાર: ${short} (${Math.round(Math.min(v.seconds, CLIP.maxSeconds))} સેકન્ડ, ${(mp4.length / 1048576).toFixed(1)} MB): મંજૂરીની રાહ`);
    await tell(`<b>ઇન્સ્ટાગ્રામ: તમારા વીડિયોની રીલ તૈયાર</b>\n${c.headline}\n\nજોઈને મૂકો: https://www.capitalkranti.co.in/editor?tab=insta`).catch(() => {});
  } catch (e) {
    await fail(e instanceof Error ? e.message : String(e));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** every uploaded video waiting for its Reel; a Reel more than four days old leaves the store (Instagram keeps its own) */
export async function makeClips(sql: Sql, log: (s: string) => void) {
  for (const c of await clipsIn(sql, "making")) await makeOne(sql, c, log);
  const old = await sql.query(`select id, raw, reel from insta_clips where (reel is not null or raw is not null) and made_at < now() - interval '4 days'`);
  for (const r of old) {
    for (const f of [r.raw, r.reel] as (string | null)[]) if (f) await del(f.replace(/^\/media\//, "")).catch(() => {});
    await sql.query(`update insta_clips set raw = null, reel = null, state = case when state in ('waiting', 'making', 'failed') then 'expired' else state end where id = $1`, [r.id]);
  }
}
