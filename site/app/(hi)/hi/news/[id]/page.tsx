import Article, { articleMeta } from "@/views/Article.tsx";

export const revalidate = 3600;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) { return articleMeta((await params).id, "hi"); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <Article id={(await params).id} lang="hi" />; }
