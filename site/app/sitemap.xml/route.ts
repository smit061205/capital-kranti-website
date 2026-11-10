// Every page Google should know, in its three languages (stories, sections, the fixed pages). Each language version is
// an entry of its own naming all its versions; a story or article not yet translated is listed in Gujarati only.
// Made when asked for and kept half an hour by the CDN (lib/feeds.ts xml; 10 Nov: as a kept-ready file it was days old).
import { archiveDays, sitemapEntries } from "@/lib/db.ts";
import { siteMap, xml } from "@/lib/feeds.ts";
import { langsOf } from "@/lib/meta.ts";
import { ALL_SECTIONS } from "@/lib/sections.ts";
import { POLICY } from "@/views/Policy.tsx";
import { BEATS, features } from "@/lib/flagship.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stories, days, flagship] = await Promise.all([sitemapEntries(), archiveDays(), features({ limit: 500 })]);
  return xml(siteMap([
    { path: "/" }, { path: "/latest" }, { path: "/archive" },
    ...ALL_SECTIONS.map((k) => ({ path: `/section/${k}` })),
    ...Object.keys(POLICY).map((p) => ({ path: `/${p}` })),
    ...days.map((d) => ({ path: `/archive/${d.date}` })),
    ...stories.map((s) => ({ path: `/news/${s.id}`, lastModified: s.updatedAt, langs: langsOf(s) })),
    { path: "/aavtikal" }, ...BEATS.map((b) => ({ path: `/aavtikal/${b}` })),
    ...flagship.map((f) => ({ path: `/aavtikal/p/${f.id}`, lastModified: f.updatedAt, langs: langsOf(f) })),
  ]), 1800);
}
