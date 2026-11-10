// The RSS feed and the Google News sitemap, written as XML by hand (small, and no library to keep up).
import type { Lang, Story } from "./types.ts";
import { href } from "./i18n.ts";
import { PAPER, SITE_URL } from "./site.ts";
import { sectionName } from "./sections.ts";
import { shareCopy } from "./photo.ts";

/** A feed or sitemap as it's sent: made when asked for and kept by the CDN for a few minutes, never as a kept-ready
 *  page (10 Nov: a kept-ready file is renewed only after someone asks for it, so the Hindi news sitemap Google read was
 *  30 hours old and the feed two and a half days; and each renewal was a paid "ISR write"). */
export const xml = (body: string, seconds = 600) => new Response(body, {
  headers: { "content-type": "application/xml; charset=utf-8", "cache-control": `public, max-age=0, s-maxage=${seconds}` },
});

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A feed of the newest stories (`self`: the feed's own path, e.g. "/en/rss.xml"). 6 Nov: newest first by the time each
 *  was published (it was the printed paper's order); an English or Hindi feed holds only the stories translated into it
 *  (the others would be Gujarati under an English title); each story's picture is the site's own 1200-wide copy with its
 *  real size; the feed says when it was made and where it lives. */
export function rss(stories: Story[], lang: Lang, self: string, title?: string) {
  const list = stories.filter((s) => lang === "gu" || (lang === "en" ? s.en : s.hi)?.headline)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 50);
  const items = list.map((s) => {
    const e = lang === "en" ? s.en : lang === "hi" ? s.hi : null;
    const link = `${SITE_URL}${href(lang, `/news/${s.id}`)}`;
    const w = s.photo ? Math.min(s.photo.width, 1200) : 0;
    const picture = s.photo ? `<media:content url="${x(new URL(shareCopy(s.photo), SITE_URL).href)}" medium="image" width="${w}" height="${Math.round((s.photo.height * w) / s.photo.width)}"/>` : "";
    return `<item><title>${x(e?.headline || s.headline)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>` +
      `<pubDate>${new Date(s.publishedAt).toUTCString()}</pubDate><category>${x(sectionName(s.tier, lang))}</category>` +
      `<description>${x(e?.deck || s.deck)}</description>${picture}</item>`;
  }).join("");
  const built = list[0] ? new Date(list[0].publishedAt).toUTCString() : new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel>` +
    `<title>${x(title ?? PAPER[lang].name)}</title><link>${SITE_URL}${href(lang, "/")}</link><atom:link href="${SITE_URL}${self}" rel="self" type="application/rss+xml"/>` +
    `<description>${x(PAPER[lang].tagline)}</description><language>${lang}-IN</language><lastBuildDate>${built}</lastBuildDate><ttl>15</ttl>${items}</channel></rss>`;
}

/** Google News: the last two days' stories in one language (5 Nov: one file for all three held its 1,000 URLs, the most
 *  Google reads in a file, within twelve hours, so the stories of the day before were missing from it). */
export function newsSitemap(stories: { id: string; publishedAt: string; headline: string; en: string | null; hi: string | null }[], lang: Lang) {
  const urls = stories.flatMap((s) => {
    const title = lang === "gu" ? s.headline : s[lang];
    if (!title) return [];
    return [`<url><loc>${SITE_URL}${href(lang, `/news/${s.id}`)}</loc><news:news><news:publication><news:name>${x(PAPER[lang].name)}</news:name>` +
      `<news:language>${lang}</news:language></news:publication><news:publication_date>${s.publishedAt}</news:publication_date><news:title>${x(title)}</news:title></news:news></url>`];
  }).slice(0, 1000).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}</urlset>`;
}

/** The news sitemap's address (the one in Search Console and robots.txt) lists one file per language. */
const NEWS_SITEMAP_LANGS = ["gu", "en", "hi"] as const;
export function newsSitemapIndex(newest: string | null) {
  const files = NEWS_SITEMAP_LANGS.map((lang) => `<sitemap><loc>${SITE_URL}/news-sitemap-${lang}.xml</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files}</sitemapindex>`;
}

/** The whole site's sitemap: each page in each of its languages, naming all its versions. */
export function siteMap(pages: { path: string; lastModified?: string; langs?: Lang[] }[]) {
  const urls = pages.flatMap(({ path, lastModified, langs = ["gu", "en", "hi"] }) => {
    const links = [...langs.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${x(SITE_URL + href(l, path))}" />`),
                   `<xhtml:link rel="alternate" hreflang="x-default" href="${x(SITE_URL + href("gu", path))}" />`].join("");
    return langs.map((l) => `<url><loc>${x(SITE_URL + href(l, path))}</loc>${links}${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`);
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>`;
}
