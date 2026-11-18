// "Ask the newsroom" (lib/ask.ts): a reader's question, answered as it is written (the Vercel AI SDK's UI message
// stream, read by components/Ask.tsx with useChat), from the paper's own stories, which come first as the answer's
// sources. Only from the site's own pages (no one else's app uses the paper's free AI), at most ASK.perReader questions
// a day for one reader and ASK.day for the site.
import { createHash } from "node:crypto";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream, type ModelMessage, type UIMessage } from "ai";
import { ASK, promptFor, storiesFor, storyUrl } from "@/lib/ask.ts";
import { db } from "@/lib/db.ts";
import { words } from "@/components/cards.tsx";
import { count } from "@/lib/write.ts";
import type { Lang } from "@/lib/types.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SORRY: Record<Lang, { busy: string; limit: string; failed: string }> = {
  gu: { busy: "આજે પ્રશ્નો ઘણા આવ્યા છે; કાલે ફરી પૂછજો.", limit: "આજના તમારા પ્રશ્નો પૂરા થયા; કાલે ફરી પૂછજો.", failed: "હમણાં જવાબ આપી શકાતો નથી; થોડી વાર પછી ફરી પૂછો." },
  en: { busy: "Many questions came in today; please ask again tomorrow.", limit: "You've asked today's questions; please ask again tomorrow.", failed: "The answer couldn't be written just now; please try again in a little while." },
  hi: { busy: "आज बहुत प्रश्न आए हैं; कल फिर पूछिए।", limit: "आज के आपके प्रश्न पूरे हुए; कल फिर पूछिए।", failed: "अभी उत्तर नहीं दिया जा सका; थोड़ी देर बाद फिर पूछिए।" },
};

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();

/** a short answer that isn't the model's: the same stream, so the page shows it like any answer */
const say = (text: string) => createUIMessageStreamResponse({
  stream: createUIMessageStream({ execute: ({ writer }) => {
    writer.write({ type: "start" });
    writer.write({ type: "text-start", id: "t" });
    writer.write({ type: "text-delta", id: "t", delta: text });
    writer.write({ type: "text-end", id: "t" });
    writer.write({ type: "finish" });
  } }),
});

export async function POST(req: Request) {
  // the site's own pages only
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  if ((site && site !== "same-origin") || (origin && new URL(origin).host !== new URL(req.url).host)) return new Response("not here", { status: 403 });
  const body = (await req.json().catch(() => null)) as { messages?: UIMessage[]; lang?: string } | null;
  const lang = (["gu", "en", "hi"].includes(body?.lang ?? "") ? body!.lang : "gu") as Lang;
  const messages = Array.isArray(body?.messages) ? body!.messages.slice(-7) : [];
  const last = messages.at(-1);
  const q = last?.role === "user" ? textOf(last).slice(0, ASK.letters) : "";
  if (!q) return new Response("no question", { status: 400 });
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) return say(SORRY[lang].failed);

  const sql = db();
  if (sql) {
    // a reader is counted by a hash of their address and the day, never the address itself
    const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const who = createHash("sha256").update(`${ip}|${day}|${process.env.CK_SESSION_SECRET ?? ""}`).digest("hex").slice(0, 16);
    const [mine, all] = await Promise.all([count(sql, `ask_reader:${who}`, 1), count(sql, "ask", 1)]).catch(() => [0, 0]);
    if (Number(all) > ASK.day) return say(SORRY[lang].busy);
    if (Number(mine) > ASK.perReader) return say(SORRY[lang].limit);
    // yesterday's readers' counts aren't needed any more
    if (Number(all) % 50 === 1) await sql.query(`delete from usage where kind like 'ask_reader:%' and day < (now() at time zone 'Asia/Kolkata')::date`).catch(() => 0);
  }

  const stories = await storiesFor(q, lang);
  // the conversation so far, short, then the question with the stories it may use
  const before: ModelMessage[] = messages.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: textOf(m).slice(0, 600) } as ModelMessage))
    .filter((m) => m.content).slice(-4);
  const google = createGoogleGenerativeAI({ apiKey: key });

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      stories.forEach((s, i) => writer.write({ type: "source-url", sourceId: `s${i + 1}`, url: storyUrl(s, lang), title: words(s, lang).headline }));
      const result = streamText({
        model: google(ASK.model),
        messages: [...before, { role: "user", content: promptFor(q, stories, lang) }],
        temperature: 0.2,
        maxOutputTokens: 2000,
        providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal", includeThoughts: false } } },
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false, sendReasoning: false,
        onError: (e) => { console.error(`ask: ${e instanceof Error ? e.message : e}`.slice(0, 400)); return SORRY[lang].failed; } }));
    },
    onError: (e) => { console.error(`ask: ${e instanceof Error ? e.message : e}`); return SORRY[lang].failed; },
  });
  return createUIMessageStreamResponse({ stream });
}
