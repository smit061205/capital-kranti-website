// One opening of a story, sent by the story page once per browser (for "most
// read"). Only a count per story per day is kept, and for two days a keyed
// fingerprint of the reader and the story, so one reader counts once a day
// (5 Nov: anyone could post the counter a thousand times and top "most read").
// The key is the server's own secret, so the fingerprint can't be traced back.
import { createHash } from "node:crypto";
import { countRead } from "@/lib/db.ts";

export async function POST(req: Request) {
  // only the site's own pages count: a browser says where a request comes from
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const own = site ? site === "same-origin" : !!origin && new URL(origin).host === new URL(req.url).host;
  const id = (await req.text()).trim();
  if (own && /^[\w-]{1,80}$/.test(id)) {
    const who = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const reader = createHash("sha256").update(`${process.env.DATABASE_URL ?? ""}|${who}|${req.headers.get("user-agent") ?? ""}|${id}|${day}`).digest("hex").slice(0, 32);
    await countRead(id, reader).catch(() => {});
  }
  return new Response(null, { status: 204 });
}
