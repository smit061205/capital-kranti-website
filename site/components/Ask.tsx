"use client";
// "Ask the newsroom" (lib/ask.ts, app/api/ask): the reader types or speaks a question; the answer is written as it comes,
// each point marked with the number of its story, the stories listed under it as links. An answer can be listened to
// with the phone's own voice (components/Listen.tsx). The conversation stays on the page only.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useListen } from "./Listen.tsx";
import { Speaker, StopIcon } from "./icons.tsx";

export interface AskWords {
  placeholder: string; send: string; mic: string; listening: string; thinking: string; sources: string; note: string;
  tries: string[]; again: string; stop: string; listen: string; listenStop: string; failed: string;
}

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const recognizer = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
const sourcesOf = (m: UIMessage) => m.parts.flatMap((p) => (p.type === "source-url" ? [{ url: p.url, title: p.title ?? p.url }] : []));

/** the answer's text with each [n] made a link to its story */
function Cited({ text, sources }: { text: string; sources: { url: string; title: string }[] }) {
  return (
    <>
      {text.split(/(\[\d+(?:,\s*\d+)*\])/g).map((bit, i) => {
        const nums = bit.match(/^\[(\d+(?:,\s*\d+)*)\]$/)?.[1].split(/,\s*/).map(Number);
        if (!nums) return <Fragment key={i}>{bit}</Fragment>;
        return <sup key={i} className="cite">{nums.map((n) => sources[n - 1]
          ? <a key={n} href={sources[n - 1].url} title={sources[n - 1].title}>{n}</a> : <span key={n}>{n}</span>)}</sup>;
      })}
    </>
  );
}

function Answer({ m, lang, w, last, busy, failed }: { m: UIMessage; lang: string; w: AskWords; last: boolean; busy: boolean; failed?: string }) {
  const text = textOf(m);
  const sources = sourcesOf(m);
  const plain = useCallback(async () => text.replace(/\[\d+(?:,\s*\d+)*\]/g, ""), [text]);
  const listen = useListen({ lang, server: false, audio: "", text: plain });
  // once the answer is written, only the stories it cites (with their numbers); while it's written, all it may use
  const cited = new Set([...text.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)].flatMap((x) => x[1].split(/,\s*/).map(Number)));
  const numbered = sources.map((s, i) => ({ ...s, n: i + 1 }));
  const shown = !(last && busy) && cited.size ? numbered.filter((s) => cited.has(s.n)) : numbered;
  return (
    <div className="ans">
      {text ? <p><Cited text={text} sources={sources} /></p> : <p className="wait">{failed || w.thinking}</p>}
      {text && failed && <p className="wait">{failed}</p>}
      {shown.length > 0 && text && (
        <div className="srcs">
          <h3>{w.sources}</h3>
          <ol>{shown.map((s) => <li key={s.url}><a href={s.url}><span className="n">{s.n}</span>{s.title}</a></li>)}</ol>
        </div>
      )}
      {text && !(last && busy) && listen.can && (
        <button type="button" className={`tool listen${listen.on ? " on" : ""}`} onClick={listen.toggle} aria-pressed={listen.on}>
          {listen.on ? <StopIcon /> : <Speaker />}{listen.on ? w.listenStop : w.listen}
        </button>
      )}
    </div>
  );
}

export default function Ask({ lang, words: w }: { lang: string; words: AskWords }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/ask", body: { lang } }), [lang]);
  const { messages, sendMessage, status, stop, setMessages, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const [hearing, setHearing] = useState(false);
  const [canHear, setCanHear] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => setCanHear(!!recognizer()), []);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages]);

  const ask = (q: string) => {
    const text = q.trim().slice(0, 300);
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };
  const hear = () => {
    const R = recognizer();
    if (!R) return;
    if (hearing) { rec.current?.stop(); return; }
    const r = new R();
    r.lang = `${lang}-IN`;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { const said = e.results[0]?.[0]?.transcript ?? ""; if (said) ask(said); };
    r.onend = () => setHearing(false);
    r.onerror = () => setHearing(false);
    rec.current = r;
    setHearing(true);
    r.start();
  };

  return (
    <div className="ask">
      {messages.length === 0 && (
        <div className="tries">{w.tries.map((q) => <button key={q} type="button" onClick={() => ask(q)}>{q}</button>)}</div>
      )}
      <div className="talk" aria-live="polite">
        {messages.map((m, i) => m.role === "user"
          ? <p key={m.id} className="q">{textOf(m)}</p>
          : <Answer key={m.id} m={m} lang={lang} w={w} last={i === messages.length - 1} busy={busy}
                    failed={status === "error" && i === messages.length - 1 ? error?.message || w.failed : undefined} />)}
        {(status === "submitted" || status === "error") && messages.at(-1)?.role === "user" &&
          <div className="ans"><p className="wait">{status === "error" ? error?.message || w.failed : w.thinking}</p></div>}
        <div ref={end} />
      </div>
      <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={hearing ? w.listening : w.placeholder}
               maxLength={300} aria-label={w.placeholder} enterKeyHint="send" />
        {canHear && (
          <button type="button" className={`mic${hearing ? " on" : ""}`} onClick={hear} aria-label={w.mic} title={w.mic} aria-pressed={hearing}>
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
          </button>
        )}
        {busy
          ? <button type="button" className="go" onClick={() => stop()}>{w.stop}</button>
          : <button type="submit" className="go" disabled={!input.trim()}>{w.send}</button>}
      </form>
      <p className="asknote">{w.note}
        {messages.length > 0 && !busy && <> · <button type="button" className="again" onClick={() => setMessages([])}>{w.again}</button></>}</p>
    </div>
  );
}
