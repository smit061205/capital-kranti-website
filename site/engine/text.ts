// The few pieces of text handling the website shares in spirit with the newsroom app, kept here so the
// website stands alone (split from the app's repository, 31 Oct): reading PIB's pages, the number check,
// and the check for a story saying the same thing twice. Copied from the app as they stood; a fix made
// in one does not reach the other.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// HTML's named characters up to the arrows (Latin-1, accents, typographic
// marks): Malé, ₹-adjacent dashes and quotes, as PIB writes them
const NAMED: Record<string, number> = { apos: 0x27, AElig: 0xc6, Aacute: 0xc1, Acirc: 0xc2, Agrave: 0xc0, Alpha: 0x391, Aring: 0xc5, Atilde: 0xc3, Auml: 0xc4, Beta: 0x392, Ccedil: 0xc7, Chi: 0x3a7, Dagger: 0x2021, Delta: 0x394, ETH: 0xd0, Eacute: 0xc9, Ecirc: 0xca, Egrave: 0xc8, Epsilon: 0x395, Eta: 0x397, Euml: 0xcb, Gamma: 0x393, Iacute: 0xcd, Icirc: 0xce, Igrave: 0xcc, Iota: 0x399, Iuml: 0xcf, Kappa: 0x39a, Lambda: 0x39b, Mu: 0x39c, Ntilde: 0xd1, Nu: 0x39d, OElig: 0x152, Oacute: 0xd3, Ocirc: 0xd4, Ograve: 0xd2, Omega: 0x3a9, Omicron: 0x39f, Oslash: 0xd8, Otilde: 0xd5, Ouml: 0xd6, Phi: 0x3a6, Pi: 0x3a0, Prime: 0x2033, Psi: 0x3a8, Rho: 0x3a1, Scaron: 0x160, Sigma: 0x3a3, THORN: 0xde, Tau: 0x3a4, Theta: 0x398, Uacute: 0xda, Ucirc: 0xdb, Ugrave: 0xd9, Upsilon: 0x3a5, Uuml: 0xdc, Xi: 0x39e, Yacute: 0xdd, Yuml: 0x178, Zeta: 0x396, aacute: 0xe1, acirc: 0xe2, acute: 0xb4, aelig: 0xe6, agrave: 0xe0, alefsym: 0x2135, alpha: 0x3b1, amp: 0x26, aring: 0xe5, atilde: 0xe3, auml: 0xe4, bdquo: 0x201e, beta: 0x3b2, brvbar: 0xa6, bull: 0x2022, ccedil: 0xe7, cedil: 0xb8, cent: 0xa2, chi: 0x3c7, circ: 0x2c6, copy: 0xa9, crarr: 0x21b5, curren: 0xa4, dArr: 0x21d3, dagger: 0x2020, darr: 0x2193, deg: 0xb0, delta: 0x3b4, divide: 0xf7, eacute: 0xe9, ecirc: 0xea, egrave: 0xe8, emsp: 0x2003, ensp: 0x2002, epsilon: 0x3b5, eta: 0x3b7, eth: 0xf0, euml: 0xeb, euro: 0x20ac, fnof: 0x192, frac12: 0xbd, frac14: 0xbc, frac34: 0xbe, frasl: 0x2044, gamma: 0x3b3, gt: 0x3e, hArr: 0x21d4, harr: 0x2194, hellip: 0x2026, iacute: 0xed, icirc: 0xee, iexcl: 0xa1, igrave: 0xec, image: 0x2111, iota: 0x3b9, iquest: 0xbf, iuml: 0xef, kappa: 0x3ba, lArr: 0x21d0, lambda: 0x3bb, laquo: 0xab, larr: 0x2190, ldquo: 0x201c, lrm: 0x200e, lsaquo: 0x2039, lsquo: 0x2018, lt: 0x3c, macr: 0xaf, mdash: 0x2014, micro: 0xb5, middot: 0xb7, mu: 0x3bc, nbsp: 0xa0, ndash: 0x2013, not: 0xac, ntilde: 0xf1, nu: 0x3bd, oacute: 0xf3, ocirc: 0xf4, oelig: 0x153, ograve: 0xf2, oline: 0x203e, omega: 0x3c9, omicron: 0x3bf, ordf: 0xaa, ordm: 0xba, oslash: 0xf8, otilde: 0xf5, ouml: 0xf6, para: 0xb6, permil: 0x2030, phi: 0x3c6, pi: 0x3c0, piv: 0x3d6, plusmn: 0xb1, pound: 0xa3, prime: 0x2032, psi: 0x3c8, quot: 0x22, rArr: 0x21d2, raquo: 0xbb, rarr: 0x2192, rdquo: 0x201d, real: 0x211c, reg: 0xae, rho: 0x3c1, rlm: 0x200f, rsaquo: 0x203a, rsquo: 0x2019, sbquo: 0x201a, scaron: 0x161, sect: 0xa7, shy: 0xad, sigma: 0x3c3, sigmaf: 0x3c2, sup1: 0xb9, sup2: 0xb2, sup3: 0xb3, szlig: 0xdf, tau: 0x3c4, theta: 0x3b8, thetasym: 0x3d1, thinsp: 0x2009, thorn: 0xfe, tilde: 0x2dc, times: 0xd7, trade: 0x2122, uArr: 0x21d1, uacute: 0xfa, uarr: 0x2191, ucirc: 0xfb, ugrave: 0xf9, uml: 0xa8, upsih: 0x3d2, upsilon: 0x3c5, uuml: 0xfc, weierp: 0x2118, xi: 0x3be, yacute: 0xfd, yen: 0xa5, yuml: 0xff, zeta: 0x3b6, zwj: 0x200d, zwnj: 0x200c };
// (a non-breaking space reads as a plain one in a release's text)
const ENTITIES: Record<string, string> = { ...Object.fromEntries(Object.entries(NAMED).map(([k, v]) => [k, String.fromCodePoint(v)])), nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m);
}
const text = (html: string) => decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** "22 OCT 2026 11:38AM by PIB Ahmedabad" -> "2026-10-22" */
export function isoFromDateLine(line: string): string | null {
  const m = line.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toUpperCase()) + 1;
  return month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export interface ListItem { prid: number; ministry: string; headline: string }

