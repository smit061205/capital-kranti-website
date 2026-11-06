import Article, { articleMeta } from "@/views/Article.tsx";

// made again once a day at most, unless it is new or changed (lib/renew.ts)
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return articleMeta((await params).id, "gu"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <Article id={(await params).id} lang="gu" />; }
