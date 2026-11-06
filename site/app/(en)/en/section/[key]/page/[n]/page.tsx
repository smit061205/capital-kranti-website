import { notFound } from "next/navigation";
import { Section, MAX_PAGES, PER_PAGE } from "@/views/Lists.tsx";
import { missingMeta, pageMeta } from "@/lib/meta.ts";
import { storiesIn } from "@/lib/db.ts";
import { t } from "@/lib/i18n.ts";
import { num } from "@/lib/format.ts";
import { isSection, sectionTitle } from "@/lib/sections.ts";

// a section's older stories, page 2 onwards (views/Lists.tsx Section): made at their first visit and renewed once a day
export const revalidate = 86400;
export function generateStaticParams() { return []; }
const pageOf = (n: string) => /^[0-9]{1,2}$/.test(n) && Number(n) >= 2 && Number(n) <= MAX_PAGES ? Number(n) : null;
export async function generateMetadata({ params }: { params: Promise<{ key: string; n: string }> }) {
  const { key, n } = await params;
  const page = pageOf(n);
  // a page past the section's oldest story is out of search (lib/meta.ts missingMeta)
  if (!page || !isSection(key) || !(await storiesIn(key, 1, false, (page - 1) * PER_PAGE)).length) return missingMeta("en");
  return pageMeta({ lang: "en", path: `/section/${key}/page/${n}`, title: `${sectionTitle(key, "en")}: ${t("en", "pageNo")} ${num(Number(n), "en")}` });
}
export default async function Page({ params }: { params: Promise<{ key: string; n: string }> }) {
  const { key, n } = await params;
  const page = pageOf(n);
  if (!page) notFound();
  return <Section k={key} page={page} lang="en" />;
}
