// The shared pictures of stories without a photo (lib/share.ts): the Instagram runner (engine/instawatch.ts) runs this
// when it has nothing else to do. Each picture is made by a real browser, as Gujarati's letters need, and kept in the
// photo store; the story's page offers it when the story is shared. A story that later gets a photo shares the photo.
// Run: node --experimental-strip-types --no-warnings site/engine/share.ts
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { db } from "../lib/db.ts";
import { shareHtml, type ShareCard } from "../lib/share.ts";
import { touched } from "../lib/write.ts";

/** at most this many a run, so a run never holds Instagram's work up for long */
const MOST = 12;

/** Published stories of the last two days with no photo, after the engine has looked for one, and no picture yet. */
export async function waiting(sql: NonNullable<ReturnType<typeof db>>, limit = MOST): Promise<ShareCard[]> {
  const rows = await sql.query(
    `select id, tier, kicker, headline, published_at from stories
      where status = 'published' and photo is null and share is null and photo_tried and published_at > now() - interval '2 days'
      order by published_at desc limit $1`, [limit]);
  return rows.map((r) => ({ id: r.id as string, tier: r.tier, kicker: (r.kicker as string) ?? "", headline: r.headline as string,
                            publishedAt: new Date(r.published_at as string).toISOString() }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sql = db();
  if (!sql) { console.log("no DATABASE_URL"); process.exit(0); }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.log("no BLOB_READ_WRITE_TOKEN: the pictures can't be kept"); process.exit(0); }
  const cards = await waiting(sql);
  if (!cards.length) process.exit(0);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  let made = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    await page.setContent(shareHtml(cards), { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    for (const c of cards) {
      const png = await page.locator(`section[data-share="${c.id}"]`).screenshot({ type: "png" });
      const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      const name = `share/${c.publishedAt.slice(0, 10)}/${c.id.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${createHash("sha256").update(jpg).digest("hex").slice(0, 10)}.jpg`;
      await put(name, jpg, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
      await sql.query(`update stories set share = $2 where id = $1 and photo is null`, [c.id, `/media/${name}`]);
      made++;
    }
  } finally {
    await browser.close();
  }
  // the stories' pages are made again with their pictures
  if (made) await touched(sql);
  console.log(`share pictures made: ${made}`);
}
