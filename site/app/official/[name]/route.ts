// Official photos (PIB, the ministries, governments abroad) at the site's own address (4 Nov: each was copied into the
// photo store, which takes 50 a day, and after the fiftieth the day's official photos were thrown away). Each is fetched
// from the government's own site once at a width, made smaller as WebP, and kept by the CDN for a year, like Wikimedia's
// (app/commons). Only the official sources' own sites are fetched from, never any other address.
// /official/<the photo's address, base64url>.jpg?w=500|720|960|1200 (engine/publish.ts and lib/photo.ts make these)
import sharp from "sharp";
import { officialHost } from "../../../engine/sources.ts";

const UA = "CapitalKranti-news/1.0 (https://www.capitalkranti.co.in; official news photos)";
const WIDTHS = [500, 720, 960, 1200];

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const m = (await params).name.match(/^([A-Za-z0-9_-]+)\.jpg$/);
  const w = Number(new URL(req.url).searchParams.get("w") || 1200);
  if (!m || !WIDTHS.includes(w)) return new Response("not found", { status: 404 });
  let src: URL;
  try { src = new URL(Buffer.from(m[1], "base64url").toString("utf8")); } catch { return new Response("not found", { status: 404 }); }
  if (!/^https?:$/.test(src.protocol) || !officialHost(src.hostname)) return new Response("not found", { status: 404 });
  const r = await fetch(src, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok || !/^image\//.test(r.headers.get("content-type") ?? "")) {
    // the government's site can't be reached now: the reader is sent to the photo there (an https one), as with Commons
    return src.protocol === "https:" ? new Response(null, { status: 302, headers: { location: src.href, "cache-control": "public, max-age=300" } })
      : new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  }
  const small = await sharp(await r.arrayBuffer()).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  return new Response(new Uint8Array(small), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}
