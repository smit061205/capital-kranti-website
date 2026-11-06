// The shared pictures of stories without a photo (lib/share.ts): the Instagram runner (engine/instawatch.ts) runs this
// when it has nothing else to do. Each picture is made by a real browser, as Gujarati's letters need, and kept in the
// photo store; the story's page offers it when the story is shared. A story that later gets a photo shares the photo.
// Run: node --experimental-strip-types --no-warnings site/engine/share.ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { db } from "../lib/db.ts";
import { FIT, SHARE_LOOK, shareHtml, type ShareCard } from "../lib/share.ts";
import { touched } from "../lib/write.ts";

/** at most this many a run, so a run never holds Instagram's work up for long */
const MOST = 12;

/** Published stories of the last two days with no photo, after the engine has looked for one, and no picture yet; and
 *  the last day's whose picture has an older look (6 Nov: the new look made again for them; not further back, as each
 *  picture is an upload to the photo store, whose free uses are counted). */
export async function waiting(sql: NonNullable<ReturnType<typeof db>>, limit = MOST): Promise<ShareCard[]> {
  const rows = await sql.query(
    `select id, tier, kicker, headline, deck, published_at from stories
      where status = 'published' and photo is null and photo_tried and published_at > now() - interval '2 days'
        and (share is null or (share not like $2 and published_at > now() - interval '1 day'))
      order by share is not null, published_at desc limit $1`, [limit, `%-${SHARE_LOOK}-%`]);
  return rows.map((r) => ({ id: r.id as string, tier: r.tier, kicker: (r.kicker as string) ?? "", headline: r.headline as string,
                            deck: (r.deck as string) ?? "", publishedAt: new Date(r.published_at as string).toISOString() }));
}

/** the paper's own fonts, for the browser that draws the pictures (it opens no page of the site) */
function fonts(): string {
  const face = (family: string, file: string, range = "") =>
    `@font-face{font-family:"${family}";font-weight:800;src:url(data:font/woff2;base64,${readFileSync(new URL(`../app/fonts/${file}`, import.meta.url)).toString("base64")}) format("woff2")${range}}`;
  return face("CK Mark", "mark.woff2") +
    face("CK Cond", "cond-gu.woff2", ";unicode-range:U+0951-0952,U+0964-0965,U+0A80-0AFF,U+200C-200D,U+20B9,U+25CC,U+A830-A839") +
    face("CK Cond", "cond-latin.woff2", ";unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212");
}

/** The page with every card drawn and fitted, ready for each card's picture (`section[data-share="<id>"]`). */
export async function drawn(page: import("playwright").Page, cards: ShareCard[]) {
  await page.setContent(shareHtml(cards, fonts()), { waitUntil: "networkidle", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(FIT);
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
    await drawn(page, cards);
    for (const c of cards) {
      const png = await page.locator(`section[data-share="${c.id}"]`).screenshot({ type: "png" });
      const jpg = await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      const name = `share/${c.publishedAt.slice(0, 10)}/${c.id.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${SHARE_LOOK}-${createHash("sha256").update(jpg).digest("hex").slice(0, 10)}.jpg`;
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
