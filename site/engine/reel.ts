// An Instagram set as a Reel (the user, 19 Nov: "work on reels"): its cards one after another as a 9:16 video, each
// card over a blurred, darkened copy of itself, slowly zooming, with its headline read out in Gujarati by Gemini's
// speech model (lib/speech.ts, the same voice as the site's Listen): the section's name before the first, the site's
// address after the last. Made with ffmpeg on the Instagram runner (engine/insta.ts render), kept under 4.3 MB so the
// site can answer a phone's byte ranges for it (app/media) and Instagram fetches it quickly. Without the voice (no key,
// the day's letters used up, Gemini failing twice) the Reel is made silent rather than with some cards unread.
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

/** what is said over each card: the headlines, the section's name before the first, the site after the last */
export function reelWords(set: Pick<InstaSet, "tier" | "cards">): string[] {
  const section = sectionName(set.tier, "gu");
  const lines = set.cards.map((c, i) => `${i ? "" : `કેપિટલ ક્રાંતિ. ${section}ના મુખ્ય સમાચાર. `}${c.headline.replace(/[.।]\s*$/, "")}.`);
  lines.push(`${LANDMARKS[set.tier].title}, કેપિટલ ક્રાંતિની વેબસાઇટ પર. લિંક પ્રોફાઇલમાં.`);
  return lines;
}

async function voices(sql: NeonQueryFunction<false, false> | null, words: string[], say: (l: string) => void): Promise<Buffer[] | null> {
  const out: Buffer[] = [];
  for (const w of words) {
    let wav: Buffer | null = null;
    for (let i = 0; i < 2 && !wav; i++) {
      wav = await speak(sql, w).catch((e) => { say(`રીલનો અવાજ: ${(e as Error).message.slice(0, 120)}`); return null; });
      if (!wav && i === 0) await new Promise((r) => setTimeout(r, 6000));
    }
    if (!wav) return null;
    out.push(wav);
  }
  return out;
}

/** the set's cards (PNG, 1080×1350, in order, the last the section's link) as an MP4; null when ffmpeg isn't here */
export async function makeReel(sql: NeonQueryFunction<false, false> | null, set: Pick<InstaSet, "id" | "tier" | "cards">, shots: Buffer[],
                               say: (line: string) => void = () => {}): Promise<{ mp4: Buffer; seconds: number; voiced: boolean } | null> {
  if (!ffmpegHere()) { say("રીલ: ffmpeg નથી, રીલ ન બની"); return null; }
  const words = reelWords(set).slice(0, shots.length);
  const wavs = process.env.GOOGLE_AI_KEY ? await voices(sql, words, say) : null;
  const dir = mkdtempSync(join(tmpdir(), "reel-"));
  try {
    const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    const graph: string[] = [];
    const lengths: number[] = [];
    let input = 0;
    for (const [i, shot] of shots.entries()) {
      const fg = join(dir, `c${i}.png`), bg = join(dir, `b${i}.png`);
      writeFileSync(fg, shot);
      writeFileSync(bg, await sharp(shot).resize(W, H, { fit: "cover" }).blur(48).modulate({ brightness: 0.55 }).png().toBuffer());
      // a card stays while its words are read, and a breath after; 3.5 seconds without a voice
      const d = wavs ? Math.min(10, Math.max(3, +(wavSeconds(wavs[i]) + 0.75).toFixed(2))) : 3.5;
      lengths.push(d);
      args.push("-loop", "1", "-framerate", "30", "-t", String(d), "-i", bg, "-loop", "1", "-framerate", "30", "-t", String(d), "-i", fg);
      const b = input++, f = input++;
      // the card grows by 3.5% over its time (scaled each frame and cut back to its size: smoother than zoompan)
      graph.push(`[${f}:v]scale=w='trunc(${W}*(1+0.035*t/${d})/2)*2':h=-2:eval=frame,crop=${W}:${CARD_H},setsar=1[f${i}]`,
                 `[${b}:v]setsar=1[b${i}]`,
                 `[b${i}][f${i}]overlay=0:${(H - CARD_H) / 2}:shortest=1,fps=30,format=yuv420p,fade=t=in:st=0:d=0.2,fade=t=out:st=${(d - 0.2).toFixed(2)}:d=0.2[v${i}]`);
      if (wavs) {
        const wav = join(dir, `a${i}.wav`);
        writeFileSync(wav, wavs[i]);
        args.push("-i", wav);
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
    return { mp4, seconds: +lengths.reduce((a, b) => a + b, 0).toFixed(1), voiced: !!wavs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
