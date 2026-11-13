// The paper's own banner ads (the user, 13 Nov): the editor puts one up on the editor page (its picture, where it leads,
// where on the site it shows and for how long), and the site shows it in its places until its last day. Each click is
// counted, for the advertiser. Classified ads, in words only, are lib/classifieds.ts.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Lang } from "./types.ts";

type Sql = NeonQueryFunction<false, false>;

/** where a banner may show: between the front page's sections, inside a story after a few paragraphs, at a story's end.
 *  All below the first screen, so a page opens as fast with an ad as without. */
export const SLOTS = ["home", "mid", "end"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAMES: Record<Slot, Record<Lang, string>> = {
  home: { gu: "હોમ પેજ પર, વિભાગો વચ્ચે", en: "Front page, between sections", hi: "होम पेज पर, विभागों के बीच" },
  mid: { gu: "સમાચારની વચ્ચે", en: "Inside a story", hi: "समाचार के बीच" },
  end: { gu: "સમાચારના અંતે", en: "At a story's end", hi: "समाचार के अंत में" },
};
/** how long a banner stays, the editor's choice */
export const BANNER_DAYS = [7, 15, 30, 90];

export interface Banner { id: string; image: string; width: number; height: number; link: string; name: string; slots: Slot[];
  from: string; until: string; clicks: number; addedAt: string }
/** what a page needs to show one */
export type ShownBanner = Pick<Banner, "id" | "image" | "width" | "height" | "name" | "slots">;

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const row = (r: Record<string, unknown>): Banner => ({
  id: r.id as string, image: r.image as string, width: r.width as number, height: r.height as number, link: r.link as string, name: r.name as string,
  slots: ((r.slots as string[]) ?? []).filter((x): x is Slot => SLOTS.includes(x as Slot)),
  from: day(r.starts), until: day(r.until), clicks: (r.clicks as number) ?? 0, addedAt: new Date(r.added_at as string).toISOString(),
});

/** the banners showing today (India's day), newest first; `all` for the editor: those that ended too */
export async function banners(sql: Sql | null, all = false): Promise<Banner[]> {
  if (!sql) return [];
  const today = `(now() at time zone 'Asia/Kolkata')::date`;
  const rows = await sql.query(`select * from banners ${all ? "" : `where starts <= ${today} and until >= ${today}`} order by added_at desc limit 100`);
  return rows.map(row);
}

/** only the editor's own uploaded pictures (app/api/editor/photo), and only a web address to lead to */
const IMAGE = /^\/media\/live\/\d{4}-\d{2}-\d{2}\/ed-[a-z0-9]+\.jpg$/;
export const linkOk = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; } };

export async function addBanner(sql: Sql, b: { image: string; width: number; height: number; link: string; name: string; slots: string[]; days: number }, who: string): Promise<boolean> {
  const slots = b.slots.filter((x) => SLOTS.includes(x as Slot));
  const w = Math.round(b.width), h = Math.round(b.height);
  if (!IMAGE.test(b.image) || !(w > 0 && w <= 4000 && h > 0 && h <= 4000) || !linkOk(b.link) || b.link.length > 500 || !slots.length || !BANNER_DAYS.includes(b.days)) return false;
  await sql.query(
    `insert into banners (id, image, width, height, link, name, slots, starts, until, added_by)
     values ($1, $2, $3, $4, $5, $6, $7::text[], (now() at time zone 'Asia/Kolkata')::date, (now() at time zone 'Asia/Kolkata')::date + $8::int - 1, $9)`,
    [`b${randomBytes(5).toString("hex")}`, b.image, w, h, b.link.trim(), b.name.trim().slice(0, 80), slots, b.days, who]);
  return true;
}

export async function dropBanner(sql: Sql, id: string) {
  await sql.query(`delete from banners where id = $1`, [id]);
}

/** One click counted; where the banner leads, or null when there's no such banner showing. */
export async function clickBanner(sql: Sql, id: string): Promise<string | null> {
  const rows = await sql.query(
    `update banners set clicks = clicks + 1 where id = $1 and until >= (now() at time zone 'Asia/Kolkata')::date returning link`, [id]);
  return (rows[0]?.link as string | undefined) ?? null;
}
