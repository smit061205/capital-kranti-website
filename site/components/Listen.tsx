"use client";
// "Listen" (19 Nov, the Buildathon deck): a story, or the day's top stories, read aloud. With Gemini's voice on the server
// (app/api/listen) it plays the parts one after another in one player (so an iPhone, which lets sound start only from a
// tap, keeps playing); otherwise, or when Gemini fails, the phone's own voice reads it (the browser's speech, free), and
// then the button shows only where the phone has a voice for the language.
import { useCallback, useEffect, useRef, useState } from "react";
import { Speaker, StopIcon } from "./icons.tsx";

export interface ListenWords { listen: string; listenStop: string }
interface Source {
  lang: string;
  /** Gemini's voice is on the server */
  server: boolean;
  /** the parts' address, without the part (with a version, so the CDN keeps each) */
  audio: string;
  /** the words, for the phone's own voice: read from the page, or fetched */
  text: () => Promise<string>;
}

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);
const voiceFor = (lang: string) => {
  const all = synth()?.getVoices() ?? [];
  const of = all.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang));
  return of.find((v) => /-in$/i.test(v.lang.replace("_", "-"))) ?? of[0] ?? null;
};
/** sentences in pieces of at most 200 letters (Chrome stops a long one partway) */
const pieces = (text: string) => {
  const out: string[] = [];
  for (const sent of text.split(/(?<=[.!?।\n])\s+/).map((x) => x.trim()).filter(Boolean)) {
    let rest = sent;
    while (rest.length > 200) { const cut = rest.lastIndexOf(" ", 200); out.push(rest.slice(0, cut > 60 ? cut : 200)); rest = rest.slice(cut > 60 ? cut + 1 : 200); }
    out.push(rest);
  }
  return out;
};

/** one reading at a time on the page: starting one stops the others */
let stopOthers: (() => void) | null = null;

export function useListen({ lang, server, audio, text }: Source) {
  const [voice, setVoice] = useState(false);
  const [on, setOn] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const look = () => setVoice(!!voiceFor(lang));
    look();
    s.addEventListener?.("voiceschanged", look);
    return () => s.removeEventListener?.("voiceschanged", look);
  }, [lang]);
  const stop = useCallback(() => {
    player.current?.pause();
    player.current = null;
    synth()?.cancel();
    setOn(false);
  }, []);
  useEffect(() => stop, [stop]);

  const speak = useCallback(async () => {
    const s = synth();
    const v = voiceFor(lang);
    if (!s || !v) { setOn(false); return; }
    const words = pieces(await text());
    if (!words.length) { setOn(false); return; }
    s.cancel();
    words.forEach((w, i) => {
      const u = new SpeechSynthesisUtterance(w);
      u.voice = v; u.lang = v.lang; u.rate = 0.95;
      if (i === words.length - 1) u.onend = () => setOn(false);
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") setOn(false); };
      s.speak(u);
    });
  }, [lang, text]);

  const toggle = useCallback(() => {
    if (on) { stop(); return; }
    stopOthers?.();
    stopOthers = stop;
    setOn(true);
    // Safari lets speech start only inside the tap: an empty word now, so the real ones may follow the fetch
    try { synth()?.speak(new SpeechSynthesisUtterance("")); } catch { /* no speech */ }
    if (server) {
      const a = new Audio(`${audio}&part=0`);
      player.current = a;
      let at = 0;
      let total = 1;
      fetch(`${audio}&format=count`).then((r) => r.json()).then((j: { parts?: number }) => { total = j.parts ?? 1; }).catch(() => 0);
      const warm = (n: number) => { if (n < total) fetch(`${audio}&part=${n}`).catch(() => 0); };
      a.onplaying = () => warm(at + 1);
      a.onended = () => {
        if (player.current !== a) return;
        at += 1;
        if (at >= total) { player.current = null; setOn(false); return; }
        a.src = `${audio}&part=${at}`;
        a.play().catch(() => 0);
      };
      // Gemini's voice not there (switched off, today's reading used up, an error): from the start, the phone's own
      // voice; partway through, it stops
      a.onerror = () => {
        if (player.current !== a) return;
        player.current = null;
        if (at === 0) speak(); else setOn(false);
      };
      a.play().catch(() => 0);
    } else speak();
  }, [on, server, audio, speak, stop]);

  return { can: server || voice, on, toggle };
}

/** a story's words as the reader sees them: the headline, the sub-heading and the paragraphs */
export const pageText = () => {
  const art = document.querySelector(".art");
  if (!art) return "";
  const parts = [art.querySelector("h1"), art.querySelector(".stand"), ...art.querySelectorAll(".body > div > p")];
  return parts.map((e) => e?.textContent?.trim()).filter(Boolean).join("\n");
};

/** The day's brief: a button for the home page */
export function ListenBrief({ lang, server, label, words }: { lang: string; server: boolean; label: string; words: ListenWords }) {
  const text = useCallback(async () => {
    const r = await fetch(`/api/listen?brief=1&lang=${lang}&format=text`).catch(() => null);
    return r?.ok ? (((await r.json()) as { text?: string }).text ?? "") : "";
  }, [lang]);
  const { can, on, toggle } = useListen({ lang, server, audio: `/api/listen?brief=1&lang=${lang}`, text });
  if (!can) return null;
  return (
    <button type="button" className={`brief${on ? " on" : ""}`} onClick={toggle} aria-pressed={on}>
      {on ? <StopIcon /> : <Speaker />}<span>{on ? words.listenStop : label}</span>
    </button>
  );
}
