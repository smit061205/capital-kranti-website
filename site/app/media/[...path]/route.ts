// The photo store is private (as it was made in Vercel), so the site serves its
// files itself, at its own address. Each file's name carries its content's
// fingerprint, so a file never changes: the CDN keeps it for a year and the
// store is read only on the first view of each file. `?w=500`, `?w=720` or `?w=960` gives a smaller copy (WebP)
// (lib/photo.ts), made once and kept by the CDN the same way. An Instagram set's picture (its cards one under another,
// engine/insta.ts) gives one card with `?card=3` (a JPEG, as Instagram takes), and a small one for the editor with `&w=360`.
import { get } from "@vercel/blob";
import sharp from "sharp";

/** The original file, for making a copy of it: from the site's own address, which the CDN keeps for a year, so each
 *  original is read from the store once, not once for every size and every card made from it (4 Nov: the store's 10,000
 *  free reads a month were on course to run out in two weeks); from the store itself if that fails. */
async function original(name: string, req: Request): Promise<ArrayBuffer | null> {
  const r = await fetch(new URL(`/media/${name}`, req.url), { cache: "no-store" }).catch(() => null);
  if (r?.ok) return r.arrayBuffer();
  const got = await get(name, { access: "private" }).catch(() => null);
  return got ? new Response(got.stream).arrayBuffer() : null;
}

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf", mp4: "video/mp4" };

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const name = (await params).path.join("/");
  // the daily paper's photos, the e-paper and the live news photos (engine/publish.ts) by day; Aavtikal's photos (pipeline/features.ts) in their own folder;
  // the shared pictures of stories without a photo (engine/share.ts)
  const m = name.match(/^(?:(?:photos|epaper|live|instagram|share)\/\d{4}-\d{2}-\d{2}|aavtikal)\/[a-z0-9-]+\.(jpg|jpeg|png|pdf|mp4)$/);
  if (!m) return new Response("not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const w = Number(q.get("w"));
  const card = Number(q.get("card"));
  if (name.startsWith("instagram/") && card >= 1 && card <= 12) {
    const file = await original(name, req);
    if (!file) return new Response("not found", { status: 404 });
    const tall = sharp(file);
    const { height = 0 } = await tall.metadata();
    if (card * 1350 > height) return new Response("not found", { status: 404 });
    const one = tall.extract({ left: 0, top: (card - 1) * 1350, width: 1080, height: 1350 });
    const out = w === 360 ? await one.resize({ width: 360 }).webp({ quality: 74 }).toBuffer() : await one.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(out), { headers: { "content-type": w === 360 ? "image/webp" : "image/jpeg", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  }
  if ((w === 500 || w === 720 || w === 960) && m[1] !== "pdf") {
    const file = await original(name, req);
    if (!file) return new Response("not found", { status: 404 });
    const small = await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    return new Response(new Uint8Array(small), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  }
  // an Instagram Reel (engine/reel.ts, under 4.3 MB): a phone's player asks for it in byte ranges, and an iPhone plays a
  // video only when they're answered
  const range = m[1] === "mp4" ? req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/) : null;
  if (range) {
    const got = await get(name, { access: "private" }).catch(() => null);
    if (!got) return new Response("not found", { status: 404 });
    const all = new Uint8Array(await new Response(got.stream).arrayBuffer());
    const size = all.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(all.slice(start, end + 1), { status: 206, headers: {
      "content-type": "video/mp4", "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  }
  const got = await get(name, { access: "private" }).catch(() => null);
  if (!got) return new Response("not found", { status: 404 });
  return new Response(got.stream, {
    headers: {
      "content-type": TYPES[m[1]],
      ...(m[1] === "mp4" ? { "accept-ranges": "bytes" } : {}),
      "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      ...(m[1] === "pdf" ? { "content-disposition": `inline; filename="${name.split("/").pop()}"` } : {}),
    },
  });
}
