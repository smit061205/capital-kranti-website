import { notFound } from "next/navigation";
import { ArchiveDay, isDay } from "@/views/Lists.tsx";
import { missingMeta, pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";
import { dateText, num } from "@/lib/format.ts";

// a day's further stories, page 2 onwards (views/Lists.tsx ArchiveDay): made at their first visit and renewed once a day
export const revalidate = 86400;
export function generateStaticParams() { return []; }
const pageOf = (n: string) => (/^[0-9]{1,2}$/.test(n) && Number(n) >= 2 ? Number(n) : null);
export async function generateMetadata({ params }: { params: Promise<{ date: string; n: string }> }) {
  const { date, n } = await params;
  if (!isDay(date) || !pageOf(n)) return missingMeta("gu");
  return pageMeta({ lang: "gu", path: `/archive/${date}/page/${n}`, title: `${dateText(date, "gu")}: ${t("gu", "pageNo")} ${num(Number(n), "gu")}` });
}
export default async function Page({ params }: { params: Promise<{ date: string; n: string }> }) {
  const { date, n } = await params;
  const page = pageOf(n);
  if (!page) notFound();
  return <ArchiveDay date={date} page={page} lang="gu" />;
}
