// Every page Google should know, in its three languages (stories, sections, the fixed pages). Each language version is
// an entry of its own naming all its versions; a story or article not yet translated is listed in Gujarati only.
import type { MetadataRoute } from "next";
import type { Lang } from "@/lib/types.ts";
import { archiveDays, sitemapEntries } from "@/lib/db.ts";
import { href } from "@/lib/i18n.ts";
import { langsOf } from "@/lib/meta.ts";
import { ALL_SECTIONS } from "@/lib/sections.ts";
import { SITE_URL } from "@/lib/site.ts";
import { POLICY } from "@/views/Policy.tsx";
import { BEATS, features } from "@/lib/flagship.ts";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string, lastModified?: string, langs: Lang[] = ["gu", "en", "hi"]) => {
    const languages = { ...Object.fromEntries(langs.map((l) => [l, `${SITE_URL}${href(l, path)}`])), "x-default": `${SITE_URL}${href("gu", path)}` };
    return langs.map((l) => ({ url: `${SITE_URL}${href(l, path)}`, lastModified, alternates: { languages } }));
  };
  const [stories, days, flagship] = await Promise.all([sitemapEntries(), archiveDays(), features({ limit: 500 })]);
  return [
    page("/"), page("/latest"), page("/archive"),
    ...ALL_SECTIONS.map((k) => page(`/section/${k}`)),
    ...Object.keys(POLICY).map((p) => page(`/${p}`)),
    ...days.map((d) => page(`/archive/${d.date}`)),
    ...stories.map((s) => page(`/news/${s.id}`, s.updatedAt, langsOf(s))),
    page("/aavtikal"), ...BEATS.map((b) => page(`/aavtikal/${b}`)),
    ...flagship.map((f) => page(`/aavtikal/p/${f.id}`, f.updatedAt, langsOf(f))),
  ].flat();
}
