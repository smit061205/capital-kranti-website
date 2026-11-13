// A click on a banner ad: counted, then on to where the banner leads (lib/banners.ts). Only to a banner's own address,
// kept in the database, never to one given in the link.
import { db } from "@/lib/db.ts";
import { clickBanner } from "@/lib/banners.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const sql = db();
  const link = sql && /^b[a-f0-9]{10}$/.test(id) ? await clickBanner(sql, id).catch(() => null) : null;
  if (!link) return new Response(null, { status: 302, headers: { location: "/", "cache-control": "no-store" } });
  return new Response(null, { status: 302, headers: { location: link, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
