"use client";
// Instagram's log on the editor page (lib/insta.ts): asked again every 4 seconds while the page is in view, on its own,
// so each step shows as it happens, also while a button's work is still going (4 Nov: "nothing gets logged": the page
// itself is drawn again only when a button's work ends). A log that can't be read says why.
import { useEffect, useState } from "react";
import type { InstaLogLine } from "@/lib/insta.ts";
import { num } from "@/lib/format.ts";
import s from "./editor.module.css";

const WORDS = {
  gu: { none: "હજી કંઈ નોંધાયું નથી.", help: "નવું ઉપર. દર થોડી સેકન્ડે જાતે તાજું થાય છે.", engine: "એન્જિન", instagram: "ઇન્સ્ટાગ્રામ", broken: "લોગ વંચાતો નથી:" },
  en: { none: "Nothing yet.", help: "Newest first. It renews itself every few seconds.", engine: "Engine", instagram: "Instagram", broken: "The log can't be read:" },
};

export default function InstaLog({ lang, first }: { lang: "gu" | "en"; first: InstaLogLine[] }) {
  const w = WORDS[lang];
  const [logs, setLogs] = useState(first);
  const [why, setWhy] = useState("");
  useEffect(() => {
    let on = true;
    const look = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/editor/instalog", { cache: "no-store" });
        const j = (await r.json()) as { logs?: InstaLogLine[]; error?: string };
        if (!on) return;
        if (j.logs) { setLogs(j.logs); setWhy(""); } else setWhy(j.error ?? String(r.status));
      } catch (e) {
        if (on) setWhy(e instanceof Error ? e.message : String(e));
      }
    };
    const t = setInterval(look, 4000);
    return () => { on = false; clearInterval(t); };
  }, []);
  const clock = (iso: string) => {
    const t = new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(11, 19);
    return lang === "gu" ? num(t, "gu") : t;
  };
  return (
    <>
      <p className={s.help}>{w.help}</p>
      {why && <p className={s.why}>{w.broken} {why}</p>}
      {logs.length ? (
        <ol className={s.log}>{logs.map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <time dateTime={l.at}>{clock(l.at)}</time>
            <b>{l.who === "engine" ? w.engine : l.who === "instagram" ? w.instagram : l.who}</b>
            <span>{l.line}</span>
          </li>
        ))}</ol>
      ) : <p className={s.help}>{w.none}</p>}
    </>
  );
}
