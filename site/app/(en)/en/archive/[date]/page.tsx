import { ArchiveDay, isDay } from "@/views/Lists.tsx";
import { missingMeta, pageMeta } from "@/lib/meta.ts";
import { dateText } from "@/lib/format.ts";

export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const date = (await params).date;
  if (!isDay(date)) return missingMeta("en");
  return pageMeta({ lang: "en", path: `/archive/${date}`, title: dateText(date, "en") });
}
export default async function Page({ params }: { params: Promise<{ date: string }> }) { return <ArchiveDay date={(await params).date} lang="en" />; }
