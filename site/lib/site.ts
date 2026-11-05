// The website's own constants. Its address is www.capitalkranti.co.in (2 Nov; the old
// Vercel address forwards there, next.config.ts); a Vercel address is never indexed
// by search engines (a preview's would compete with the real one).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.capitalkranti.co.in").replace(/\/$/, "");
/** The paper's WhatsApp channel, once it has one: until then no page offers it (5 Nov: a "coming soon" box sat on every
 *  front page and Aavtikal page with nothing to join). */
export const WHATSAPP_CHANNEL = "";
/** The paper's own pages elsewhere (Instagram, Facebook, the WhatsApp channel), for Google to know them as the paper's
 *  (sameAs, lib/jsonld.tsx): none listed until the user gives their addresses. */
export const SOCIAL: string[] = [];
/** Google's "preferred sources" page for the paper: a reader who picks it sees its stories more often in Top Stories
 *  (Google Search Central, 2025; the SEO report, 6 Nov) */
export const PREFERRED_SOURCE = "https://www.google.com/preferences/source?q=capitalkranti.co.in";
export const INDEXABLE = !/\.vercel\.app$/.test(new URL(SITE_URL).hostname);
export const PAPER = {
  gu: { name: "કેપિટલ ક્રાંતિ", tagline: "સમાજનો વિવેકપૂર્ણ દ્રષ્ટિકોણ", place: "ગાંધીનગર" },
  en: { name: "Capital Kranti", tagline: "A thoughtful view of society", place: "Gandhinagar" },
  hi: { name: "कैपिटल क्रांति", tagline: "समाज का विवेकपूर्ण दृष्टिकोण", place: "गांधीनगर" },
  rni: "54922/93",
  email: "capitalkranti@gmail.com",
  phone: "98256 08744",
  landline: "(079) 23210071",
  founded: 1993,
  /** the people behind the paper (the user, 4 Nov): named on the About page and in what Google reads */
  editor: { gu: "પાર્થ ઠક્કર", en: "Parth Thakkar", hi: "पार्थ ठक्कर" },
  tech: [{ gu: "સ્મિત ઠક્કર", en: "Smit Thakkar", hi: "स्मित ठक्कर" }, { gu: "મિથિલેશ ઠક્કર", en: "Mithilesh Thakkar", hi: "मिथिलेश ठक्कर" }],
};
