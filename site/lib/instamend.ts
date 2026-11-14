// The editor page's Instagram tab, when it opens: a set left "approved, not up yet" or "not posted" that is in fact up
// (15 Nov: the site stopped waiting before Instagram answered, so the page said a set that was on Instagram wasn't) is
// looked for on Instagram and the Facebook Page, and marked as posted with its links when it's found there.
import { instaLog, saveSet, type InstaSet } from "./insta.ts";
import { findPosted, instagramOn } from "./instagram.ts";
import { facebookOn, findPostedFacebook } from "./facebook.ts";
import type { db } from "./db.ts";

/** how long the button may be at work putting a set up (the editor page's maxDuration); within it a set is "going up" */
export const POSTING_MS = 300_000;

export async function mendSets(sql: NonNullable<ReturnType<typeof db>>, sets: InstaSet[]): Promise<void> {
  const stuck = sets.filter((x) => x.image && x.caption && (x.state === "failed" ||
    (x.state === "approved" && x.postedAt && Date.now() - new Date(x.postedAt).getTime() > POSTING_MS))).slice(0, 4);
  await Promise.all(stuck.map(async (set) => {
    const ig = instagramOn() && !set.postUrl, fb = facebookOn() && !set.fbUrl;
    if (!ig && !fb) return;
    const [igUrl, fbUrl] = await Promise.all([ig ? findPosted(set).catch(() => null) : null, fb ? findPostedFacebook(set).catch(() => null) : null]);
    if (!igUrl && !fbUrl) return;
    if (igUrl) set.postUrl = igUrl;
    if (fbUrl) set.fbUrl = fbUrl;
    const done = (!instagramOn() || set.postUrl) && (!facebookOn() || set.fbUrl);
    if (done) { set.state = "posted"; set.postedAt = new Date().toISOString(); set.note = ""; }
    await saveSet(sql, set);
    const where = [igUrl && "ઇન્સ્ટાગ્રામ", fbUrl && "ફેસબુક"].filter(Boolean).join(" અને ");
    await instaLog(sql, "site", `${where} પર સેટ મુકાયેલો મળ્યો (સાઇટે જવાબની રાહ જોવાનું વહેલું બંધ કર્યું હતું): ${done ? "“મુકાયો” કર્યો" : "લિંક સાચવી"}`);
  }));
}
