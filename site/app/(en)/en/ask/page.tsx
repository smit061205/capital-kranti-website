import { AskPage } from "@/views/Ask.tsx";
import { pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";

export const metadata = pageMeta({ lang: "en", path: "/ask", title: t("en", "askTitle"), description: t("en", "askIntro") });
export default function Page() { return <AskPage lang="en" />; }
