// The breaking story now (lib/db.ts breakingNow), for the bar across the top of every page (components/BreakingBar.tsx):
// the reader's browser asks for it, so the pages don't carry it (7 Nov). Kept by the CDN for a minute,
// so the database is asked at most about once a minute however many read.
import { breakingNow } from "@/lib/db.ts";
import { href } from "@/lib/i18n.ts";
import { BREAKING_HOURS } from "@/lib/push.ts";
import type { Lang } from "@/lib/types.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("lang");
  const lang: Lang = q === "en" || q === "hi" ? q : "gu";
  const brk = await breakingNow();
  const headline = brk && ((lang === "gu" ? brk.headline : brk[lang]?.headline) || brk.headline);
  return Response.json(brk ? { id: brk.id, headline, href: href(lang, `/news/${brk.id}`), until: Date.parse(brk.publishedAt) + BREAKING_HOURS * 3600_000 } : null,
    { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=240" } });
}
