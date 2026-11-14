import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/site.ts";

// Bots that read every page and send no readers back (14 Nov: the site was paused for using up Vercel's free plan;
// that week bots made over half the requests: Ahrefs 11.6K, SE Ranking 10K, ClaudeBot 7.4K, Amazonbot 7.2K, GPTBot 3.6K,
// against Google's 10K). Two kinds:
// - AI training crawlers, which copy pages to train a model. The AI *search* bots stay open, because they put our
//   stories, with a link, into answers on ChatGPT (OAI-SearchBot, ChatGPT-User), Claude (Claude-SearchBot, Claude-User),
//   Perplexity (PerplexityBot, Perplexity-User), DuckDuckGo (DuckAssistBot) and Mistral (MistralAI-User). Google's AI
//   Overviews and Gemini come through Googlebot and Google-Extended, Copilot through Bingbot, Siri and Spotlight through
//   Applebot: all left open.
// - SEO tools that measure other people's sites for their customers.
// Those that ignore this file are turned away by Vercel's firewall (its AI Bots rule, set in the dashboard).
const TRAINING = ["GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Bytespider", "meta-externalagent", "Amazonbot",
  "cohere-ai", "cohere-training-data-crawler", "Diffbot", "ImagesiftBot", "Omgilibot", "omgili", "Timpibot", "AI2Bot",
  "PanguBot", "img2dataset"];
const SEO_TOOLS = ["AhrefsBot", "SemrushBot", "SERankingBacklinksBot", "MJ12bot", "DotBot", "BLEXBot", "DataForSeoBot",
  "Barkrowler", "serpstatbot", "PetalBot"];

// The free Vercel address stays out of search engines until the paper's own
// domain points here (lib/site.ts); then everything but search and the API is open.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  // the pages each reader makes for themselves (search results, saved stories) and the editor's own; never the photos
  const own = ["/search", "/saved", "/aavtikal/search"].flatMap((p) => [p, `/en${p}`, `/hi${p}`]);
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/editor", ...own] },
      { userAgent: [...TRAINING, ...SEO_TOOLS], disallow: "/" },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
