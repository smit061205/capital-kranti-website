// The website's own constants. Its address is capitalkranti.co.in (2 Nov; the old
// Vercel address forwards there, next.config.ts); a Vercel address is never indexed
// by search engines (a preview's would compete with the real one).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://capitalkranti.co.in").replace(/\/$/, "");
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
};
