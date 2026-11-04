// Instagram's own watcher (.github/workflows/site-insta.yml), apart from the news engine (the user, 4 Nov: "why is insta
// tied to 15 minute runs"): every 20 seconds it looks whether there's work, a set the editor asked for, a set the editor
// changed, or an edition due at the editor's times, and runs engine/insta.ts for it at once, a fresh process each time
// so it runs main's latest code. Ends by itself after the seconds it's given.
// Run: node --experimental-strip-types --no-warnings site/engine/instawatch.ts 600
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { db } from "../lib/db.ts";
import { editionNow, instaSettings } from "../lib/insta.ts";

const sql = db();
if (!sql) { console.log("no DATABASE_URL"); process.exit(0); }
const until = Date.now() + Number(process.argv[2] ?? 600) * 1000;
const pause = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const INSTA = fileURLToPath(new URL("./insta.ts", import.meta.url));

/** "ask": the editor asked for a set (always at once); "more": a changed set or a due edition (not again within five
 *  minutes of a run, so a set whose pictures keep failing isn't tried every 20 seconds) */
async function work(): Promise<"ask" | "more" | null> {
  const [r] = await sql!.query(`select exists (select 1 from state where key = 'insta_ask') as ask,
    exists (select 1 from insta_sets where state = 'making') as making`);
  if (r?.ask) return "ask";
  if (r?.making) return "more";
  const s = await instaSettings(sql!);
  const due = s.auto && s.times.length ? editionNow(s.times) : null;
  if (!due) return null;
  const [made] = await sql!.query(`select 1 from insta_sets where edition = $1 limit 1`, [due]);
  return made ? null : "more";
}

let lastRun = 0;
while (Date.now() < until - 20_000) {
  try {
    const w = await work();
    if (w === "ask" || (w === "more" && Date.now() - lastRun > 5 * 60_000)) {
      lastRun = Date.now();
      console.log(`${new Date().toISOString().slice(11, 16)} UTC: ${w === "ask" ? "a set the editor asked for" : "a changed set or a due edition"}`);
      spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", INSTA], { stdio: "inherit", timeout: 15 * 60_000 });
      continue;
    }
  } catch (e) {
    console.log(`instawatch: ${(e as Error).message}`);
  }
  await pause(20);
}
