import { AskPage } from "@/views/Ask.tsx";
import { pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";

export const metadata = pageMeta({ lang: "gu", path: "/ask", title: t("gu", "askTitle"), description: t("gu", "askIntro") });
export default function Page() { return <AskPage lang="gu" />; }
