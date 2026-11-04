// Each page's title, description, language alternates and share preview.
import type { Metadata } from "next";
import type { Lang } from "./types.ts";
import { href } from "./i18n.ts";
import { INDEXABLE, PAPER, SITE_URL } from "./site.ts";

/** The languages a story or article really exists in: Gujarati always, English and Hindi once translated. */
export const langsOf = (x: { en: unknown; hi: unknown }): Lang[] => ["gu", ...(x.en ? ["en" as const] : []), ...(x.hi ? ["hi" as const] : [])];

/** langs: the languages the page exists in (all three unless said). A copy not yet translated shows the Gujarati,
 *  so its canonical is the Gujarati page and search engines aren't told of it as a version of its own. */
export function pageMeta(o: { lang: Lang; path: string; title?: string; description?: string; image?: string | null;
                              article?: { publishedAt: string; updatedAt: string }; langs?: Lang[] }): Metadata {
  const name = PAPER[o.lang].name;
  // the home page's title names the paper as people type it into Google, in English letters too ("capital kranti news",
  // 4 Nov: the Gujarati title alone didn't match and the paper's own site wasn't found by its name)
  const title = o.title ? `${o.title} | ${name}` : {
    gu: "Capital Kranti News | કેપિટલ ક્રાંતિ: ગાંધીનગરનું ગુજરાતી દૈનિક",
    en: "Capital Kranti News: the Gujarati daily from Gandhinagar",
    hi: "Capital Kranti News | कैपिटल क्रांति: गांधीनगर का गुजराती दैनिक",
  }[o.lang];
  const description = o.description || {
    gu: "Capital Kranti (કેપિટલ ક્રાંતિ), ગાંધીનગરનું ગુજરાતી દૈનિક: ગુજરાત, દેશ અને વિશ્વના તાજા સમાચાર અને જૂના અંકો.",
    en: "Capital Kranti (કેપિટલ ક્રાંતિ), the Gujarati daily from Gandhinagar: the latest news of Gujarat, India and the world, and past issues.",
    hi: "Capital Kranti (कैपिटल क्रांति), गांधीनगर का गुजराती दैनिक: गुजरात, देश और विश्व के ताज़ा समाचार और पुराने अंक.",
  }[o.lang];
  const at = (l: Lang) => `${SITE_URL}${href(l, o.path)}`;
  const langs = o.langs ?? ["gu", "en", "hi"];
  const url = at(langs.includes(o.lang) ? o.lang : "gu");
  const image = o.image ?? `${SITE_URL}/og.png`;
  return {
    metadataBase: new URL(SITE_URL),
    title, description,
    alternates: { canonical: url, languages: { ...Object.fromEntries(langs.map((l) => [l, at(l)])), "x-default": at("gu") },
                  types: { "application/rss+xml": `${SITE_URL}${o.lang === "gu" ? "" : `/${o.lang}`}/rss.xml` } },
    robots: INDEXABLE ? { index: true, follow: true, "max-image-preview": "large" } : { index: false, follow: false },
    openGraph: {
      type: o.article ? "article" : "website", url, title: o.title ?? name, description, siteName: name, locale: `${o.lang}_IN`,
      images: [{ url: image }],
      ...(o.article ? { publishedTime: o.article.publishedAt, modifiedTime: o.article.updatedAt } : {}),
    },
    twitter: { card: "summary_large_image", title: o.title ?? name, description, images: [image] },
    // site/tools/icons.mjs draws them; ?v=2 (29 Oct, the new icon) so browsers drop the old one they kept
    icons: {
      icon: [{ url: "/favicon-32.png?v=2", sizes: "32x32", type: "image/png" }, { url: "/icon.png?v=2", sizes: "512x512", type: "image/png" }],
      shortcut: "/favicon.ico?v=2", apple: "/apple-icon.png?v=2",
    },
  };
}
