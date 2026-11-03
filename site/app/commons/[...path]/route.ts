// Wikimedia Commons photos at the site's own address (3 Nov: one took 35 seconds to come from Wikimedia while a reader
// waited, and its copies are two to four times the weight of ours). Each is fetched from Commons once at a width, made
// smaller as WebP, and kept by the CDN for a year, like the site's own photos (app/media). If Commons can't be reached,
// the reader is sent to the photo on Commons, as before.
// /commons/<a>/<ab>/<File.jpg>?w=500|720|960|1200 (lib/photo.ts makes these addresses)
import sharp from "sharp";

const UA = "CapitalKranti-news/1.0 (https://www.capitalkranti.co.in; news photos from Wikimedia Commons)";
const WIDTHS = [500, 720, 960, 1200];
const BASE = "https://upload.wikimedia.org/wikipedia/commons";

async function fetched(url: string): Promise<ArrayBuffer | null> {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return r?.ok && /^image\//.test(r.headers.get("content-type") ?? "") ? r.arrayBuffer() : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // the file's name exactly as Commons writes it (read from the address, not decoded, so it stays Commons' spelling)
  const m = url.pathname.match(/^\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+\.(?:jpe?g|png|webp))$/i);
  const w = Number(url.searchParams.get("w"));
  if (!m || !m[2].startsWith(m[1]) || !WIDTHS.includes(w)) return new Response("not found", { status: 404 });
  const [, a, ab, file] = m;
  // Commons makes copies at fixed widths (500, 960 and 1920 work); the next one up is made smaller here.
  // A copy wider than the photo itself is refused, so then the photo itself.
  const step = w <= 500 ? 500 : w <= 960 ? 960 : 1920;
  const thumb = `${BASE}/thumb/${a}/${ab}/${file}/${step}px-${file}`;
  const got = (await fetched(thumb)) ?? (await fetched(`${BASE}/${a}/${ab}/${file}`));
  if (!got) return new Response(null, { status: 302, headers: { location: thumb, "cache-control": "public, max-age=300" } });
  const small = await sharp(got).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  return new Response(new Uint8Array(small), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}
