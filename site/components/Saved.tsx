"use client";
// The reader's saved stories: kept in their own browser only (DESIGN.md §3.5), newest saved first, each with its photo,
// section and date and a button to take it off. The list is also kept on the phone, so it shows without internet
// (the stories themselves are kept by public/sw.js when saved).
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang, Photo } from "../lib/types.ts";
import { pic, SIZES } from "../lib/photo.ts";
import { sectionName } from "../lib/sections.ts";
import { dateText, num } from "../lib/format.ts";
import { forget, savedIds } from "./ArticleTools.tsx";

interface Item { id: string; headline: string; photo: Photo | null; tier: string; publishedAt: string }
const KEPT = (lang: Lang) => `ck-saved-list-${lang}`;

export default function Saved({ lang, empty, remove, count }: { lang: Lang; empty: string; remove: string; count: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    const ids = savedIds();
    if (!ids.length) { setItems([]); return; }
    let kept: Item[] = [];
    try { kept = JSON.parse(localStorage.getItem(KEPT(lang)) ?? "[]"); } catch { /* none */ }
    setItems(kept.filter((x) => ids.includes(x.id)));
    fetch(`/api/stories?lang=${lang}&ids=${encodeURIComponent(ids.slice(0, 50).join(","))}`).then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { stories: Item[] }) => {
        setItems(d.stories);
        try { localStorage.setItem(KEPT(lang), JSON.stringify(d.stories)); } catch { /* private window */ }
      }).catch(() => { /* offline: the kept list stays */ });
  }, [lang]);
  if (items === null) return null;
  if (!items.length) return <p className="empty">{empty}</p>;
  const off = (id: string) => { forget(id); setItems(items.filter((x) => x.id !== id)); };
  return (
    <>
      <p className="savedn">{num(items.length, lang)} {count}</p>
      <ul className="saved">
        {items.map((s) => (
          <li key={s.id}>
            <Link prefetch={false} className="h cmp" href={`${lang === "gu" ? "" : `/${lang}`}/news/${s.id}`}>
              <div><h3 className="h4">{s.headline}</h3><div className="meta"><span className="sec">{sectionName(s.tier, lang)}</span><span aria-hidden="true">·</span>{dateText(s.publishedAt, lang)}</div></div>
              {s.photo && <img {...pic(s.photo, SIZES.thumb)} alt="" loading="lazy" decoding="async" />}
            </Link>
            <button type="button" className="unsave" onClick={() => off(s.id)} aria-label={`${remove}: ${s.headline}`}>{remove}</button>
          </li>
        ))}
      </ul>
    </>
  );
}
