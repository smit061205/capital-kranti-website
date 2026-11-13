// The banner ads showing today (lib/banners.ts), for the pages' ad places (components/AdSlot.tsx): asked for by the
// reader's browser, so no page carries an ad and putting one up or taking one down makes no page again; kept five
// minutes by the CDN, so the database is asked a few times an hour however many read.
import { db } from "@/lib/db.ts";
import { banners } from "@/lib/banners.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const list = await banners(db()).catch(() => []);
  return Response.json({ ads: list.map((b) => ({ id: b.id, image: b.image, width: b.width, height: b.height, name: b.name, slots: b.slots })) },
    { headers: { "cache-control": "public, max-age=0, s-maxage=300" } });
}
