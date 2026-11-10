import Policy, { POLICY } from "@/views/Policy.tsx";
import { pageMeta } from "@/lib/meta.ts";

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(POLICY).map((page) => ({ page })); }
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const page = (await params).page;
  const p = POLICY[page]?.["gu"];
  // each page described by its own opening words (10 Nov: all carried the home page's description)
  return pageMeta({ lang: "gu", path: `/${page}`, title: p?.title, description: p?.paras[0]?.slice(0, 180) });
}
export default async function Page({ params }: { params: Promise<{ page: string }> }) { return <Policy page={(await params).page} lang="gu" />; }
