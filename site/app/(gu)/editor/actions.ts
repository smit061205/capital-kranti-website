"use server";
// The editor page's buttons (lib/editor.ts). Each one checks the sign-in itself: these
// can be called directly, not only from the page.
import { cookies } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { classifiedPaths, listPaths, renew as renewPages, storyPaths } from "@/lib/renew.ts";
import { db } from "@/lib/db.ts";
import { redirect } from "next/navigation";
import { addFeature, addStory, COOKIE, decideFeature, editorOf, restoreStory, saveFeature, saveStory, setPaused, withdrawStory, type NewFeature, type NewStory, type Words } from "@/lib/editor.ts";
import { help, type Draft, type Help } from "@/lib/aihelp.ts";
import { GENRES, sectionName, TIERS } from "@/lib/sections.ts";
import { dropLeader, findLeader, saveLeader, type FoundLeader, type Leader } from "@/lib/leaders.ts";
import { addAd, dropAd } from "@/lib/classifieds.ts";
import { addBanner, dropBanner } from "@/lib/banners.ts";
import { askInsta, captionFor, instaLog, cleanTiers, cleanTimes, getSet, instaSettings, MIN_KEPT, saveInstaSettings, saveSet } from "@/lib/insta.ts";
import { instagramOn, postSet } from "@/lib/instagram.ts";
import { facebookOn, postSetFacebook } from "@/lib/facebook.ts";
import { POSTING_MS } from "@/lib/instamend.ts";

async function signedIn() {
  const who = editorOf((await cookies()).get(COOKIE)?.value);
  if (!who) throw new Error("not signed in");
  return { who, sql: db() };
}
/** the pages that list stories renewed, and the story's own pages when one changed (lib/renew.ts), and this page shown
 *  again */
function renew(aavtikal = false, story?: string) {
  renewPages([...listPaths(), ...classifiedPaths(), ...(story ? storyPaths(story) : [])]);
  if (aavtikal) for (const p of ["/aavtikal", "/en/aavtikal", "/hi/aavtikal"]) revalidatePath(p, "layout");
  refresh();
}

export async function removeStory(id: string) { const { who, sql } = await signedIn(); if (sql) await withdrawStory(sql, id, who); renew(false, id); }
export async function publishFeature(id: string) { const { sql } = await signedIn(); if (sql) await decideFeature(sql, id, "published"); renew(true); }
export async function removeFeature(id: string) { const { sql } = await signedIn(); if (sql) await decideFeature(sql, id, "withdrawn"); renew(true); }
export async function pauseEngine(paused: boolean) { const { sql } = await signedIn(); if (sql) await setPaused(sql, paused); refresh(); }
export async function putBackStory(id: string) { const { sql } = await signedIn(); if (sql) await restoreStory(sql, id); renew(false, id); }

