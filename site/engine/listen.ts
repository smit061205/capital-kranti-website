// Between the engine's rounds (.github/workflows/site-engine.yml sleeps here): the
// editors' Telegram messages and Publish / Don't presses, answered within seconds instead of
// at the next round. Ends by itself after the seconds it's given. (Instagram's sets have their own
// watcher since 4 Nov: engine/instawatch.ts.)
// Run: node --experimental-strip-types site/engine/listen.ts 840   (DATABASE_URL, TELEGRAM_BOT_TOKEN)
import { neon } from "@neondatabase/serverless";
import { pollUpdates } from "../lib/telegram.ts";
import { WEBSITE } from "../lib/config.ts";

const url = process.env.DATABASE_URL;
if (!url) process.exit(0);
const sql = neon(url);
const until = Date.now() + Number(process.argv[2] ?? 0) * 1000;
const pause = (s: number) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));

const telegram = !!process.env.TELEGRAM_BOT_TOKEN;
while (Date.now() < until - 5000) {
  const left = Math.floor((until - Date.now()) / 1000) - 3;
  try {
    // Telegram's wait kept short, so the editor's asks are seen within half a minute
    const n = telegram ? await pollUpdates(sql, Math.min(25, left)) : null;
    if (n === null) await pause(Math.min(25, left)); // no bot, or a webhook: the site answers them
    else if (n) {
      console.log(`telegram: ${n} answered`);
      // a story he approved goes on the site's pages now, not at the next round
      await fetch(`${WEBSITE.url}/api/refresh`, { method: "POST", signal: AbortSignal.timeout(30_000) }).catch(() => null);
    }
  } catch (e) {
    console.log(`listen: ${(e as Error).message}`);
    await pause(Math.min(10, left));
  }
}
