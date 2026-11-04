// What search engines read about the paper and its pages (schema.org JSON-LD, for Google Search and Google News).
import type { Lang } from "./types.ts";
import { href } from "./i18n.ts";
import { PAPER, SITE_URL } from "./site.ts";

/** The paper itself, named once and referred to by its @id from every article. */
export const ORG_ID = `${SITE_URL}/#org`;
/** The editor, named once and referred to from the paper and from the editor's own stories. */
export const EDITOR_ID = `${SITE_URL}/#editor`;
export function editor(lang: Lang) {
  return { "@type": "Person", "@id": EDITOR_ID, name: PAPER.editor.en, alternateName: [PAPER.editor.gu, PAPER.editor.hi], jobTitle: "Editor",
           url: `${SITE_URL}${href(lang, "/about")}`, worksFor: { "@id": ORG_ID } };
}
export function organization(lang: Lang) {
  const page = (p: string) => `${SITE_URL}${href(lang, p)}`;
  return {
    "@type": "NewsMediaOrganization", "@id": ORG_ID,
    name: PAPER.en.name, alternateName: [PAPER.gu.name, PAPER.hi.name], url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 600, height: 120 },
    foundingDate: String(PAPER.founded), foundingLocation: "Gandhinagar, Gujarat, India",
    email: PAPER.email, telephone: `+91 ${PAPER.phone}`,
    address: { "@type": "PostalAddress", addressLocality: "Gandhinagar", addressRegion: "Gujarat", addressCountry: "IN" },
    publishingPrinciples: page("/editorial-policy"), correctionsPolicy: page("/corrections"),
    verificationFactCheckingPolicy: page("/how-we-check"), actionableFeedbackPolicy: page("/contact"), masthead: page("/about"),
    employee: [editor(lang), ...PAPER.tech.map((p) => ({ "@type": "Person", name: p.en, alternateName: [p.gu, p.hi], jobTitle: "Technology" }))],
  };
}

/** Home > … > this page, each step a name and a path on the site. */
export function breadcrumbs(lang: Lang, steps: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: steps.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: `${SITE_URL}${href(lang, x.path)}` })),
  };
}

/** A news story or an article: the page's own address, its words, dates, pictures and who wrote it. */
export function article(o: { type?: "NewsArticle" | "Article"; url: string; lang: Lang; headline: string; description?: string; section?: string;
                             publishedAt: string; updatedAt: string; image?: string | null; author?: { name: string; url: string } | "editor"; basedOn?: string; words?: number }) {
  return {
    "@type": o.type ?? "NewsArticle", "@id": `${o.url}#article`, url: o.url, mainEntityOfPage: o.url,
    // Google shows at most 110 characters of a headline
    headline: o.headline.length > 110 ? `${o.headline.slice(0, 109)}…` : o.headline,
    description: o.description || undefined, inLanguage: o.lang, articleSection: o.section,
    datePublished: o.publishedAt, dateModified: o.updatedAt || o.publishedAt,
    // a story without a photo of its own shows the paper's share picture rather than none
    image: [o.image ? new URL(o.image, SITE_URL).href : `${SITE_URL}/og.png`],
    // the engine's stories are the paper's desk's; the editor's own carry the editor's name
    author: o.author === "editor" ? editor(o.lang) : o.author ? { "@type": "Organization", name: o.author.name, url: o.author.url }
          : { "@type": "Organization", name: PAPER[o.lang].name, url: `${SITE_URL}/` },
    publisher: { "@id": ORG_ID }, isAccessibleForFree: true, wordCount: o.words, isBasedOn: o.basedOn,
  };
}

/** The <script> that carries them; several things on one page go in one @graph. */
export function JsonLd({ items }: { items: object[] }) {
  const data = { "@context": "https://schema.org", "@graph": items };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
