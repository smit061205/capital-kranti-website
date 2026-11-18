// A story, or the day's brief, read aloud by Gemini's speech model (lib/listen.ts, WEBSITE.listen), a part at a time:
// Gemini answers WAV, about 2.9 MB a minute, and a function's answer is at most 4.5 MB, so the reader's page plays the
// parts one after another (components/Listen.tsx). Each part's address always reads the same words (a story's carries
// when it changed), so the CDN keeps it and Gemini reads it once.
//   ?id=<story>&lang=gu|en|hi&v=<when it changed>&part=<n>    ?brief=1&lang=gu&part=<n>
//   &format=count: how many parts       ?brief=1&lang=gu&format=text: the brief's words, for the phone's own voice
import { db } from "@/lib/db.ts";
import { briefText, listenParts, serverVoice } from "@/lib/listen.ts";
import { speak, SpeechError } from "@/lib/speech.ts";
import type { Lang } from "@/lib/types.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const no = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "public, max-age=0, s-maxage=120" } });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lang = (["gu", "en", "hi"].includes(q.get("lang") ?? "") ? q.get("lang") : "gu") as Lang;
  const id = q.get("brief") ? null : q.get("id");
  if (id !== null && !/^[a-z0-9-]{1,60}$/.test(id ?? "")) return no(404, "no such story");
  const keep = id ? "public, max-age=86400, s-maxage=2592000" : "public, max-age=300, s-maxage=900";
  if (!id && q.get("format") === "text") return Response.json({ text: (await briefText(lang)).join("\n") }, { headers: { "cache-control": keep } });
  if (!serverVoice()) return no(404, "no voice on the server");
  const all = await listenParts(id, lang);
  if (!all.length) return no(404, "nothing to read");
  if (q.get("format") === "count") return Response.json({ parts: all.length }, { headers: { "cache-control": keep } });
  const n = Number(q.get("part") ?? 0);
  const text = Number.isInteger(n) ? all[n] : undefined;
  if (!text) return no(404, "no such part");

  try {
    const wav = await speak(db(), text);
    return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav", "cache-control": keep } });
  } catch (e) {
    const err = e instanceof SpeechError ? e : new SpeechError(String(e), 502);
    if (err.status === 502) console.error(`listen: ${err.message}`);
    return no(err.status, err.status === 502 ? "Gemini's voice didn't answer" : err.message);
  }
}
