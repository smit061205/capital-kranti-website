import Classifieds from "@/views/Classifieds.tsx";
import { pageMeta } from "@/lib/meta.ts";
import { t } from "@/lib/i18n.ts";

export const revalidate = 3600;
export const metadata = pageMeta({ lang: "gu", path: "/classifieds", title: t("gu", "classifieds") });
export default function Page() { return <Classifieds lang="gu" />; }
