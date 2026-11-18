// Gemini's speech model (WEBSITE.listen): words read aloud as a WAV (24 kHz, mono, 16-bit), with the paper's AI Studio key
// (GOOGLE_AI_KEY; free of charge on the free tier, and it reads Gujarati, Hindi and English). Used by Listen
// (app/api/listen) and the Reels' voice (engine/reel.ts); both count their letters together, at most dayLetters a day.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { WEBSITE } from "./config.ts";
import { count } from "./write.ts";

type Sql = NeonQueryFunction<false, false>;

/** the audio in Gemini's answer, wherever it sits (Interactions: steps[].content[] of type "audio") */
function audioIn(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.type === "audio" && typeof o.data === "string") return o.data;
  if (o.inlineData && typeof (o.inlineData as { data?: unknown }).data === "string") return (o.inlineData as { data: string }).data;
  for (const v of Object.values(o)) { const a = audioIn(v); if (a) return a; }
  return null;
}

export class SpeechError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** the words as a WAV; throws SpeechError (429 past the day's letters, 502 when Gemini doesn't answer) */
export async function speak(sql: Sql | null, text: string, style = "a calm, clear news reader"): Promise<Buffer> {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key || !WEBSITE.listen.on) throw new SpeechError("no voice", 404);
  if (sql) {
    const [d] = await sql.query(`select coalesce(sum(n), 0)::int as n from usage where kind = 'listen_letters' and day = (now() at time zone 'Asia/Kolkata')::date`);
    if (Number(d?.n ?? 0) + text.length > WEBSITE.listen.dayLetters) throw new SpeechError("today's reading is used up", 429);
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", signal: AbortSignal.timeout(50_000),
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model: WEBSITE.listen.model,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: WEBSITE.listen.voice }] },
    }),
  }).catch(() => null);
  const audio = r?.ok ? audioIn(await r.json().catch(() => null)) : null;
  if (!audio) throw new SpeechError(`Gemini's voice didn't answer (${r?.status ?? "no answer"}) ${r && !r.ok ? (await r.text().catch(() => "")).slice(0, 300) : ""}`.trim(), 502);
  if (sql) await count(sql, "listen_letters", text.length).catch(() => 0);
  return Buffer.from(audio, "base64");
}

/** a WAV's length in seconds, from its header (the "fmt " chunk's byte rate and the "data" chunk's size) */
export function wavSeconds(wav: Buffer): number {
  if (wav.toString("ascii", 0, 4) !== "RIFF") return wav.length / 48_000;
  let at = 12, rate = 48_000;
  while (at + 8 <= wav.length) {
    const id = wav.toString("ascii", at, at + 4), size = wav.readUInt32LE(at + 4);
    if (id === "fmt ") rate = wav.readUInt32LE(at + 16);
    if (id === "data") return Math.min(size, wav.length - at - 8) / rate;
    at += 8 + size + (size % 2);
  }
  return 0;
}
