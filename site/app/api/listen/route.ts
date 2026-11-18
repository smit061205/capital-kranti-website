// A story, or the day's brief, read aloud by Gemini's speech model (lib/listen.ts, WEBSITE.listen), a part at a time:
// Gemini answers WAV, about 2.9 MB a minute, and a function's answer is at most 4.5 MB, so the reader's page plays the
// parts one after another (components/Listen.tsx). Each part's address always reads the same words (a story's carries
// when it changed), so the CDN keeps it and Gemini reads it once.
//   ?id=<story>&lang=gu|en|hi&v=<when it changed>&part=<n>    ?brief=1&lang=gu&part=<n>
//   &format=count: how many parts       ?brief=1&lang=gu&format=text: the brief's words, for the phone's own voice
import { db } from "@/lib/db.ts";
import { WEBSITE } from "@/lib/config.ts";
import { briefText, listenParts, serverVoice } from "@/lib/listen.ts";
import { count } from "@/lib/write.ts";
import type { Lang } from "@/lib/types.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const no = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "public, max-age=0, s-maxage=120" } });

/** the audio in Gemini's answer, wherever it sits (Interactions: steps[].content[] of type "audio") */
function audioIn(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.type === "audio" && typeof o.data === "string") return o.data;
  if (o.inlineData && typeof (o.inlineData as { data?: unknown }).data === "string") return (o.inlineData as { data: string }).data;
  for (const v of Object.values(o)) { const a = audioIn(v); if (a) return a; }
  return null;
}

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

  const sql = db();
  if (sql) {
    const [d] = await sql.query(`select coalesce(sum(n), 0)::int as n from usage where kind = 'listen_letters' and day = (now() at time zone 'Asia/Kolkata')::date`);
    if (Number(d?.n ?? 0) + text.length > WEBSITE.listen.dayLetters) return no(429, "today's reading is used up");
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", signal: AbortSignal.timeout(50_000),
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GOOGLE_AI_KEY! },
    body: JSON.stringify({
      model: WEBSITE.listen.model,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: "a calm, clear news reader" }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: WEBSITE.listen.voice }] },
    }),
  }).catch(() => null);
  const audio = r?.ok ? audioIn(await r.json().catch(() => null)) : null;
  if (!audio) {
    console.error(`listen: Gemini's voice didn't answer (${r?.status ?? "no answer"}) ${r && !r.ok ? (await r.text().catch(() => "")).slice(0, 300) : ""}`);
    return no(502, "Gemini's voice didn't answer");
  }
  if (sql) await count(sql, "listen_letters", text.length).catch(() => 0);
  return new Response(new Uint8Array(Buffer.from(audio, "base64")), { headers: { "content-type": "audio/wav", "cache-control": keep } });
}
