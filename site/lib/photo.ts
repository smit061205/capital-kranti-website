// Pictures at the size the reader needs (the user, 30 Oct: the site was slow; a 1920-wide file went to every small card).
// The site's own photos are made smaller by app/media, official ones by app/official, Wikimedia Commons' by app/commons (3 Nov: one took 35 seconds to
// come from Commons, and its copies weighed two to four times ours), once each, then kept by the CDN; Pexels' and Unsplash's by themselves. Anything else stays as it is.
const STEPS = [500, 720, 960, 1920] as const;

/** a Commons photo's place there ("a/ab/File.jpg"), from its address or one of its copies' */
function commons(url: string): string | null {
  const m = url.match(/^https:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/[^/]+\.(?:jpe?g|png|webp))(?:\/\d+px-[^/]+)?$/i);
  return m ? m[1] : null;
}

/** A picture's address at a width, or null when no smaller copy can be asked for. */
function at(url: string, w: number): string | null {
  const plain = url.replace(/\?.*$/, "");
  if (/^\/media\/.*\.(jpe?g|png)$/.test(plain)) return `${plain}?w=${w}`;
  // official photos, made smaller by app/official from the government's own site
  if (/^\/official\/[A-Za-z0-9_-]+\.jpg$/.test(plain)) return `${plain}?w=${Math.min(w, 1200)}`;
  // Pexels' symbolic photos (engine/wikiphoto.ts) are made smaller by Pexels itself, which asks to be shown from its servers
  if (/^https:\/\/images\.pexels\.com\/photos\//.test(plain)) return `${plain}?auto=compress&cs=tinysrgb&w=${w}`;
  // Unsplash's, by Unsplash itself, keeping its own marks in the address
  if (/^https:\/\/images\.unsplash\.com\//.test(plain)) { const u = new URL(url); u.searchParams.set("w", String(w)); return u.href; }
  const c = commons(plain);
  return c ? `/commons/${c}?w=${Math.min(w, 1200)}` : null;
}

/** What an <img> needs to take the smallest copy that looks sharp: `sizes` says how wide it shows. */
export function pic(p: { url: string; width: number }, sizes: string): { src: string; srcSet?: string; sizes?: string } {
  const copies: { w: number; url: string }[] = [];
  for (const w of STEPS) {
    const url = w < p.width ? at(p.url, w) : null;
    if (url && !copies.some((c) => c.url === url)) copies.push({ w: Math.min(w, 1200), url });
  }
  // the whole photo: a Commons one at most 1200 wide, from the site too
  const whole = commons(p.url.replace(/\?.*$/, "")) ? { w: Math.min(p.width, 1200), url: at(p.url, 1200)! } : { w: p.width, url: p.url };
  if (!copies.length) return { src: whole.url };
  if (!copies.some((c) => c.url === whole.url)) copies.push(whole);
  return { src: copies[Math.min(1, copies.length - 1)].url, srcSet: copies.map((c) => `${c.url} ${c.w}w`).join(", "), sizes };
}

/** The largest copy, for a photo opened full screen: a Commons one from the site too. */
export function largest(p: { url: string; width: number }): string {
  return commons(p.url.replace(/\?.*$/, "")) ? at(p.url, 1200)! : p.url;
}

/** The copy for share previews and search engines: 1200 wide (what Google and WhatsApp ask for), or the whole photo when smaller. */
export function shareCopy(p: { url: string; width: number }): string {
  return (p.width > 1200 && at(p.url, 1200)) || largest(p);
}

/** How wide the pictures show. Phones get a little less than their full width: 960 looks sharp there and is a third the size. */
export const SIZES = {
  thumb: "160px",
  card: "(max-width: 800px) 60vw, 33vw",
  /** Aavtikal's cards: two across on a phone, three on a tablet */
  pair: "(max-width: 560px) 45vw, (max-width: 800px) 28vw, 33vw",
  // a phone's big photos ask for 60% of the screen's dots, not 70: most phones then take the 720-wide copy, not the 960
  // (6 Nov: on mobile data the home page's lead photo came last, at 4.6 seconds); still sharper than the screen's width
  lead: "(max-width: 800px) 60vw, 66vw",
  full: "(max-width: 800px) 60vw, 100vw",
  inside: "(max-width: 800px) 60vw, 760px",
};

/** A Commons author's name as a credit shows it: the field is free text ("This photo was taken by …. Please credit …",
 *  a whole paragraph at times), so only the name is kept, about 50 letters at most (5 Nov: sentences showed under photos). */
export function authorName(raw: string): string {
  let a = raw.replace(/^\s*(?:this (?:photo(?:graph)?|image|picture) (?:was |is )?(?:taken|clicked|shot|made|created|captured) by|(?:photo(?:graph)?|picture|image)s? (?:taken )?(?:by|from)|(?:taken|clicked|shot|uploaded|captured) by|courtesy(?: of)?|©|\(c\)|copyright)\s*:?\s*/i, "");
  a = a.split(/(?<=\p{L}{3})\. |\s[-–—|]\s|\s\(|;|,\s*(?:please|used|licen[cs]ed|all rights)/iu)[0].trim().replace(/[.,:]+$/, "");
  if (a.length > 50) a = a.slice(0, 50).replace(/\s+\S*$/, "");
  return a || "Wikimedia Commons";
}

/** A stored credit cleaned for showing: a Commons one is "<author>, <licence>, Wikimedia Commons", the author's part
 *  cleaned (stories saved before 5 Nov kept the whole field). */
export function creditText(credit: string): string {
  const m = credit.match(/^([\s\S]*), ([^,]+), Wikimedia Commons$/);
  return m ? `${authorName(m[1])}, ${m[2]}, Wikimedia Commons` : credit;
}

/** Unsplash's own page, as its rules ask a credit to link it (with the app's name, so it knows where readers came from) */
export const UNSPLASH_HOME = "https://unsplash.com/?utm_source=capital_kranti&utm_medium=referral";
