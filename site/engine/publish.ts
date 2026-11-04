// Step 6 (ROADMAP §3): a written, checked story into the website's database,
// live at once or held for the editor, with its official photo (only an
// official source's, §2) in the photo store and every source it came from.
import { createHash } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { WEBSITE } from "../lib/config.ts";
import type { English, Photo, Tier } from "../lib/types.ts";
import { count } from "../lib/write.ts";
import { UA } from "./fetch.ts";
import { officialHost } from "./sources.ts";
import type { Checked, SourceText, Written } from "./newsroom.ts";

type Sql = NeonQueryFunction<false, false>;

/** India's date now (a live story belongs to the day it went up, India time). */
export const indiaDate = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** An official photo, shown from the government's own site through the site's /official address (app/official), which
 *  makes it smaller and keeps it (4 Nov: copied into the photo store, it took one of the day's 50 uploads, and after the
 *  fiftieth every official photo was thrown away). Each of the story's official photos is tried, the first good one kept:
 *  a real photo, 600 by 300 or larger. */
export async function photoOf(_sql: Sql, src: SourceText[], _storyId: string): Promise<Photo | null> {
  for (const url of [...new Set(src.filter((s) => s.official && s.image).map((s) => s.image!))]) {
    const p = await linkPhoto(url);
    if (p) return p;
  }
  return null;
}

/** An official photo's /official address and size, when it's a real photo large enough to show. */
export async function linkPhoto(url: string): Promise<Photo | null> {
  try {
    const abs = new URL(url);
    // only from an official source's own site, which app/official fetches from (a photo on a CDN elsewhere isn't shown)
    if (!/^https?:$/.test(abs.protocol) || !officialHost(abs.hostname) || /\.(svg|gif)(\?|$)/i.test(abs.pathname) || /logo|emblem|icon|placeholder/i.test(abs.pathname)) return null;
    const res = await fetch(abs, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return null;
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height ?? 0, meta.width ?? 0] : [meta.width ?? 0, meta.height ?? 0];
    if (w < 600 || h < 300 || w / h > 3) return null; // an icon, a banner strip, or too small to show large
    const width = Math.min(w, 1200);
    return { url: `/official/${Buffer.from(abs.href).toString("base64url")}.jpg`, width, height: Math.round((h * width) / w) };
  } catch {
    return null;
  }
}

/** A photo fetched, made 1200 px wide (an Aavtikal cover 1920, 30 Oct) and kept in the photo store; null when it's too
 *  small or the day's uploads are used up. */
export async function storePhoto(sql: Sql, url: string, storyId: string, ua = UA, width = 1200): Promise<Photo | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if ((await count(sql, "upload", 0)) >= WEBSITE.dailyUploads) return null;
  try {
    const res = await fetch(url, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return await storeImage(sql, Buffer.from(await res.arrayBuffer()), storyId, width);
  } catch {
    return null;
  }
}

/** An image already in hand made a JPEG and kept in the photo store (storePhoto's second half). */
export async function storeImage(sql: Sql, image: Buffer, storyId: string, width = 1200): Promise<Photo | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if ((await count(sql, "upload", 0)) >= WEBSITE.dailyUploads) return null;
  try {
    const { data, info } = await sharp(image).rotate()
      .resize({ width, withoutEnlargement: true }).jpeg({ quality: width > 1200 ? 82 : 78, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (info.width < 400 || info.height < 220) return null; // an icon or a banner strip
    const name = `live/${indiaDate()}/${storyId}-${createHash("sha256").update(data).digest("hex").slice(0, 10)}.jpg`;
    await put(name, data, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    await count(sql, "upload");
    return { url: `/media/${name}`, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

export interface LiveStory {
  id: string; tier: Tier; genres: string[]; written: Written; checked: Checked; src: SourceText[];
  importance: number; status: "published" | "held"; holdReason: string | null;
  en: English | null; hi: English | null; translated: boolean; photo: Photo | null;
}

export async function saveLive(sql: Sql, s: LiveStory) {
  const primary = s.src[0];
  const sources = s.src.map((x) => ({ name: x.source.name, url: x.url, trust: x.source.trust, group: x.source.group }));
  const checks = { problems: s.checked.problems, claims: s.checked.claims, checker: s.checked.model ?? null, writer: s.written.model, cut: s.checked.cut ?? 0 };
  await sql.query(
    `insert into stories (id, origin, issue_date, published_at, updated_at, tier, genres, tag_status, kicker, headline, deck, body, caption,
                          photo, source, checked, en, en_status, hi, hi_status, status, importance, sources, checks, hold_reason)
     values ($1, 'live', $2, now(), now(), $3, $4, 'done', $5, $6, $7, $8, $9, $10, $11, true, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     on conflict (id) do nothing`,
    [s.id, indiaDate(), s.tier, s.genres, s.written.kicker, s.written.headline, s.written.deck, s.written.body, s.photo ? s.written.caption : "",
     s.photo ? JSON.stringify(s.photo) : null,
     JSON.stringify({ kind: primary.url.includes("pib.gov.in") ? "pib" : "other", name: primary.source.name, url: primary.url }),
     s.en ? JSON.stringify(s.en) : null, s.translated ? (s.en ? "done" : "failed") : "skipped",
     s.hi ? JSON.stringify(s.hi) : null, s.translated ? (s.hi ? "done" : "failed") : "none",
     s.status, s.importance, JSON.stringify(sources), JSON.stringify(checks), s.holdReason]);
}
