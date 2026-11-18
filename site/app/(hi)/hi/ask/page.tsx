import { AskPage } from "@/views/Ask.tsx";
import { pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";

export const metadata = pageMeta({ lang: "hi", path: "/ask", title: t("hi", "askTitle"), description: t("hi", "askIntro") });
export default function Page() { return <AskPage lang="hi" />; }
