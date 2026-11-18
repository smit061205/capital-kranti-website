// An Instagram set as a Reel (the user, 19 Nov: "work on reels"): its cards one after another as a 9:16 video, each
// card over a blurred, darkened copy of itself, slowly zooming, with its headline read out in Gujarati by Gemini's
// speech model (lib/speech.ts, the same voice as the site's Listen): the section's name before the first, the site's
// address after the last, all read in one request and cut at the pauses between lines. Made with ffmpeg on the Instagram runner (engine/insta.ts render), kept under 4.3 MB so the
// site can answer a phone's byte ranges for it (app/media) and Instagram fetches it quickly. Without the voice (no key,
// the day's letters used up, Gemini failing four times) the Reel is made silent rather than with some cards unread.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { LANDMARKS, type InstaSet } from "../lib/insta.ts";
import { sectionName } from "../lib/sections.ts";
import { speak, wavSeconds } from "../lib/speech.ts";

const W = 1080, H = 1920, CARD_H = 1350, MAX_BYTES = 4.3 * 1024 * 1024;
const has = () => spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
/** ffmpeg, installed on GitHub's machine the first time it's missing (the runner's script stays as it started for six
 *  hours, while this code is main's latest) */
export function ffmpegHere(): boolean {
  if (has()) return true;
  if (!process.env.GITHUB_ACTIONS) return false;
  spawnSync("sh", ["-c", "sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg"], { stdio: "ignore", timeout: 5 * 60_000 });
  return has();
}

/** what is said over each card: the headlines, the section's name before the first (with commas, so the reader doesn't
 *  stop there as long as between cards, where the reading is cut), the site after the last */
export function reelWords(set: Pick<InstaSet, "tier" | "cards">): string[] {
  const section = sectionName(set.tier, "gu");
  const lines = set.cards.map((c, i) => `${i ? "" : `કેપિટલ ક્રાંતિ, ${section}ના મુખ્ય સમાચાર, `}${c.headline.replace(/[.।]\s*$/, "")}.`);
  lines.push(`${LANDMARKS[set.tier].title}, કેપિટલ ક્રાંતિની વેબસાઇટ પર. લિંક પ્રોફાઇલમાં.`);
  return lines;
}

const pause = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const STYLE = "a calm, clear news reader, who stops for a full second after each line";

/** the whole Reel read in one request (19 Nov: one request a card, about 24 a round, ran into Gemini's free rate limit,
 *  429), tried again after a wait when Gemini is busy: half a minute, then a minute, then a minute and a half */
async function reading(sql: NeonQueryFunction<false, false> | null, lines: string[], say: (l: string) => void): Promise<Buffer | null> {
  for (let i = 0; ; i++) {
    try { return await speak(sql, lines.join("\n\n"), STYLE); } catch (e) {
      const m = (e as Error).message;
      say(`રીલનો અવાજ: ${m.slice(0, 300)}`);
      if (i === 3 || !/\((429|5\d\d|no answer)\)/.test(m)) return null;
      const asked = Number(m.match(/retry in ([\d.]+)\s*s/i)?.[1] ?? 0);
      await pause(Math.min(120, Math.max(30 * (i + 1), asked + 2)));
    }
  }
}

/** the pauses in a WAV (ffmpeg silencedetect), as [start, end] seconds */
export function pausesIn(file: string): [number, number][] {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.2", "-f", "null", "-"], { encoding: "utf8" });
  const out: [number, number][] = [];
  let from: number | null = null;
  for (const line of (run.stderr ?? "").split("\n")) {
    const a = line.match(/silence_start: (-?[\d.]+)/), b = line.match(/silence_end: ([\d.]+)/);
    if (a) from = Math.max(0, +a[1]);
    if (b && from !== null) { out.push([from, +b[1]]); from = null; }
  }
  return out;
}

/** where one reading of the lines (lens: their letters) changes line: the pauses that, taken together, are long
 *  (between lines the reader stops for a second, after a comma for a moment) and give each line about the time its
 *  letters need; with too few pauses, where the letters say */
export function cutsAt(total: number, lens: number[], pauses: [number, number][]): number[] {
  const n = lens.length - 1, all = lens.reduce((a, b) => a + b, 0);
  const want = lens.map((l) => total * l / all);
  const cands = pauses.map(([a, b]) => ({ at: (a + b) / 2, len: b - a })).filter((p) => p.at > 0.6 && p.at < total - 0.6);
  // how far a line's time is from what its letters need (doubling or halving costs 0.7), against a pause's length
  const off = (i: number, from: number, to: number) => Math.abs(Math.log(Math.max(0.05, to - from) / want[i]));
  if (cands.length >= n && n > 0) {
    // best[k][j]: the best score with cut k at pause j, and the pause before it
    const best = cands.map(() => new Array<number>(n).fill(-Infinity));
    const back = cands.map(() => new Array<number>(n).fill(-1));
    cands.forEach((c, j) => { best[j][0] = 3 * c.len - off(0, 0, c.at); });
    for (let k = 1; k < n; k++) cands.forEach((c, j) => {
      for (let i = 0; i < j; i++) {
        if (best[i][k - 1] === -Infinity) continue;
        const v = best[i][k - 1] + 3 * c.len - off(k, cands[i].at, c.at);
        if (v > best[j][k]) { best[j][k] = v; back[j][k] = i; }
      }
    });
    let j = -1, top = -Infinity;
    cands.forEach((c, i) => { const v = best[i][n - 1] - off(n, c.at, total); if (v > top) { top = v; j = i; } });
    if (j >= 0) {
      const cuts: number[] = [];
      for (let k = n - 1; k >= 0; k--) { cuts.unshift(+cands[j].at.toFixed(3)); j = back[j][k]; }
      return cuts;
    }
  }
  let at = 0;
  return want.slice(0, n).map((w) => +(at += w).toFixed(3));
}

