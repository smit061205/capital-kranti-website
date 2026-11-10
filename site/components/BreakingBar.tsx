"use client";
// Breaking news across the top of every page (DESIGN.md §3.1, "breaking bar"; ROADMAP §4): the story the engine
// scored 9.5 or more in the last three hours. Closed, that story's bar stays away on this phone; it goes by itself
// when the three hours are up. The reader's browser asks for it (app/api/breaking, kept by the CDN for a minute), so no
// page carries it or the time it was made: a page made again with nothing changed costs Vercel no "ISR write" (7 Nov).
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "../lib/types.ts";

const KEY = "ck-brk";
export interface Brk { id: string; headline: string; href: string; until: number }

export default function BreakingBar({ lang, label, close }: { lang: Lang; label: string; close: string }) {
  const [brk, setBrk] = useState<Brk | null>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    let live = true;
    // the answer is kept a minute in this tab, so the next page shows the bar as it opens instead of a moment after
    const NOW = `ck-brk-now-${lang}`;
    try {
      const kept = JSON.parse(sessionStorage.getItem(NOW) ?? "null") as { at: number; b: Brk | null } | null;
      if (kept && Date.now() - kept.at < 60_000) { setBrk(kept.b); return; }
    } catch { /* asked for below */ }
    fetch(`/api/breaking?lang=${lang}`).then((r) => r.json() as Promise<Brk | null>).then((b) => {
      try { sessionStorage.setItem(NOW, JSON.stringify({ at: Date.now(), b })); } catch { /* private window */ }
      if (live) setBrk(b);
    }).catch(() => {});
    return () => { live = false; };
  }, [lang]);
  useEffect(() => {
    if (!brk) return;
    // not on the breaking story's own page (10 Nov: the bar there linked to the page it was on)
    if (location.pathname.endsWith(`/news/${brk.id}`)) { setOn(false); return; }
    try { if (localStorage.getItem(KEY) === brk.id) { setOn(false); return; } } catch { /* shown */ }
    setOn(true);
    const left = brk.until - Date.now();
    if (left <= 0) { setOn(false); return; }
    const t = setTimeout(() => setOn(false), left);
    return () => clearTimeout(t);
  }, [brk]);
  if (!brk || !on) return null;
  return (
    <div className="breaking" role="region" aria-label={label}>
      <div className="wrap">
        <b>{label}:</b>
        <Link prefetch={false} href={brk.href}>{brk.headline}</Link>
        <button type="button" aria-label={close} onClick={() => { setOn(false); try { localStorage.setItem(KEY, brk.id); } catch { /* closed for now */ } }}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