const words = (f: FormData): Words => {
  const v = (k: string) => String(f.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  return { headline: v("headline"), deck: v("deck"), body: v("body"), caption: v("caption") };
};
/** the editor's changes saved; back to the list, which says so */
export async function changeStory(id: string, back: string, f: FormData) {
  const { who, sql } = await signedIn();
  const w = words(f);
  if (!w.headline || !w.body) redirect(`/editor/story/${encodeURIComponent(id)}?${back ? `${back}&` : ""}missing=1`);
  const ok = sql ? await saveStory(sql, id, w, who) : false;
  renew(false, id);
  redirect(`/editor?${back ? `${back}&` : ""}tab=news&saved=${ok ? "1" : "0"}`);
}
export async function changeFeature(id: string, back: string, f: FormData) {
  const { sql } = await signedIn();
  const w = words(f);
  if (!w.headline || !w.body) redirect(`/editor/feature/${encodeURIComponent(id)}?${back ? `${back}&` : ""}missing=1`);
  const ok = sql ? await saveFeature(sql, id, w) : false;
  renew(true);
  redirect(`/editor?${back ? `${back}&` : ""}tab=aavtikal&saved=${ok ? "1" : "0"}`);
}

/** only photos the write page put in the photo store (app/api/editor/photo), at most 12 */
const editorPhotos = (list: unknown): NewStory["photos"] =>
  (Array.isArray(list) ? (list as NewStory["photos"]) : []).filter((p) => /^\/media\/live\/\d{4}-\d{2}-\d{2}\/ed-[a-z0-9]+\.jpg$/.test(String(p?.url)))
    .slice(0, 12).map((p) => ({ url: p.url, width: Math.round(Number(p.width)) || 1600, height: Math.round(Number(p.height)) || 1067 }));

/** a story the editor wrote (app/(gu)/editor/write): on the site at once, word for word */
export async function writeStory(x: NewStory): Promise<{ id: string } | { error: "missing" | "failed" }> {
  const { who, sql } = await signedIn();
  const clean = (t: unknown) => String(t ?? "").replace(/\r\n/g, "\n").trim();
  const story: NewStory = {
    headline: clean(x.headline), deck: clean(x.deck), body: clean(x.body).replace(/\n{3,}/g, "\n\n"), caption: clean(x.caption),
    tier: TIERS.includes(x.tier) ? x.tier : "gujarat",
    genre: x.genre && (GENRES as string[]).includes(x.genre) ? x.genre : null,
    photos: editorPhotos(x.photos),
  };
  if (!story.headline || !story.body) return { error: "missing" };
  if (!sql) return { error: "failed" };
  try {
    const id = await addStory(sql, story, who);
    renew(false, id);
    return { id };
  } catch (e) {
    console.error(`a written story not saved: ${e}`);
    return { error: "failed" };
  }
}
/** an Aavtikal article the editor wrote (the same page, ?for=aavtikal): in Aavtikal at once, word for word */
export async function writeFeature(x: NewFeature): Promise<{ id: string } | { error: "missing" | "failed" }> {
  const { who, sql } = await signedIn();
  const clean = (t: unknown) => String(t ?? "").replace(/\r\n/g, "\n").trim();
  const article: NewFeature = {
    headline: clean(x.headline), deck: clean(x.deck), body: clean(x.body).replace(/\n{3,}/g, "\n\n"), caption: clean(x.caption),
    beat: (["ai", "tech", "science", "politics"] as const).includes(x.beat) ? x.beat : "tech",
    photos: editorPhotos(x.photos),
  };
  if (!article.headline || !article.body) return { error: "missing" };
  if (!sql) return { error: "failed" };
  try {
    const id = await addFeature(sql, article, who);
    renew(true);
    return { id };
  } catch (e) {
    console.error(`a written article not saved: ${e}`);
    return { error: "failed" };
  }
}
/** the optional AI help on the same page: suggestions the editor may keep or undo (lib/aihelp.ts) */
export async function aiHelp(d: Draft, kind: "news" | "article" = "news"): Promise<Help> {
  const { sql } = await signedIn();
  if (!String(d?.body ?? "").trim()) return { ok: false, why: "failed" };
  return help(sql, { headline: String(d.headline ?? ""), deck: String(d.deck ?? ""), body: String(d.body).slice(0, 30_000) }, kind === "article" ? "article" : "news");
}

/** the leaders list (lib/leaders.ts): a leader looked up on Wikidata, added or changed, taken off */
export async function findLeaderAction(name: string): Promise<FoundLeader | null> {
  await signedIn();
  return findLeader(String(name ?? "")).catch(() => null);
}
export async function saveLeaderAction(x: Leader): Promise<boolean> {
  const { sql } = await signedIn();
  const s = (v: unknown) => String(v ?? "");
  const ok = await saveLeader(sql, { id: s(x.id), nameGu: s(x.nameGu), nameEn: s(x.nameEn), title: s(x.title), post: s(x.post), born: s(x.born), email: s(x.email), portrait: s(x.portrait), credit: s(x.credit) });
  if (ok) refresh();
  return ok;
}
export async function dropLeaderAction(id: string) { const { sql } = await signedIn(); await dropLeader(sql, id); refresh(); }

/** the classified ads (lib/classifieds.ts): one put up from the form, one taken down */
export async function addAdAction(back: string, f: FormData) {
  const { who, sql } = await signedIn();
  const v = (k: string) => String(f.get(k) ?? "").replace(/\r\n/g, "\n").trim();
  const ok = sql ? await addAd(sql, { kind: v("kind"), text: v("text"), contact: v("contact"), place: v("place"), days: Number(v("days")) }, who) : false;
  renew();
  redirect(`/editor?${back ? `${back}&` : ""}tab=ads&ad=${ok ? 1 : 0}`);
}
export async function dropAdAction(id: string) { const { sql } = await signedIn(); if (sql) await dropAd(sql, id); renew(); }

/** the banner ads (lib/banners.ts): one put up from the form, one taken down. No page is made again: the pages ask
 *  for the day's banners themselves (components/AdSlot.tsx). */
export async function addBannerAction(x: { image: string; width: number; height: number; link: string; name: string; slots: string[]; days: number }): Promise<boolean> {
  const { who, sql } = await signedIn();
  const ok = sql ? await addBanner(sql, { image: String(x.image ?? ""), width: Number(x.width), height: Number(x.height), link: String(x.link ?? "").trim(),
                                           name: String(x.name ?? ""), slots: Array.isArray(x.slots) ? x.slots.map(String) : [], days: Number(x.days) }, who) : false;
  if (ok) refresh();
  return ok;
}
export async function dropBannerAction(id: string) { const { sql } = await signedIn(); if (sql) await dropBanner(sql, String(id)); refresh(); }

// Instagram's sets (Insta.tsx, lib/insta.ts)
async function instaSet(id: string) {
  const { sql, who } = await signedIn();
  const set = sql ? await getSet(sql, id) : null;
  // a line in the editor page's log (lib/insta.ts): who pressed what, on which set
  const say = (line: string, by = who) => (sql && set ? instaLog(sql, by, `${sectionName(set.tier, "gu")}: ${line}`) : Promise.resolve());
  return { sql: sql!, set, say };
}
/** a card taken out, or given its next photo: the pictures are made again by the engine within minutes */
export async function dropInstaCard(id: string, i: number) {
  const { sql, set, say } = await instaSet(id);
  if (!set || set.state !== "waiting" || set.cards.length <= MIN_KEPT || !set.cards[i]) return refresh();
  await say(`કાર્ડ ${i + 1} હટાવ્યું (“${set.cards[i].headline.slice(0, 50)}”): ચિત્રો ફરી બનશે`);
  set.cards.splice(i, 1);
  set.caption = captionFor(set.tier, set.edition, set.cards);
  set.state = "making";
  await saveSet(sql, set);
  refresh();
}
export async function nextInstaPhoto(id: string, i: number) {
  const { sql, set, say } = await instaSet(id);
  const c = set?.cards[i];
  if (!set || set.state !== "waiting" || !c || c.options.length < 2) return refresh();
  c.pick = (c.pick + 1) % c.options.length;
  await say(`કાર્ડ ${i + 1}નો બીજો ફોટો (${c.pick + 1}/${c.options.length}): ચિત્રો ફરી બનશે`);
  set.caption = captionFor(set.tier, set.edition, set.cards);
  set.state = "making";
  await saveSet(sql, set);
  refresh();
}
/** a card moved one place earlier (-1) or later (1); the pictures are made again */
export async function moveInstaCard(id: string, i: number, by: -1 | 1) {
  const { sql, set, say } = await instaSet(id);
  const j = i + by;
  if (!set || set.state !== "waiting" || !set.cards[i] || !set.cards[j]) return refresh();
  [set.cards[i], set.cards[j]] = [set.cards[j], set.cards[i]];
  await say(`કાર્ડ ${i + 1} ${by < 0 ? "આગળ" : "પાછળ"} ખસેડ્યું: ચિત્રો ફરી બનશે`);
  set.caption = captionFor(set.tier, set.edition, set.cards);
  set.state = "making";
  await saveSet(sql, set);
  refresh();
}
/** a set made now, for the sections ticked (the engine makes it within minutes: engine/listen.ts) */
export async function makeInstaNow(f: FormData) {
  const { who, sql } = await signedIn();
  const tiers = cleanTiers(f.getAll("tier"));
  if (sql && tiers.length) {
    await askInsta(sql, { tiers, at: new Date().toISOString(), by: who });
    await instaLog(sql, who, `નવો સેટ માગ્યો: ${tiers.map((t) => sectionName(t, "gu")).join(", ")}`);
  }
  refresh();
}
/** the editor's times, sections and whether sets come by themselves */
export async function saveInstaTimes(f: FormData) {
  const { sql, who } = await signedIn();
  if (!sql) return refresh();
  const before = await instaSettings(sql);
  const tiers = cleanTiers(f.getAll("tier"));
  const after = { auto: f.get("auto") === "on", times: cleanTimes(f.getAll("time")), tiers: tiers.length ? tiers : before.tiers };
  await saveInstaSettings(sql, after);
  await instaLog(sql, who, `સમય બદલ્યા: ${after.auto ? after.times.join(", ") || "કોઈ સમય નહીં" : "ફક્ત માગું ત્યારે"}; વિભાગ: ${after.tiers.map((t) => sectionName(t, "gu")).join(", ")}`);
  refresh();
}
export async function captionInsta(id: string, f: FormData) {
  const { sql, set, say } = await instaSet(id);
  const caption = String(f.get("caption") ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2200);
  if (set && caption && set.state !== "posted") { set.caption = caption; await saveSet(sql, set); await say("ઇન્સ્ટાગ્રામ પરના શબ્દો બદલ્યા"); }
  refresh();
}
/** approved: put up at once on Instagram and the Facebook Page, where each is connected, both at the same time; pressed
 *  again, it goes up only where it isn't yet (a set up on Instagram before the Page was connected goes to the Page too) */
export async function approveInsta(id: string) {
  const { sql, set, say } = await instaSet(id);
  if (!set || !set.image) return refresh();
  const ig = instagramOn() && !set.postUrl, fb = facebookOn() && !set.fbUrl;
  if (!["waiting", "approved", "failed"].includes(set.state) && !(set.state === "posted" && fb)) return refresh();
  // pressed again while it's going up: not put up twice (postedAt, while approved, is when it started going up)
  if (set.state === "approved" && set.postedAt && Date.now() - new Date(set.postedAt).getTime() < POSTING_MS) {
    await say("ફરી દબાવ્યું, પણ સેટ મુકાઈ જ રહ્યો છે: બે વાર નહીં મુકાય");
    return refresh();
  }
  set.state = "approved";
  set.note = "";
  set.postedAt = ig || fb ? new Date().toISOString() : null;
  await saveSet(sql, set);
  const where = [ig && "ઇન્સ્ટાગ્રામ", fb && "ફેસબુક"].filter(Boolean).join(" અને ");
  await say(where ? `મંજૂર કર્યો: ${where} પર મુકાય છે` : "મંજૂર કર્યો; ઇન્સ્ટાગ્રામ કે ફેસબુક જોડાયેલું નથી, તેથી હજી નહીં મુકાય");
  if (!ig && !fb) return refresh();
  const notes: string[] = [];
  await Promise.all([
    ig && postSet(set, (line) => say(line, "instagram")).then(async (url) => {
      set.postUrl = url;
      await say(`મુકાઈ ગયો: ${url}`, "instagram");
    }, async (e) => {
      notes.push(`ઇન્સ્ટાગ્રામે ના પાડી: ${e instanceof Error ? e.message : e}`);
      await say(`ન મુકાયો. ${notes.at(-1)}`, "instagram");
    }),
    fb && postSetFacebook(set, (line) => say(line, "facebook")).then(async (url) => {
      set.fbUrl = url;
      await say(`મુકાઈ ગયો: ${url}`, "facebook");
    }, async (e) => {
      notes.push(`ફેસબુકે ના પાડી: ${e instanceof Error ? e.message : e}`);
      await say(`ન મુકાયો. ${notes.at(-1)}`, "facebook");
    }),
  ]);
  // posted when it's up everywhere it was sent; else "not posted" with the reasons, and pressed again it goes only there
  set.state = notes.length ? "failed" : "posted";
  set.postedAt = notes.length ? null : new Date().toISOString();
  set.note = notes.join(" · ").slice(0, 300);
  await saveSet(sql, set);
  if (set.postUrl) revalidatePath("/insta");
  refresh();
}
export async function skipInsta(id: string) {
  const { sql, set, say } = await instaSet(id);
  if (set && set.state !== "posted") { set.state = "expired"; await saveSet(sql, set); await say("“આ સેટ ન મૂકો”: હટાવ્યો"); }
  refresh();
}
