// Between the engine's rounds (.github/workflows/site-engine.yml sleeps here): the
// editors' Telegram messages, answered within seconds instead of
// at the next round; and a set of Instagram cards the editor asked for or changed on
// the editor page, made within minutes (engine/insta.ts). Ends by itself after the seconds it's given.
// Run: node --experimental-strip-types site/engine/listen.ts 840   (DATABASE_URL, TELEGRAM_BOT_TOKEN)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { pollUpdates } from "../lib/telegram.ts";

const url = process.env.DATABASE_URL;
if (!url) process.exit(0);
const sql = neon(url);
const until = Date.now() + Number(process.argv[2] ?? 0) * 1000;
const pause = (s: number) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));

// Instagram's run takes a few minutes: started only with time for it to finish before the next round, and at most once
// in five minutes (a set whose pictures fail stays "making" until the next round tries it)
const INSTA_NEEDS = 9 * 60;
let instaLast = 0;
async function instaWanted(): Promise<boolean> {
  if (Date.now() - instaLast < 5 * 60_000) return false;
  const [r] = await sql.query(`select exists (select 1 from state where key = 'insta_ask')
    or exists (select 1 from insta_sets where state = 'making') as yes`);
  return !!r?.yes;
}
function insta(left: number) {
  instaLast = Date.now();
  console.log("instagram: a set asked for or changed");
  spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", fileURLToPath(new URL("./insta.ts", import.meta.url))],
    { stdio: "inherit", timeout: Math.min(12 * 60, left - 30) * 1000 });
}

const telegram = !!process.env.TELEGRAM_BOT_TOKEN;
while (Date.now() < until - 5000) {
  const left = Math.floor((until - Date.now()) / 1000) - 3;
  try {
    if (left >= INSTA_NEEDS && (await instaWanted())) { insta(left); continue; }
    // Telegram's wait kept short, so the editor's asks are seen within half a minute
    const n = telegram ? await pollUpdates(sql, Math.min(25, left)) : null;
    if (n === null) await pause(Math.min(25, left)); // no bot, or a webhook: the site answers them
    else if (n) console.log(`telegram: ${n} answered`);
  } catch (e) {
    console.log(`listen: ${(e as Error).message}`);
    await pause(Math.min(10, left));
  }
}