/** A release list page: every release with its ministry, and the day it shows. */
export function parseList(html: string): { date: string | null; items: ListItem[] } {
  const sel = (name: string) => {
    const at = html.indexOf(`ContentPlaceHolder1_${name}`);
    return at < 0 ? null : html.slice(at, at + 20_000).match(/<option selected="selected" value="(\d+)"/)?.[1] ?? null;
  };
  const [d, mo, y] = [sel("ddlday"), sel("ddlMonth"), sel("ddlYear")];
  const date = d && mo && y ? `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
  const area = html.slice(Math.max(0, html.indexOf('class="content-area"')));
  const items: ListItem[] = [];
  const seen = new Set<number>();
  // <li><h3 class='font104'>Ministry</h3><ul class='num'><li><a ... href='/PressReleaseDetail.aspx?PRID=n'>headline</a></li>...
  for (const block of area.split(/<h3 class='font104'>/).slice(1)) {
    const ministry = text(block.slice(0, block.indexOf("</h3>")));
    for (const m of block.matchAll(/<a[^>]*href='[^']*PRID=(\d+)'[^>]*>([\s\S]*?)<\/a>/g)) {
      const prid = Number(m[1]);
      if (seen.has(prid)) continue;
      seen.add(prid);
      items.push({ prid, ministry, headline: text(m[2]) });
    }
  }
  return { date, items };
}

export interface ParsedRelease {
  prid: number; ministry: string; headline: string; subhead: string; dateLine: string; date: string | null;
  office: string; paras: string[]; photos: string[]; langVersions: number[];
}

// what closes a release (the stars, the social-media line) or is only its furniture
const END = /^\*{3,}$|^(?:સોશિયલ મીડિયા|सोशल मीडिया|Follow us)|^\(?(?:રિલીઝ|रिलीज़|Release) ID/i;
const STAFF = /^\(?[A-Z]{1,5}(?:\s*\/\s*[A-Za-z.]{1,6}){1,5}\)?\.?$/;
const ICON = /twitter|fb|facebook|instagram|email|icon|logo|youtube|whatsapp|koo|threads/i;

/** One release page (PressReleaseIframePage.aspx). */
export function parseRelease(html: string, prid: number): ParsedRelease | null {
  const byId = (id: string, tag: string) => {
    const m = html.match(new RegExp(`<${tag}[^>]*id="${id}"[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? text(m[1]) : "";
  };
  const headline = byId("Titleh2", "h1") || byId("Titleh2", "h2");
  if (!headline) return null;
  const dateLine = byId("PrDateTime", "div").replace(/^[^\d]*/, "");
  const start = html.indexOf('id="PrDateTime"');
  const stop = (() => {
    const i = html.indexOf('class="ReleaseLang"', start);
    const j = html.indexOf('id="ReleaseId"', start);
    return Math.min(...[i, j].filter((x) => x > start), html.length);
  })();
  const body = start > 0 ? html.slice(start, stop) : "";
  const paras: string[] = [];
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const p = text(m[1]);
    if (!p) continue;
    if (END.test(p)) break;
    if (STAFF.test(p)) continue; // the staff's initials ("SM/BS/JD"), not text to print
    paras.push(p);
  }
  const photos = [...body.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .filter((m) => !ICON.test(m[1]) && !/height:\s*\d{1,2}px|width:\s*\d{1,2}px/i.test(m[0]))
    .map((m) => m[1].replace(/^http:/, "https:"));
  const langBlock = html.slice(html.indexOf('class="ReleaseLang"'), html.indexOf('class="RelTag"'));
  const langVersions = html.includes('class="ReleaseLang"')
    ? [...new Set([...langBlock.matchAll(/PRID=(\d+)/g)].map((m) => Number(m[1])))].filter((n) => n !== prid) : [];
  return {
    prid, ministry: byId("MinistryName", "div"), headline, subhead: text(html.match(/id="ltrSubtitle"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ""),
    dateLine, date: isoFromDateLine(dateLine), office: dateLine.replace(/^.*?\bby\b/i, "").trim() || "PIB",
    paras, photos: [...new Set(photos)], langVersions,
  };
}

/** Every number in `s`, in Latin digits: Gujarati (૦-૯) and Devanagari (०-९) digits read as theirs. */
export const digits = (s: string) => new Set((s.replace(/[૦-૯]/g, (d) => String("૦૧૨૩૪૫૬૭૮૯".indexOf(d)))
  .replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .match(/\d+(?:[.,]\d+)*/g) ?? []));

// small numbers as the releases often spell them, 1-20 (Gujarati, Hindi, then English)
const NUMBER_WORDS: string[][] = [
  [], ["એક", "एक", "one", "પહેલી", "પહેલો", "પહેલા"], ["બે", "दो", "two"], ["ત્રણ", "तीन", "three"], ["ચાર", "चार", "four"], ["પાંચ", "पांच", "पाँच", "five"],
  ["છ", "छह", "छः", "six"], ["સાત", "सात", "seven"], ["આઠ", "आठ", "eight"], ["નવ", "नौ", "nine"], ["દસ", "दस", "ten"],
  ["અગિયાર", "ग्यारह", "eleven"], ["બાર", "बारह", "twelve"], ["તેર", "तेरह", "thirteen"], ["ચૌદ", "चौदह", "fourteen"],
  ["પંદર", "पंद्रह", "fifteen"], ["સોળ", "सोलह", "sixteen"], ["સત્તર", "सत्रह", "seventeen"], ["અઢાર", "अठारह", "eighteen"],
  ["ઓગણીસ", "उन्नीस", "nineteen"], ["વીસ", "बीस", "twenty"],
];
/** The numbers in `out` that aren't in `source` -- written in any digits,
 * with or without commas between them, or (up to 20) spelt out there. */
export function numbersNotIn(out: string, source: string, date?: string): string[] {
  // (no commas, and no ".00" -- a table's "1,03,63,188.00" is the story's ૧,૦૩,૬૩,૧૮૮)
  const plain = (n: string) => n.replace(/,/g, "").replace(/\.0+$/, "");
  const known = new Set([...digits(source)].map(plain));
  // the release's own date (its day, month and year): a story may say "22 October"
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    for (const n of [y, m, d, String(Number(m)), String(Number(d))]) known.add(n);
  }
  // "9 हज़ार", "2 લાખ": the same number written out in full
  const latin = source.replace(/[૦-૯]/g, (d) => String("૦૧૨૩૪૫૬૭૮૯".indexOf(d))).replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  for (const m of latin.matchAll(/(\d+(?:\.\d+)?)\s*(हज़ार|हजार|હજાર|लाख|લાખ)/g)) {
    known.add(String(Math.round(Number(m[1]) * (/लाख|લાખ/.test(m[2]) ? 100_000 : 1000))));
  }
  // "3 હજાર 897", "3 લાખ 75 હજાર": figures with the words for thousand and lakh between them
  for (const m of latin.matchAll(/(?:(\d+)\s*(?:लाख|લાખ)\s*)?(\d+)\s*(?:हज़ार|हजार|હજાર)\s*(\d{1,3})?(?!\d)/g)) {
    known.add(String(Number(m[1] ?? 0) * 100_000 + Number(m[2]) * 1000 + Number(m[3] ?? 0)));
  }
  // "377 million" is "૩૭.૭ કરોડ" in an Indian paper: millions, billions, crores and lakhs as each other
  const asNumber = (n: number) => String(Math.round(n * 1000) / 1000);
  for (const m of latin.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(million|billion|crore|lakh|કરોડ|લાખ|करोड़|करोड|लाख)/gi)) {
    const v = Number(m[1]);
    const unit = m[2].toLowerCase();
    const units = /million/.test(unit) ? v * 1e6 : /billion/.test(unit) ? v * 1e9 : /crore|કરોડ|करोड/.test(unit) ? v * 1e7 : v * 1e5;
    // and in full: "41.74 lakh" is the story's ૪૧,૭૪,૦૦૦ (1 Nov: a true figure failed the check three times)
    known.add(asNumber(units));
    for (const per of [1e5, 1e6, 1e7, 1e9]) known.add(asNumber(units / per));
  }
  // "આઠ હજાર 224", "બે હજાર 356": thousands in words, the rest in figures (All India Radio's way) = 8224, 2356
  for (const m of latin.matchAll(/([\p{L}\p{M}]+)\s+(हज़ार|हजार|હજાર)\s+(\d{1,3})(?!\d)/gu)) {
    const k = NUMBER_WORDS.findIndex((ws) => ws.includes(m[1].toLowerCase()));
    if (k > 0) known.add(String(k * 1000 + Number(m[3])));
  }
  const words = new Set(source.toLowerCase().split(/[\s,.;:()'"‘’“”!?।-]+/));
  return [...digits(out)].filter((n) => {
    const v = plain(n);
    // the minutes of "10:00" are not a figure
    if (known.has(v) || /^0+$/.test(v)) return false;
    const k = Number(v);
    return !(Number.isInteger(k) && k >= 1 && k <= 20 && NUMBER_WORDS[k].some((w) => words.has(w) || [...words].some((x) => x.startsWith(w) && x.length <= w.length + 3)));
  });
}

/** The sentences of a text, each as its set of words (short words aside). */
const sentenceWords = (body: string) => body.split(/(?<=[.!?।])\s+|\n+/)
  .map((s) => new Set(s.split(/\s+/).filter((w) => w.length > 2)))
  .filter((s) => s.size >= 6);

/** Does a story say the same thing twice? Two sentences sharing most of
 * their words. */
export function repeats(body: string): boolean {
  const sentences = sentenceWords(body);
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const a = sentences[i], b = sentences[j];
      let both = 0;
      for (const w of a) if (b.has(w)) both++;
      // of about the same length and mostly the same words: said twice (a
      // short sentence inside a long one, or a long name shared, isn't)
      if (both / Math.max(a.size, b.size) >= 0.5) return true;
    }
  }
  return false;
}
