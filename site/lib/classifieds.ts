// Classified ads (the readers asked, 3 Nov): the editor adds them on the editor page, each with its kind, its words,
// a phone number and a place, shown on /classifieds until the day the editor chose; then they go by themselves.
import { randomBytes } from "node:crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { Lang } from "./types.ts";
import { sampleOn } from "./sample.ts";
import { prepared } from "./write.ts";

type Sql = NeonQueryFunction<false, false>;

export const KINDS = ["job", "property", "vehicle", "notice", "matrimony", "other"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_NAMES: Record<Kind, Record<Lang, string>> = {
  job: { gu: "નોકરી", en: "Jobs", hi: "नौकरी" },
  property: { gu: "મિલકત", en: "Property", hi: "संपत्ति" },
  vehicle: { gu: "વાહન", en: "Vehicles", hi: "वाहन" },
  notice: { gu: "જાહેર સૂચના", en: "Public notices", hi: "सार्वजनिक सूचना" },
  matrimony: { gu: "લગ્ન વિષયક", en: "Matrimonial", hi: "वैवाहिक" },
  other: { gu: "અન્ય", en: "Other", hi: "अन्य" },
};
/** how long an ad stays, the editor's choice */
export const DAYS = [7, 15, 30];

export interface Ad { id: string; kind: Kind; text: string; contact: string; place: string; until: string; addedAt: string }

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const row = (r: Record<string, unknown>): Ad => ({
  id: r.id as string, kind: r.kind as Kind, text: r.text as string, contact: r.contact as string, place: r.place as string,
  until: day(r.until), addedAt: new Date(r.added_at as string).toISOString(),
});

// a few to look at while developing (CK_SAMPLE=1)
const SAMPLE: Ad[] = [
  { id: "s1", kind: "job", text: "ગાંધીનગરની ખાનગી શાળા માટે ગુજરાતી અને ગણિતના શિક્ષકો જોઈએ છે. B.Ed. જરૂરી.", contact: "98250 00000", place: "ગાંધીનગર", until: "2099-01-01", addedAt: "2026-11-03T05:00:00Z" },
  { id: "s2", kind: "property", text: "સેક્ટર ૨૧માં ૨ BHK ફ્લેટ ભાડે આપવાનો છે. પાર્કિંગ સાથે.", contact: "99099 00000", place: "ગાંધીનગર", until: "2099-01-01", addedAt: "2026-11-02T05:00:00Z" },
  { id: "s3", kind: "notice", text: "મારું અસલ ડ્રાઇવિંગ લાઇસન્સ ખોવાયું છે. મળે તો નીચેના નંબર પર જાણ કરવા વિનંતી.", contact: "97370 00000", place: "કલોલ", until: "2099-01-01", addedAt: "2026-11-01T05:00:00Z" },
];

/** the ads still showing today (India's day), newest first; `all` for the editor: those that ended too */
export async function ads(sql: Sql | null, all = false): Promise<Ad[]> {
  if (!sql) return sampleOn() ? SAMPLE : [];
  await prepared(sql);
  const rows = await sql.query(`select * from classifieds ${all ? "" : "where until >= (now() at time zone 'Asia/Kolkata')::date"} order by added_at desc limit 300`);
  return rows.map(row);
}

export async function addAd(sql: Sql, a: { kind: string; text: string; contact: string; place: string; days: number }, who: string): Promise<boolean> {
  if (!KINDS.includes(a.kind as Kind) || !a.text.trim() || a.text.length > 1000 || !DAYS.includes(a.days)) return false;
  await prepared(sql);
  await sql.query(
    `insert into classifieds (id, kind, text, contact, place, until, added_by)
     values ($1, $2, $3, $4, $5, (now() at time zone 'Asia/Kolkata')::date + $6::int - 1, $7)`,
    [`ad-${randomBytes(5).toString("hex")}`, a.kind, a.text.trim(), a.contact.trim().slice(0, 80), a.place.trim().slice(0, 60), a.days, who]);
  return true;
}

export async function dropAd(sql: Sql, id: string) {
  await prepared(sql);
  await sql.query(`delete from classifieds where id = $1`, [id]);
}
