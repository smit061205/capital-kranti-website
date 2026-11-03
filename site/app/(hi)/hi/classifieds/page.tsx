import Classifieds from "@/views/Classifieds.tsx";
import { pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";

export const revalidate = 3600;
export const metadata = pageMeta({ lang: "hi", path: "/classifieds", title: t("hi", "classifieds") });
export default function Page() { return <Classifieds lang="hi" />; }
