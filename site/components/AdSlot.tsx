"use client";
// A place for one of the paper's own banner ads (lib/banners.ts; the user, 13 Nov): named as an ad, below the first
// screen, and empty when there's none. The ads are asked for by the reader's browser (app/api/ads, kept five minutes), so
// no page carries one: putting an ad up or taking it down makes no page again (CLAUDE.md, Vercel's free plan), and a
// page opens as fast with ads as without. A click goes through app/api/ads/go, which counts it.
// To see the places without an ad running: any page with ?adtest=1 shows a grey sample in each.
import { useEffect, useState } from "react";
import type { Lang } from "../lib/types.ts";
import type { ShownBanner, Slot } from "../lib/banners.ts";
import { pic } from "../lib/photo.ts";

const LABEL: Record<Lang, string> = { gu: "જાહેરાત", en: "Advertisement", hi: "विज्ञापन" };
const KEPT = "ck-ads";

/** today's banners, asked for once a tab every five minutes */
let asked: Promise<ShownBanner[]> | null = null;
function today(): Promise<ShownBanner[]> {
  try {
    const kept = JSON.parse(sessionStorage.getItem(KEPT) ?? "null") as { at: number; ads: ShownBanner[] } | null;
    if (kept && Date.now() - kept.at < 5 * 60_000) return Promise.resolve(kept.ads);
  } catch { /* asked for below */ }
  asked ??= fetch("/api/ads").then((r) => (r.ok ? r.json() : { ads: [] })).then((d: { ads?: ShownBanner[] }) => {
    const ads = Array.isArray(d.ads) ? d.ads : [];
    try { sessionStorage.setItem(KEPT, JSON.stringify({ at: Date.now(), ads })); } catch { /* private window */ }
    return ads;
  }).catch(() => []).finally(() => { setTimeout(() => { asked = null; }, 5 * 60_000); });
  return asked;
}

/** a grey sample banner, for looking at the places (?adtest=1) */
const sample = (slot: Slot): ShownBanner => {
  const [w, h] = slot === "mid" ? [1200, 500] : [1200, 300];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#d9d2c5"/><text x="50%" y="50%" fill="#6b655b" font-family="sans-serif" font-size="56" font-weight="700" text-anchor="middle" dominant-baseline="middle">${w} × ${h}</text></svg>`;
  return { id: "", image: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: w, height: h, name: "", slots: [slot] };
};

/** the banners already on this page, so its two places don't show the same one */
const shown = new Map<string, Set<string>>();

export default function AdSlot({ slot, lang }: { slot: Slot; lang: Lang }) {
  const [ad, setAd] = useState<ShownBanner | null>(null);
  useEffect(() => {
    let live = true;
    if (new URLSearchParams(location.search).has("adtest")) { setAd(sample(slot)); return; }
    const page = location.pathname;
    today().then((ads) => {
      if (!live) return;
      const here = shown.get(page) ?? new Set<string>();
      shown.set(page, here);
      const fit = ads.filter((a) => a.slots.includes(slot));
      const fresh = fit.filter((a) => !here.has(a.id));
      const pick = (fresh.length ? fresh : fit)[Math.floor(Math.random() * (fresh.length || fit.length))];
      if (pick) { here.add(pick.id); setAd(pick); }
    });
    return () => { live = false; shown.delete(page); };
  }, [slot]);
  if (!ad) return null;
  const img = ad.id ? pic({ url: ad.image, width: ad.width }, "(max-width: 800px) 92vw, 728px") : { src: ad.image };
  return (
    <aside className={`adslot ad-${slot}`} aria-label={LABEL[lang]}>
      <span className="adlbl">{LABEL[lang]}</span>
      <a href={ad.id ? `/api/ads/go?id=${ad.id}` : undefined} target="_blank" rel="sponsored nofollow noopener">
        <img {...img} width={ad.width} height={ad.height} alt={ad.name || LABEL[lang]} loading="lazy" decoding="async" />
      </a>
    </aside>
  );
}
