"use client";
// An article's tools (DESIGN.md §3.5): WhatsApp, copy the link, text size,
// save; on a phone, a reading bar at the bottom with WhatsApp and text size.
import Link from "next/link";
import { useEffect, useState } from "react";
import { applySize } from "./Chrome.tsx";
import { LinkIcon, SaveIcon, TextSize, WhatsApp } from "./icons.tsx";

interface Props {
  id: string;
  url: string;
  headline: string;
  /** the reader's saved stories page, in their language */
  savedHref: string;
  words: Record<"share" | "shareShort" | "copy" | "copied" | "save" | "saved" | "savedToast" | "unsavedToast" | "size" | "seeSaved" | "savedOffline", string>;
}

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

/** The saved stories' ids, newest saved first (kept in this browser only). */
export const savedIds = (): string[] => { try { return JSON.parse(read("ck-saved", "[]")); } catch { return []; } };
/** Saves a story or takes it off; the offline helper (public/sw.js) keeps a saved story's page for reading without internet. */
function mark(id: string, on: boolean) {
  const list = savedIds();
  write("ck-saved", JSON.stringify(on ? [id, ...list.filter((x) => x !== id)] : list.filter((x) => x !== id)));
  try { navigator.serviceWorker?.controller?.postMessage({ type: on ? "save" : "unsave", id, path: location.pathname }); } catch { /* no helper */ }
}
export const forget = (id: string) => mark(id, false);

export default function ArticleTools({ id, url, headline, savedHref, words: w }: Props) {
  const [size, setSize] = useState("1");
  const [saved, setSaved] = useState(false);
  // a saved story's note says it reads offline too (only where the offline helper runs) and leads to the saved stories
  const [toast, setToast] = useState<{ text: string; note?: string; link?: boolean } | null>(null);
  useEffect(() => {
    setSize(read("ck-size", "1"));
    setSaved(savedIds().includes(id));
  }, [id]);
  useEffect(() => { if (!toast) return; const k = setTimeout(() => setToast(null), toast.link ? 4500 : 2200); return () => clearTimeout(k); }, [toast]);

  const wa = `https://wa.me/?text=${encodeURIComponent(`${headline}\n${url}`)}`;
  const setTo = (v: string) => { setSize(v); write("ck-size", v); applySize(v); };
  const save = () => {
    const on = !savedIds().includes(id);
    mark(id, on);
    setSaved(on);
    setToast(on ? { text: w.savedToast, note: navigator.serviceWorker?.controller ? w.savedOffline : undefined, link: true } : { text: w.unsavedToast });
  };
  const copy = () => { navigator.clipboard?.writeText(url).then(() => setToast({ text: w.copied }), () => setToast({ text: url })); };

  return (
    <>
      <div className="tools">
        <a className="tool wa" href={wa} target="_blank" rel="noopener"><WhatsApp />{w.shareShort}</a>
        <button type="button" className="tool" onClick={copy} aria-label={w.copy} title={w.copy}><LinkIcon /></button>
        <span className="sizes" role="group" aria-label={w.size}>
          {["1", "2", "3"].map((n) => <button key={n} type="button" aria-pressed={size === n} onClick={() => setTo(n)}>અ</button>)}
        </span>
        <button type="button" className={`tool save${saved ? " on" : ""}`} onClick={save} aria-pressed={saved}><SaveIcon on={saved} />{saved ? w.saved : w.save}</button>
      </div>
      <div className="readbar">
        <a className="wa" href={wa} target="_blank" rel="noopener"><WhatsApp />{w.shareShort}</a>
        <button type="button" className="ib" aria-label={w.size} onClick={() => setTo(String((Number(size) % 3) + 1))}><TextSize /></button>
        <button type="button" className={`ib${saved ? " on" : ""}`} aria-label={saved ? w.saved : w.save} aria-pressed={saved} onClick={save}><SaveIcon on={saved} /></button>
      </div>
      {toast && (
        <div className={`toast${toast.link ? " big" : ""}`} role="status">
          <span>{toast.text}{toast.note && <small>{toast.note}</small>}</span>
          {toast.link && <Link prefetch={false} href={savedHref}>{w.seeSaved}</Link>}
        </div>
      )}
    </>
  );
}