/** the set's cards (PNG, 1080×1350, in order, the last the section's link) as an MP4; null when ffmpeg isn't here */
export async function makeReel(sql: NeonQueryFunction<false, false> | null, set: Pick<InstaSet, "id" | "tier" | "cards">, shots: Buffer[],
                               say: (line: string) => void = () => {}): Promise<{ mp4: Buffer; seconds: number; voiced: boolean } | null> {
  if (!ffmpegHere()) { say("રીલ: ffmpeg નથી, રીલ ન બની"); return null; }
  const words = reelWords(set).slice(0, shots.length);
  const voice = process.env.GOOGLE_AI_KEY ? await reading(sql, words, say) : null;
  const dir = mkdtempSync(join(tmpdir(), "reel-"));
  try {
    // the reading cut into each card's part, at the pauses between its lines
    let parts: [number, number][] | null = null;
    const wav = join(dir, "voice.wav");
    if (voice) {
      writeFileSync(wav, voice);
      const total = wavSeconds(voice);
      const cuts = cutsAt(total, words.map((w) => w.length), pausesIn(wav));
      const edges = [0, ...cuts, total];
      parts = words.map((_, i) => [edges[i], edges[i + 1]]);
    }
    const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    const graph: string[] = [];
    const lengths: number[] = [];
    let input = 0;
    for (const [i, shot] of shots.entries()) {
      const fg = join(dir, `c${i}.png`), bg = join(dir, `b${i}.png`);
      writeFileSync(fg, shot);
      writeFileSync(bg, await sharp(shot).resize(W, H, { fit: "cover" }).blur(48).modulate({ brightness: 0.55 }).png().toBuffer());
      // a card stays while its words are read, and a breath after; 3.5 seconds without a voice
      // (no upper limit: the first card's words, with the paper's and section's names before the headline, went past
      // the 10 seconds it had and were cut, 19 Nov)
      const d = parts ? Math.max(3, +(parts[i][1] - parts[i][0] + 0.5).toFixed(2)) : 3.5;
      lengths.push(d);
      args.push("-loop", "1", "-framerate", "30", "-t", String(d), "-i", bg, "-loop", "1", "-framerate", "30", "-t", String(d), "-i", fg);
      const b = input++, f = input++;
      // the first card starts without fading in: Instagram makes the Reel's cover from its first picture, which was
      // black (19 Nov). The card grows by 3.5% over its time (scaled each frame and cut back to its size: smoother than zoompan)
      graph.push(`[${f}:v]scale=w='trunc(${W}*(1+0.035*t/${d})/2)*2':h=-2:eval=frame,crop=${W}:${CARD_H},setsar=1[f${i}]`,
                 `[${b}:v]setsar=1[b${i}]`,
                 `[b${i}][f${i}]overlay=0:${(H - CARD_H) / 2}:shortest=1,fps=30,format=yuv420p,${i ? "fade=t=in:st=0:d=0.2," : ""}fade=t=out:st=${(d - 0.2).toFixed(2)}:d=0.2[v${i}]`);
      if (parts) {
        args.push("-ss", parts[i][0].toFixed(3), "-t", (parts[i][1] - parts[i][0]).toFixed(3), "-i", wav);
        graph.push(`[${input++}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=250:all=1,apad,atrim=0:${d},asetpts=PTS-STARTPTS[a${i}]`);
      } else graph.push(`anullsrc=r=48000:cl=mono,atrim=0:${d},aformat=sample_fmts=fltp:channel_layouts=mono[a${i}]`);
    }
    graph.push(`${shots.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${shots.length}:v=1:a=1[v][a]`);
    const out = join(dir, "reel.mp4");
    // as small as it needs to be: a still card compresses well, so the first try is usually 1–3 MB
    for (const [crf, rate] of [[26, 800], [30, 520], [34, 360]] as const) {
      const run = spawnSync("ffmpeg", [...args, "-filter_complex", graph.join(";"), "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-crf", String(crf), "-maxrate", `${rate}k`, "-bufsize", `${rate * 2}k`,
        "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "64k", "-ar", "48000", "-movflags", "+faststart", out], { encoding: "utf8", timeout: 6 * 60_000 });
      if (run.status !== 0) throw new Error(`ffmpeg: ${(run.stderr || run.error?.message || "failed").slice(-300)}`);
      if (statSync(out).size <= MAX_BYTES) break;
    }
    const mp4 = readFileSync(out);
    if (mp4.length > MAX_BYTES) throw new Error(`the Reel came out ${Math.round(mp4.length / 1024)} KB, over 4.3 MB`);
    return { mp4, seconds: +lengths.reduce((a, b) => a + b, 0).toFixed(1), voiced: !!parts };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
